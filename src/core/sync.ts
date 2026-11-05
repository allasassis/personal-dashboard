// Keeps every Collection in step with its file in the data repo.
//
// Edits apply locally right away, so the app works offline and never waits on the
// network. After a short pause changed collections are pushed. GitHub rejects a write
// made against an outdated sha, and when it does we fetch, merge record by record and
// try again, so two devices can edit at once without losing data.

import { Collection, FileFormatError, mergeRecords, parseFile, serializeFile, SCHEMA } from './collection';
import type { CollectionState, Rec } from './collection';
import { explainError, GitHubClient, GitHubError, type RepoConfig } from './github';

export interface Kv {
  get<V>(key: string): Promise<V | undefined>;
  set(key: string, value: unknown): Promise<void>;
  clear(): Promise<void>;
}

export interface ConfigStore {
  load(): RepoConfig | null;
  save(cfg: RepoConfig | null): void;
}

export interface SyncStatus {
  state: 'local' | 'idle' | 'syncing' | 'offline' | 'error';
  message: string | null;
  lastSyncAt: number | null;
  pending: number;
}

const PUSH_DELAY = 2500;
const RETRY_DELAY = 30_000;
const PULL_INTERVAL = 60_000;
const MAX_ATTEMPTS = 4;

export class SyncEngine {
  readonly collections: Collection<any>[] = [];
  status: SyncStatus = { state: 'local', message: null, lastSyncAt: null, pending: 0 };
  config: RepoConfig | null = null;

  private client: GitHubClient | null = null;
  private listeners = new Set<() => void>();
  private pushTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private wantPush = false;
  private wantPull = false;
  private pulledAt = 0;
  private pulled = new Set<string>();
  private channel: BroadcastChannel | null = null;

  constructor(
    private kv: Kv,
    private configStore: ConfigStore,
    private fetchFn?: typeof fetch,
  ) {}

  define<T extends Rec>(name: string, opts: { localOnly?: boolean; pushDelay?: number } = {}): Collection<T> {
    const col = new Collection<T>(name, opts.localOnly, opts.pushDelay);
    col.onPersist = () => this.persist(col);
    col.onLocalEdit = () => {
      this.broadcast(col);
      this.updateStatus();
      if (!col.localOnly) this.schedulePush(col);
    };
    this.collections.push(col);
    return col;
  }

  /** Load local data. Call before the first render. */
  async load() {
    await Promise.all(
      this.collections.map(async (col) => {
        const state = await this.kv.get<CollectionState<Rec>>(`col:${col.name}`);
        if (state) col.hydrate(state);
      }),
    );
    this.config = this.configStore.load();
    this.client = this.config ? new GitHubClient(this.config, this.fetchFn) : null;
    this.updateStatus();
  }

  /** Begin syncing and react to the connection and tab focus coming and going. */
  start() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('dashboard-sync');
      this.channel.onmessage = (e) => this.receiveFromTab(e.data);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.sync());
      window.addEventListener('focus', () => this.pullIfStale());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.flush();
        else this.pullIfStale();
      });
    }
    this.sync();
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };
  getStatus = () => this.status;

  /**
   * Validates the repo and token, then starts using them. Throws a readable Error
   * so the setup form can show what is wrong.
   */
  async connect(cfg: RepoConfig) {
    const client = new GitHubClient(cfg, this.fetchFn);
    let repo: { private: boolean };
    try {
      repo = await client.getRepo();
    } catch (e) {
      throw new Error(explainError(e));
    }
    if (!repo.private) {
      throw new Error('This repo is public, so anyone could read your data. Make it private and try again.');
    }
    // Also proves the token can write, on a repo that has never been used.
    try {
      const manifest = 'data/manifest.json';
      if (!(await client.getFile(manifest))) {
        const text = JSON.stringify({ app: 'personal-dashboard', schema: SCHEMA }, null, 2) + '\n';
        await client.putFile(manifest, text, null, 'Set up dashboard data');
      }
    } catch (e) {
      throw new Error(explainError(e));
    }

    this.config = cfg;
    this.configStore.save(cfg);
    this.client = client;
    this.pulled.clear();
    for (const col of this.synced()) {
      // Shas from another repo mean nothing here. Anything held locally gets merged in.
      col.sha = null;
      col.dirty = col.records.size > 0;
      this.persist(col);
    }
    await this.sync();
  }

  disconnect() {
    this.config = null;
    this.client = null;
    this.configStore.save(null);
    this.clearTimers();
    this.updateStatus();
  }

  /** Forget this device's copy of the data and its token. The repo is untouched. */
  async eraseLocal() {
    this.disconnect();
    await this.kv.clear();
    for (const col of this.collections) {
      col.sha = null;
      col.dirty = false;
      col.replace(new Map());
    }
    this.updateStatus();
  }

  pendingCount() {
    return this.synced().filter((c) => c.dirty).length;
  }

  /** Pull everything, then push whatever is left to push. */
  sync(): Promise<void> {
    this.wantPull = true;
    this.wantPush = true;
    return this.run();
  }

  /** Push now rather than at the end of the delay. */
  flush(): Promise<void> {
    if (!this.pendingCount()) return Promise.resolve();
    this.wantPush = true;
    return this.run();
  }

  private pullIfStale() {
    if (Date.now() - this.pulledAt > PULL_INTERVAL) this.sync();
  }

  private schedulePush(col: Collection<any>) {
    clearTimeout(this.pushTimers.get(col.name));
    this.pushTimers.set(
      col.name,
      setTimeout(() => {
        this.pushTimers.delete(col.name);
        this.wantPush = true;
        this.run();
      }, col.pushDelay ?? PUSH_DELAY),
    );
  }

  private clearTimers() {
    this.pushTimers.forEach((t) => clearTimeout(t));
    this.pushTimers.clear();
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private synced() {
    return this.collections.filter((c) => !c.localOnly);
  }

  /** GitHub also returns 409 for concurrent writes to a branch, so one write at a time. */
  private run(): Promise<void> {
    if (this.running) return this.current;
    this.current = this.loop();
    return this.current;
  }
  private current: Promise<void> = Promise.resolve();

  private async loop() {
    if (!this.client) return;
    this.running = true;
    let failure: { kind: 'offline' | 'error'; message: string; retry: boolean } | null = null;
    try {
      while (this.wantPull || this.wantPush) {
        const pull = this.wantPull;
        this.wantPull = this.wantPush = false;
        failure = null;
        this.setStatus({ state: 'syncing', message: null });
        for (const col of this.synced()) {
          try {
            await this.syncCollection(col, pull);
          } catch (e) {
            if (e instanceof FileFormatError) {
              // One broken file must not block the rest, and must never be overwritten.
              failure = { kind: 'error', message: `${col.path} ${e.message}. Fix the file in the repo.`, retry: false };
              continue;
            }
            const rateLimited = e instanceof GitHubError && (e.status === 429 || /rate limit/i.test(e.message));
            const auth = !rateLimited && e instanceof GitHubError && [401, 403, 404].includes(e.status);
            const offline = e instanceof TypeError;
            failure = { kind: offline ? 'offline' : 'error', message: explainError(e), retry: !auth };
            break;
          }
        }
        if (pull && !failure) this.pulledAt = Date.now();
      }
    } finally {
      this.running = false;
    }
    if (!this.client) {
      this.updateStatus(); // disconnected while a request was in flight
    } else if (failure) {
      this.setStatus({ state: failure.kind, message: failure.message });
      if (failure.retry) {
        if (this.retryTimer) clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(() => this.sync(), RETRY_DELAY);
      }
    } else {
      this.setStatus({ state: 'idle', message: null, lastSyncAt: Date.now() });
    }
  }

  private async syncCollection(col: Collection<any>, forcePull: boolean) {
    for (let attempt = 0; ; attempt++) {
      if (forcePull || attempt > 0 || !this.pulled.has(col.name)) await this.pull(col);
      if (!col.dirty) return;

      const gen = col.gen;
      try {
        col.sha = await this.client!.putFile(col.path, serializeFile(col.records.values()), col.sha, `Update ${col.name}`);
      } catch (e) {
        const conflict = e instanceof GitHubError && (e.status === 409 || e.status === 422);
        if (conflict && attempt < MAX_ATTEMPTS - 1) continue;
        throw e;
      }
      // Edits made while the request was in flight keep the collection dirty.
      if (col.gen === gen) col.dirty = false;
      this.persist(col);
      this.broadcast(col);
      return;
    }
  }

  private async pull(col: Collection<any>) {
    const file = await this.client!.getFile(col.path);
    this.pulled.add(col.name);
    if (!file) {
      col.sha = null;
      if (col.records.size > 0) col.dirty = true;
      this.persist(col);
      return;
    }
    if (file.sha === col.sha) return;
    const remote = parseFile<Rec>(file.text);
    const { merged, remoteChanged, localAhead } = mergeRecords(col.records, remote);
    col.sha = file.sha;
    if (localAhead) col.dirty = true;
    else if (!remoteChanged) col.dirty = false; // already identical
    if (remoteChanged) col.replace(merged);
    else this.persist(col);
  }

  private persist(col: Collection<any>) {
    this.kv.set(`col:${col.name}`, col.snapshot()).catch((e) => {
      this.setStatus({ state: 'error', message: `Could not save on this device: ${explainError(e)}` });
    });
  }

  // Two open tabs share storage, so each tells the other what it changed. Otherwise
  // the tab that saves last would overwrite the other tab's edits.
  private broadcast(col: Collection<any>) {
    this.channel?.postMessage({ name: col.name, ...col.snapshot() });
  }

  private receiveFromTab(msg: { name: string } & CollectionState<Rec>) {
    const col = this.collections.find((c) => c.name === msg.name);
    if (!col) return;
    const { merged, remoteChanged, localAhead } = mergeRecords(col.records, msg.records);
    col.sha = msg.sha;
    col.dirty = localAhead || msg.dirty;
    if (remoteChanged) col.replace(merged);
    this.updateStatus();
  }

  private updateStatus() {
    this.setStatus(this.client ? {} : { state: 'local', message: null });
  }

  private setStatus(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, pending: this.pendingCount(), ...patch };
    this.listeners.forEach((fn) => fn());
  }
}
