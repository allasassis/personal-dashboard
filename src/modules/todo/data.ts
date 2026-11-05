import type { Rec } from '../../core/collection';
import { defineCollection } from '../../core/store';
import { addDays } from '../../core/dates';

export interface Todo extends Rec {
  title: string;
  due: string | null;
  priority: boolean;
  notes?: string;
  done: boolean;
  doneAt: number | null;
  createdAt: number;
}

export const todos = defineCollection<Todo>('todo/tasks');

/** Priority first, then the soonest date, then oldest first. */
export const sortTodos = (list: Todo[]) =>
  [...list].sort(
    (a, b) =>
      Number(b.priority) - Number(a.priority) ||
      (a.due ?? '9999').localeCompare(b.due ?? '9999') ||
      a.createdAt - b.createdAt,
  );

export function groupTodos(list: Todo[], today: string) {
  const open = sortTodos(list.filter((t) => !t.done));
  const tomorrow = addDays(today, 1);
  return [
    { title: 'Overdue', items: open.filter((t) => t.due && t.due < today) },
    { title: 'Today', items: open.filter((t) => t.due === today) },
    { title: 'Tomorrow', items: open.filter((t) => t.due === tomorrow) },
    { title: 'Upcoming', items: open.filter((t) => t.due && t.due > tomorrow) },
    { title: 'No date', items: open.filter((t) => !t.due) },
  ].filter((g) => g.items.length > 0);
}

export const setDone = (todo: Todo, done: boolean) => todos.put({ ...todo, done, doneAt: done ? Date.now() : null });
