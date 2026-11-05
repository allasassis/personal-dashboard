import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// The GitHub token lives in this page, so the production build only allows scripts
// from itself and only talks to GitHub. Added at build time because Vite's dev
// server needs inline scripts and a websocket.
const CSP = [
  "default-src 'self'",
  "connect-src 'self' https://api.github.com",
  'img-src https: data:',
  "style-src 'self' 'unsafe-inline'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const csp = (): Plugin => ({
  name: 'inject-csp',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
  ],
});

export default defineConfig({
  base: './', // works at any path, e.g. username.github.io/personal-dashboard/
  plugins: [react(), csp()],
  test: { environment: 'node' },
} as never);
