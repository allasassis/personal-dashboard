import type { Module } from '..';
import { NotePage } from './pages/Note';
import { NotebookPage, NotebooksPage } from './pages/Notebooks';
import { WeekPage } from './pages/Week';

export const studiesModule: Module = {
  id: 'studies',
  label: 'Studies',
  nav: [
    { path: '/studies', label: 'Week', icon: 'calendar' },
    { path: '/studies/notebooks', label: 'Notebooks', icon: 'book' },
  ],
  routes: [
    { path: '/studies', render: () => <WeekPage /> },
    { path: '/studies/notebooks', render: () => <NotebooksPage /> },
    { path: '/studies/notebooks/:id', render: (p) => <NotebookPage id={p.id} /> },
    { path: '/studies/notebooks/:id/:noteId', render: (p) => <NotePage notebookId={p.id} noteId={p.noteId} /> },
  ],
};
