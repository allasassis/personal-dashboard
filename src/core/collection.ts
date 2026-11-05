// A Collection is the unit of storage every module uses: a set of records with ids,
// kept locally and mirrored to one JSON file in the data repo (data/<name>.json).
//
// Records are never physically removed, they get `deleted: true`, so a delete on one
// device beats an older copy on another when files are merged.

export const SCHEMA = 1;

export interface Rec {
  id: string;
  updatedAt: number;
  deleted?: boolean;
}

export type Draft<T extends Rec> = Omit<T, 'updatedAt' | 'deleted'>;

export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('');
}

/**
 * Newest `updatedAt` wins per record. Ties go to the remote copy, which means an edit
 * made by hand in the repo is picked up even if the timestamp was left alone.
 */
export function mergeRecords<T extends Rec>(local: Map<string, T>, remote: T[]) {
  const merged = new Map<string, T>();
  let remoteChanged = false; // merged differs from local
  let localAhead = false; // merged differs from remote
  for (const r of remote) merged.set(r.id, r);
  for (const [id, l] of local) {
    const r = merged.get(id);
    if (!r || l.updatedAt > r.updatedAt) {
      merged.set(id, l);
      localAhead = true;
    }
  }
  for (const r of remote) {
    const l = local.get(r.id);
    if (!l || (r.updatedAt >= l.updatedAt && JSON.stringify(l) !== JSON.stringify(r))) remoteChanged = true;
  }
  return { merged, remoteChanged, localAhead };
}

/** One record per line, sorted by id: small files with readable git diffs. */
export function serializeFile(records: Iterable<Rec>): string {
  const lines = [...records]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((r) => '    ' + JSON.stringify(r));
  return `{\n  "schema": ${SCHEMA},\n  "records": [\n${lines.join(',\n')}\n  ]\n}\n`;
}

export class FileFormatError extends Error {}

export function parseFile<T extends Rec>(text: string): T[] {
  let data: { schema?: unknown; records?: unknown };
  try {
    data = JSON.parse(text);
  } catch {
    throw new FileFormatError('is not valid JSON');
  }
  if (typeof data.schema !== 'number' || !Array.isArray(data.records)) {
    throw new FileFormatError('is not in the expected format');
  }
  if (data.schema > SCHEMA) throw new FileFormatError('was written by a newer version of this app');
  for (const r of data.records as Rec[]) {
    if (typeof r?.id !== 'string' || typeof r?.updatedAt !== 'number') {
      throw new FileFormatError('has a record without an id or updatedAt');
    }
  }
  return data.records as T[];
}

export interface CollectionState<T> {
  records: T[];
  sha: string | null;
  dirty: boolean;
}

export class Collection<T extends Rec = Rec> {
  records = new Map<string, T>();
  /** Blob sha of the file as last seen on GitHub, null when unknown or absent. */
  sha: string | null = null;
  /** There are local changes GitHub does not have yet. */
  dirty = false;
  /** Bumped on each local edit, so a push can tell if edits landed while it ran. */
  gen = 0;
  /** Set by the engine: called after an edit made on this device. */
  onLocalEdit: (() => void) | null = null;
  /** Set by the engine: called whenever state worth saving changes. */
  onPersist: (() => void) | null = null;

  private listeners = new Set<() => void>();
  private cached: T[] | null = null;

  constructor(
    readonly name: string,
    /** localOnly collections stay on this device, e.g. a workout in progress. */
    readonly localOnly = false,
    /** Quiet time before edits are sent. Longer for text, so a pause while typing isn't a commit. */
    readonly pushDelay?: number,
  ) {}

  get path() {
    return `data/${this.name}.json`;
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };

  /** Live records. The same array comes back until something changes. */
  list = (): T[] => {
    if (!this.cached) this.cached = [...this.records.values()].filter((r) => !r.deleted);
    return this.cached;
  };

  /** Includes deleted records, so history can still show the name of a removed item. */
  get(id: string): T | undefined {
    return this.records.get(id);
  }

  put(draft: Draft<T>): T {
    const prev = this.records.get(draft.id);
    const rec = { ...draft, updatedAt: Math.max(Date.now(), (prev?.updatedAt ?? 0) + 1) } as unknown as T;
    this.records.set(rec.id, rec);
    this.edited();
    return rec;
  }

  remove(id: string) {
    const prev = this.records.get(id);
    // A record that was never saved can still be tombstoned: built-in foods use this.
    const base = prev ?? ({ id } as T);
    this.records.set(id, { ...base, deleted: true, updatedAt: Math.max(Date.now(), (prev?.updatedAt ?? 0) + 1) });
    this.edited();
  }

  private edited() {
    this.gen++;
    if (!this.localOnly) this.dirty = true;
    this.changed();
    this.onLocalEdit?.();
  }

  /** Replace contents after a merge. Not a local edit, so nothing gets scheduled. */
  replace(records: Map<string, T>) {
    this.records = records;
    this.changed();
  }

  changed() {
    this.cached = null;
    this.onPersist?.();
    this.listeners.forEach((fn) => fn());
  }

  snapshot(): CollectionState<T> {
    return { records: [...this.records.values()], sha: this.sha, dirty: this.dirty };
  }

  hydrate(state: CollectionState<T>) {
    this.records = new Map(state.records.map((r) => [r.id, r]));
    this.sha = state.sha;
    this.dirty = state.dirty;
    this.cached = null;
  }
}
