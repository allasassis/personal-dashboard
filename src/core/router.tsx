import { useSyncExternalStore, type ReactNode } from 'react';

// Hash routes work on any static host with no server rewrite rules.
const subscribe = (fn: () => void) => {
  window.addEventListener('hashchange', fn);
  return () => window.removeEventListener('hashchange', fn);
};
const read = () => window.location.hash.slice(1) || '/';

export const usePath = () => useSyncExternalStore(subscribe, read);
export const navigate = (to: string) => void (window.location.hash = to);

export interface Route {
  path: string;
  render: (params: Record<string, string>) => ReactNode;
}

export function matchRoute(routes: Route[], path: string) {
  const parts = path.split('/');
  for (const route of routes) {
    const pattern = route.path.split('/');
    if (pattern.length !== parts.length) continue;
    const params: Record<string, string> = {};
    if (pattern.every((seg, i) => (seg.startsWith(':') ? ((params[seg.slice(1)] = decodeURIComponent(parts[i])), true) : seg === parts[i]))) {
      return { route, params };
    }
  }
  return null;
}
