import { useState, type FormEvent } from 'react';
import { engine, useSyncStatus } from '../core/store';
import { parseRepo } from '../core/github';
import { Button, ConfirmButton, Field, Icon, PageHead } from '../core/ui';

const NEW_REPO = 'https://github.com/new?name=dashboard-data&visibility=private&description=Data%20for%20my%20personal%20dashboard';
const NEW_TOKEN = 'https://github.com/settings/personal-access-tokens/new?name=Personal%20dashboard&description=Reads%20and%20writes%20my%20dashboard%20data&contents=write';

export function ConnectForm({ onDone }: { onDone?: () => void }) {
  const [repo, setRepo] = useState(engine.config ? `${engine.config.owner}/${engine.config.repo}` : '');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseRepo(repo);
    if (!parsed) return setError('Enter the repo as owner/name, or paste its GitHub URL.');
    if (!token.trim()) return setError('Paste the token too. Private repos cannot be reached without one.');
    setBusy(true);
    setError(null);
    try {
      await engine.connect({ ...parsed, token: token.trim() });
      setToken('');
      onDone?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack" onSubmit={submit}>
      <ol className="steps">
        <li>
          <a href={NEW_REPO} target="_blank" rel="noreferrer">
            Create a private repo
          </a>{' '}
          for your data. It can stay empty.
        </li>
        <li>
          <a href={NEW_TOKEN} target="_blank" rel="noreferrer">
            Create a fine-grained token
          </a>
          . Under Repository access, pick <em>Only select repositories</em> and choose that repo. Under Permissions, set Contents to <em>Read and write</em>.
        </li>
        <li>Paste both below.</li>
      </ol>
      <Field label="Data repo">
        <input className="input" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="https://github.com/you/dashboard-data" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      </Field>
      <Field label="Access token" hint="Kept only in this browser, and sent only to GitHub. Each device needs it once.">
        <input className="input" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_…" autoComplete="off" spellCheck={false} />
      </Field>
      {error && (
        <p className="notice notice-bad" role="alert">
          <Icon name="alert" size={18} />
          {error}
        </p>
      )}
      <div>
        <Button variant="primary" type="submit" disabled={busy}>
          {busy ? 'Connecting…' : 'Connect'}
        </Button>
      </div>
    </form>
  );
}

export function SettingsPage() {
  const st = useSyncStatus();
  const cfg = engine.config;
  const [replacing, setReplacing] = useState(false);

  return (
    <>
      <PageHead title="Settings" />
      <section className="card stack">
        <h2>GitHub sync</h2>
        {cfg && !replacing ? (
          <>
            <dl className="facts">
              <div>
                <dt>Repo</dt>
                <dd>
                  <a href={`https://github.com/${cfg.owner}/${cfg.repo}`} target="_blank" rel="noreferrer">
                    {cfg.owner}/{cfg.repo}
                  </a>
                </dd>
              </div>
              <div>
                <dt>Waiting to send</dt>
                <dd className="num">{st.pending ? `${st.pending} file${st.pending > 1 ? 's' : ''}` : 'Nothing'}</dd>
              </div>
              {st.lastSyncAt && (
                <div>
                  <dt>Last sync</dt>
                  <dd>{new Date(st.lastSyncAt).toLocaleString()}</dd>
                </div>
              )}
            </dl>
            {st.message && (
              <p className={`notice ${st.state === 'error' ? 'notice-bad' : 'notice-warn'}`} role="alert">
                <Icon name="alert" size={18} />
                {st.message}
              </p>
            )}
            <div className="row wrap">
              <Button onClick={() => engine.sync()} disabled={st.state === 'syncing'}>
                <Icon name="sync" size={16} /> Sync now
              </Button>
              <Button onClick={() => setReplacing(true)}>Change repo or token</Button>
              <ConfirmButton onConfirm={() => engine.disconnect()}>Disconnect</ConfirmButton>
            </div>
          </>
        ) : (
          <>
            <ConnectForm onDone={() => setReplacing(false)} />
            {replacing && <Button variant="plain" onClick={() => setReplacing(false)}>Cancel</Button>}
          </>
        )}
      </section>

      <section className="card stack">
        <h2>This device</h2>
        <p className="muted">Removes the token and the copy of your data held in this browser. Your GitHub repo is not touched. Changes that have not been sent yet are lost.</p>
        <div>
          <ConfirmButton confirmLabel="Tap again to erase" onConfirm={() => engine.eraseLocal()}>
            Erase from this device
          </ConfirmButton>
        </div>
      </section>
    </>
  );
}
