import { createRoot } from 'react-dom/client';
import '@fontsource-variable/archivo/wdth.css';
import './styles.css';
import { App } from './App';
import { engine } from './core/store';

// Collections register when the modules are imported by App, before this runs.
await engine.load();
createRoot(document.getElementById('root')!).render(<App />);
engine.start();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    /* the app works online without it */
  });
}
