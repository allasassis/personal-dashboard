import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mergeRecords, parseFile, serializeFile, type Rec } from './collection';
import { decodeBase64, encodeBase64, parseRepo } from './github';
import { SyncEngine, type ConfigStore, type Kv } from './sync';

interface Note extends Rec {
  text: string;
}

/** Implements the parts of GitHub's Contents API the app relies on, including its failure modes. */
class FakeGitHub {
  files = new Map<string, { sha: string; text: string }>();
  isPrivate = true;
  puts = 0;
  validToken = 'good';
  writable = true;
  offline = false;
  /** Runs right before a PUT is handled, to simulate another device racing us. */
  beforePut: (() => void) | null = null;
  largeFiles = false;

  static sha = (text: string) => createHash('sha1').update(text).digest('hex');

  write(path: string, text: string) {
    this.files.set(path, { sha: FakeGitHub.sha(text), text });
  }

  fetch: typeof fetch = async (input, init) => {
    if (this.offline) throw new TypeError('Failed to fetch');
    const url = String(input);
    const headers = init?.headers as Record<string, string>;
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
    if (headers.Authorization !== `Bearer ${this.validToken}`) return json(401, { message: 'Bad credentials' });

    const blob = url.match(/\/git\/blobs\/(.+)$/);
    if (blob) {
      const file = [...this.files.values()].find((f) => f.sha === blob[1]);
      return json(200, { content: encodeBase64(file!.text), encoding: 'base64' });
    }
    const m = url.match(/\/contents\/(.+)$/);
    if (!m) return json(200, { private: this.isPrivate, full_name: 'me/data' });

    const path = m[1];
    if (init?.method === 'PUT') {
      this.beforePut?.();
      if (!this.writable) return json(403, { message: 'Resource not accessible by personal access token' });
      const body = JSON.parse(String(init.body));
      const existing = this.files.get(path);
      if (existing && !body.sha) return json(422, { message: '"sha" wasn\'t supplied' });
      if (existing && body.sha !== existing.sha) return json(409, { message: 'does not match' });
      if (!existing && body.sha) return json(409, { message: 'does not match' });
      this.puts++;
      this.write(path, decodeBase64(body.content));
      return json(200, { content: { sha: this.files.get(path)!.sha } });
    }
    const file = this.files.get(path);
    if (!file) return json(404, { message: 'Not Found' });
    if (this.largeFiles) return json(200, { sha: file.sha, content: '', encoding: 'none' });
    // GitHub wraps base64 at 60 columns.
    return json(200, { sha: file.sha, encoding: 'base64', content: encodeBase64(file.text).replace(/(.{60})/g, '$1\n') });
  };
}

function memoryKv(): Kv & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    get: async <V,>(k: string) => structuredClone(data.get(k)) as V | undefined,
    set: async (k, v) => void data.set(k, structuredClone(v)),
    clear: async () => data.clear(),
  };
}

function memoryConfig(): ConfigStore {
  let cfg: ReturnType<ConfigStore['load']> = null;
  return { load: () => cfg, save: (c) => void (cfg = c) };
}

const CFG = { owner: 'me', repo: 'data', token: 'good' };

async function device(gh: FakeGitHub, kv = memoryKv()) {
  const engine = new SyncEngine(kv, memoryConfig(), gh.fetch);
  const notes = engine.define<Note>('test/notes');
  const draft = engine.define<Note>('test/draft', { localOnly: true });
  await engine.load();
  return { engine, notes, draft, kv };
}

const texts = (d: { notes: { list(): Note[] } }) =>
  d.notes
    .list()
    .map((n) => n.text)
    .sort();

let gh: FakeGitHub;
beforeEach(() => {
  gh = new FakeGitHub();
});

describe('connect', () => {
  it('refuses a public repo and stores nothing', async () => {
    gh.isPrivate = false;
    const a = await device(gh);
    await expect(a.engine.connect(CFG)).rejects.toThrow(/public/);
    expect(a.engine.config).toBeNull();
    expect(gh.files.size).toBe(0);
  });

  it('explains a bad token', async () => {
    const a = await device(gh);
    await expect(a.engine.connect({ ...CFG, token: 'nope' })).rejects.toThrow(/token/i);
  });

  it('explains a read-only token on an empty repo', async () => {
    gh.writable = false;
    const a = await device(gh);
    await expect(a.engine.connect(CFG)).rejects.toThrow(/Read and write/);
  });

  it('pushes data entered before connecting', async () => {
    const a = await device(gh);
    a.notes.put({ id: '1', text: 'before' });
    await a.engine.connect(CFG);
    expect(gh.files.get('data/test/notes.json')!.text).toContain('before');
    expect(a.engine.status.state).toBe('idle');
    expect(a.engine.pendingCount()).toBe(0);
  });
});

describe('two devices', () => {
  it('second device receives what the first wrote', async () => {
    const a = await device(gh);
    await a.engine.connect(CFG);
    a.notes.put({ id: '1', text: 'hello' });
    await a.engine.sync();

    const b = await device(gh);
    await b.engine.connect(CFG);
    expect(texts(b)).toEqual(['hello']);
    expect(gh.puts).toBe(2); // manifest and the note, and b had nothing new to write
  });

  it('merges edits made to different records on both sides', async () => {
    const a = await device(gh);
    const b = await device(gh);
    await a.engine.connect(CFG);
    await b.engine.connect(CFG);

    a.notes.put({ id: 'a', text: 'from a' });
    b.notes.put({ id: 'b', text: 'from b' });
    await a.engine.flush();
    await b.engine.flush(); // b holds an outdated view of the file here
    await a.engine.sync();

    expect(texts(a)).toEqual(['from a', 'from b']);
    expect(texts(b)).toEqual(['from a', 'from b']);
  });

  it('survives losing the race at the moment of writing', async () => {
    const a = await device(gh);
    await a.engine.connect(CFG);
    a.notes.put({ id: 'seed', text: 'seed' });
    await a.engine.sync();

    let raced = false;
    gh.beforePut = () => {
      if (raced) return;
      raced = true;
      const rival = serializeFile([{ id: 'rival', updatedAt: 1, text: 'rival' } as Note, { id: 'seed', updatedAt: 1, text: 'seed' } as Note]);
      gh.write('data/test/notes.json', rival);
    };
    a.notes.put({ id: 'mine', text: 'mine' });
    await a.engine.flush();

    expect(texts(a)).toEqual(['mine', 'rival', 'seed']);
    const remote = parseFile<Note>(gh.files.get('data/test/notes.json')!.text);
    expect(remote.map((r) => r.id).sort()).toEqual(['mine', 'rival', 'seed']);
  });

  it('a delete beats an older copy and stays deleted', async () => {
    const a = await device(gh);
    const b = await device(gh);
    await a.engine.connect(CFG);
    a.notes.put({ id: '1', text: 'x' });
    await a.engine.sync();
    await b.engine.connect(CFG);

    await new Promise((r) => setTimeout(r, 2));
    a.notes.remove('1');
    await a.engine.sync();
    await b.engine.sync();
    expect(texts(b)).toEqual([]);
  });

  it('newer edit wins on the same record', async () => {
    const a = await device(gh);
    const b = await device(gh);
    await a.engine.connect(CFG);
    a.notes.put({ id: '1', text: 'v1' });
    await a.engine.sync();
    await b.engine.connect(CFG);

    b.notes.put({ id: '1', text: 'b older' });
    await new Promise((r) => setTimeout(r, 2));
    a.notes.put({ id: '1', text: 'a newer' });
    await a.engine.flush();
    await b.engine.sync();
    await a.engine.sync();
    expect(texts(a)).toEqual(['a newer']);
    expect(texts(b)).toEqual(['a newer']);
  });
});

describe('failure handling', () => {
  it('keeps edits while offline and sends them later', async () => {
    const a = await device(gh);
    await a.engine.connect(CFG);
    gh.offline = true;
    a.notes.put({ id: '1', text: 'at the gym' });
    await a.engine.flush();
    expect(a.engine.status.state).toBe('offline');
    expect(a.engine.pendingCount()).toBe(1);

    gh.offline = false;
    await a.engine.sync();
    expect(a.engine.status.state).toBe('idle');
    expect(gh.files.get('data/test/notes.json')!.text).toContain('at the gym');
  });

  it('survives a restart with unsent edits', async () => {
    const kv = memoryKv();
    const a = await device(gh, kv);
    gh.offline = true;
    a.notes.put({ id: '1', text: 'unsent' });
    await new Promise((r) => setTimeout(r));

    const restarted = await device(gh, kv);
    expect(texts(restarted)).toEqual(['unsent']);
    expect(restarted.notes.dirty).toBe(true);
  });

  it('never overwrites a remote file it cannot parse', async () => {
    const a = await device(gh);
    await a.engine.connect(CFG);
    gh.write('data/test/notes.json', '{ broken');
    a.notes.put({ id: '1', text: 'x' });
    await a.engine.sync();
    expect(gh.files.get('data/test/notes.json')!.text).toBe('{ broken');
    expect(a.engine.status.state).toBe('error');
    expect(a.engine.status.message).toMatch(/not valid JSON/);
    expect(texts(a)).toEqual(['x']);
  });

  it('refuses files from a newer schema', async () => {
    const a = await device(gh);
    await a.engine.connect(CFG);
    const future = '{"schema":99,"records":[]}';
    gh.write('data/test/notes.json', future);
    a.notes.put({ id: '1', text: 'x' });
    await a.engine.sync();
    expect(gh.files.get('data/test/notes.json')!.text).toBe(future);
  });

  it('reads files over the 1 MB Contents API limit through the blob API', async () => {
    const a = await device(gh);
    await a.engine.connect(CFG);
    a.notes.put({ id: '1', text: 'large' });
    await a.engine.sync();
    gh.largeFiles = true;
    const b = await device(gh);
    await b.engine.connect(CFG);
    expect(texts(b)).toEqual(['large']);
  });

  it('keeps an edit made while its push is in flight', async () => {
    const a = await device(gh);
    await a.engine.connect(CFG);
    let once = true;
    gh.beforePut = () => {
      if (once) a.notes.put({ id: 'late', text: 'late' });
      once = false;
    };
    a.notes.put({ id: 'first', text: 'first' });
    await a.engine.flush();
    expect(a.notes.dirty).toBe(true);
    await a.engine.flush();
    expect(a.notes.dirty).toBe(false);
    expect(gh.files.get('data/test/notes.json')!.text).toContain('late');
  });
});

describe('push timing', () => {
  afterEach(() => vi.useRealTimers());

  it('waits longer for collections with a push delay, without holding up the others', async () => {
    const engine = new SyncEngine(memoryKv(), memoryConfig(), gh.fetch);
    const quick = engine.define<Note>('test/quick');
    const slow = engine.define<Note>('test/slow', { pushDelay: 20_000 });
    await engine.load();
    await engine.connect(CFG);
    vi.useFakeTimers();

    slow.put({ id: '1', text: 'typing' });
    await vi.advanceTimersByTimeAsync(5_000);
    slow.put({ id: '1', text: 'typing more' }); // restarts its own wait
    quick.put({ id: '1', text: 'quick' });
    await vi.advanceTimersByTimeAsync(3_000);
    expect(gh.files.has('data/test/quick.json')).toBe(true);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(gh.files.get('data/test/slow.json')!.text).toContain('typing more');
    expect(slow.dirty).toBe(false);
  });
});

describe('details', () => {
  it('does not send local-only collections', async () => {
    const a = await device(gh);
    await a.engine.connect(CFG);
    a.draft.put({ id: 'active', text: 'draft' });
    await a.engine.sync();
    expect(gh.files.has('data/test/draft.json')).toBe(false);
  });

  it('forgets the token and data on erase, leaving the repo alone', async () => {
    const a = await device(gh);
    await a.engine.connect(CFG);
    a.notes.put({ id: '1', text: 'x' });
    await a.engine.sync();
    await a.engine.eraseLocal();
    expect(a.notes.list()).toEqual([]);
    expect(a.kv.data.size).toBeLessThanOrEqual(2); // only empty placeholders may remain
    expect(a.engine.config).toBeNull();
    expect(gh.files.get('data/test/notes.json')!.text).toContain('x');
  });

  it('round-trips accents and emoji through base64', () => {
    const s = 'Supino inclinado, açaí, pão de queijo 💪';
    expect(decodeBase64(encodeBase64(s))).toBe(s);
  });

  it('accepts every common way to write a repo', () => {
    const want = { owner: 'me', repo: 'my.data' };
    expect(parseRepo('me/my.data')).toEqual(want);
    expect(parseRepo('https://github.com/me/my.data')).toEqual(want);
    expect(parseRepo(' https://github.com/me/my.data.git/ ')).toEqual(want);
    expect(parseRepo('git@github.com:me/my.data.git')).toEqual(want);
    expect(parseRepo('https://gitlab.com/me/data')).toBeNull();
    expect(parseRepo('nonsense')).toBeNull();
  });

  it('serialized files parse back to the same records, ordered by id', () => {
    const recs = [
      { id: 'b', updatedAt: 2, text: 'b' },
      { id: 'a', updatedAt: 1, text: 'á' },
    ];
    expect(parseFile(serializeFile(recs)).map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('a tie goes to the remote copy so hand edits in the repo apply', () => {
    const local = new Map([['1', { id: '1', updatedAt: 5, text: 'old' } as Note]]);
    const { merged, remoteChanged, localAhead } = mergeRecords(local, [{ id: '1', updatedAt: 5, text: 'hand edit' } as Note]);
    expect(merged.get('1')!.text).toBe('hand edit');
    expect(remoteChanged).toBe(true);
    expect(localAhead).toBe(false);
  });
});
