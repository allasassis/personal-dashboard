// App-wide wiring: the sync engine, browser storage, and React hooks.

import { useSyncExternalStore } from 'react';
import type { Collection, Rec } from './collection';
import type { RepoConfig } from './github';
import { SyncEngine, type ConfigStore, type Kv } from './sync';

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('personal-dashboard', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

let db: Promise<IDBDatabase> | null = null;

async function tx<V>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<V> {
  db ??= openDb();
  const database = await db;
  return new Promise((resolve, reject) => {
    const req = run(database.transaction('kv', mode).objectStore('kv'));
    req.onsuccess = () => resolve(req.result as V);
    req.onerror = () => reject(req.error);
  });
}

const kv: Kv = {
  get: (key) => tx('readonly', (s) => s.get(key)),
  set: (key, value) => tx('readwrite', (s) => s.put(value, key)),
  clear: () => tx('readwrite', (s) => s.clear()),
};

const CONFIG_KEY = 'dashboard.github';

const configStore: ConfigStore = {
  load() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      return raw ? (JSON.parse(raw) as RepoConfig) : null;
    } catch {
      return null;
    }
  },
  save(cfg) {
    if (cfg) localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    else localStorage.removeItem(CONFIG_KEY);
  },
};

export const engine = new SyncEngine(kv, configStore);

/** Declare a collection stored at data/<name>.json in the data repo. */
export const defineCollection = <T extends Rec>(name: string, opts?: { localOnly?: boolean; pushDelay?: number }) => engine.define<T>(name, opts);

export const useRecords = <T extends Rec>(col: Collection<T>): T[] => useSyncExternalStore(col.subscribe, col.list);

export const useSyncStatus = () => useSyncExternalStore(engine.subscribe, engine.getStatus);
