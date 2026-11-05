import type { Rec } from '../../core/collection';
import { defineCollection } from '../../core/store';
import { addDays } from '../../core/dates';

export interface StudyTask extends Rec {
  title: string;
  date: string;
  time?: string;
  minutes: number;
  notebookId: string | null;
  done: boolean;
  notes?: string;
}

export interface Notebook extends Rec {
  name: string;
  description?: string;
  coverKind: 'art' | 'upload' | 'url';
  art: string;
  coverUrl?: string;
}

export interface Note extends Rec {
  notebookId: string;
  title: string;
  body: string;
  pinned?: boolean;
  createdAt: number;
}

/** Uploaded covers have their own file, so renaming a notebook doesn't resend every image. */
export interface Cover extends Rec {
  dataUrl: string;
}

export const studyTasks = defineCollection<StudyTask>('studies/plan');
export const notebooks = defineCollection<Notebook>('studies/notebooks');
export const notes = defineCollection<Note>('studies/notes', { pushDelay: 20_000 });
export const covers = defineCollection<Cover>('studies/covers');

export const dayTasks = (tasks: StudyTask[], day: string) =>
  tasks
    .filter((t) => t.date === day)
    .sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99') || a.title.localeCompare(b.title));

export const weekDays = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

export const sumMinutes = (tasks: StudyTask[]) => tasks.reduce((n, t) => n + t.minutes, 0);

export const fmtMinutes = (m: number) => {
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`;
};

/** Deleting a notebook takes its notes along. Plan tasks stay, without the link. */
export function deleteNotebook(id: string) {
  for (const n of notes.list()) if (n.notebookId === id) notes.remove(n.id);
  if (covers.get(id)) covers.put({ id, dataUrl: '' });
  notebooks.remove(id);
}

export const excerpt = (body: string) =>
  body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links show their text, not the URL
    .replace(/[#>*_`|[\]-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
