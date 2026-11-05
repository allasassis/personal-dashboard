import { useRef } from 'react';
import { matchRoute, usePath, type Route } from './core/router';
import { Empty, Icon } from './core/ui';
import { modules } from './modules';
import { SettingsPage } from './settings/SettingsPage';
import { SyncBadge } from './settings/SyncBadge';

const routes: Route[] = [...modules.flatMap((m) => m.routes), { path: '/settings', render: () => <SettingsPage /> }];

const matches = (navPath: string, path: string) => (navPath === '/' ? path === '/' : path === navPath || path.startsWith(navPath + '/'));

/** The most specific entry wins, so /studies/notebooks doesn't also light up /studies. */
const activeNavPath = (path: string) =>
  modules
    .flatMap((m) => m.nav)
    .filter((n) => matches(n.path, path))
    .sort((a, b) => b.path.length - a.path.length)[0]?.path;

export function App() {
  const path = usePath();
  const match = matchRoute(routes, path);
  const active = activeNavPath(path);
  // Phones show one module's tabs at a time. Settings belongs to no module, so it keeps the last one.
  const lastModule = useRef(modules[0]);
  lastModule.current = modules.find((m) => m.routes.some((r) => matchRoute([r], path))) ?? lastModule.current;
  const current = lastModule.current;

  return (
    <div className="shell">
      <aside className="rail">
        <a className="brand" href="#/">
          Dashboard
        </a>
        {modules.map((m) => (
          <nav key={m.id} aria-label={m.label}>
            <p className="rail-group">{m.label}</p>
            {m.nav.map((n) => (
              <a key={n.path} href={`#${n.path}`} className="rail-link" aria-current={n.path === active ? 'page' : undefined}>
                <Icon name={n.icon} />
                {n.label}
              </a>
            ))}
          </nav>
        ))}
        <div className="rail-foot">
          <a href="#/settings" className="rail-link" aria-current={path === '/settings' ? 'page' : undefined}>
            <Icon name="settings" />
            Settings
          </a>
          <SyncBadge />
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <nav className="module-tabs" aria-label="Modules">
            {modules.map((m) => (
              <a key={m.id} href={`#${m.nav[0].path}`} aria-current={m.id === current.id ? 'true' : undefined}>
                {m.label}
              </a>
            ))}
          </nav>
          <SyncBadge />
          <a className="icon-btn" href="#/settings" aria-label="Settings">
            <Icon name="settings" size={18} />
          </a>
        </div>
        {modules.map((m) => m.Banner && <m.Banner key={m.id} />)}
        <main className="page" key={path}>
          {match ? (
            match.route.render(match.params)
          ) : (
            <Empty title="Page not found">
              <a href="#/">Go to Today</a>
            </Empty>
          )}
        </main>
      </div>

      {current.nav.length > 1 && (
      <nav className="tabbar" aria-label="Main">
        {current.nav.map((n) => (
          <a key={n.path} href={`#${n.path}`} aria-current={n.path === active ? 'page' : undefined}>
            <Icon name={n.icon} />
            <span>{n.label}</span>
          </a>
        ))}
      </nav>
      )}
    </div>
  );
}
