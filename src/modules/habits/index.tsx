import type { Module } from '..';
import { HabitDetailPage } from './HabitDetailPage';
import { HabitsPage } from './HabitsPage';

export const habitsModule: Module = {
  id: 'habits',
  label: 'Habits',
  nav: [{ path: '/habits', label: 'Habits', icon: 'repeat' }],
  routes: [
    { path: '/habits', render: () => <HabitsPage /> },
    { path: '/habits/:id', render: (p) => <HabitDetailPage id={p.id} /> },
  ],
};
