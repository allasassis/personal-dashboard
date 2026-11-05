import { useEffect, useState } from 'react';
import { useSyncStatus } from '../core/store';

function ago(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function SyncBadge() {
  const st = useSyncStatus();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  let label: string;
  let tone: 'good' | 'busy' | 'warn' | 'bad';
  if (st.state === 'local') [label, tone] = ['Not backed up', 'warn'];
  else if (st.state === 'error') [label, tone] = ['Sync problem', 'bad'];
  else if (st.state === 'offline') [label, tone] = [st.pending ? `Offline, ${st.pending} waiting` : 'Offline', 'warn'];
  else if (st.state === 'syncing' || st.pending) [label, tone] = ['Syncing…', 'busy'];
  else [label, tone] = [st.lastSyncAt ? `Saved ${ago(st.lastSyncAt)}` : 'Saved', 'good'];

  return (
    <a className={`sync-badge sync-${tone}`} href="#/settings" title={st.message ?? 'Sync settings'} role="status">
      <span className="sync-dot" aria-hidden="true" />
      {label}
    </a>
  );
}
