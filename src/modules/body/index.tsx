import type { Module } from '..';
import { DietPage, FoodEditPage, PlanEditPage } from './pages/Diet';
import { ExerciseDetailPage, ExercisesPage } from './pages/Exercises';
import { MetricsPage } from './pages/Metrics';
import { RoutineEditPage } from './pages/RoutineEdit';
import { SessionBanner, SessionPage } from './pages/Session';
import { SessionDetailPage } from './pages/SessionDetail';
import { TodayPage } from './pages/Today';
import { WorkoutsPage } from './pages/Workouts';

export const bodyModule: Module = {
  id: 'body',
  label: 'Body',
  Banner: SessionBanner,
  nav: [
    { path: '/', label: 'Today', icon: 'today' },
    { path: '/workouts', label: 'Workouts', icon: 'dumbbell' },
    { path: '/diet', label: 'Diet', icon: 'fork' },
    { path: '/metrics', label: 'Metrics', icon: 'chart' },
  ],
  routes: [
    { path: '/', render: () => <TodayPage /> },
    { path: '/workouts', render: () => <WorkoutsPage /> },
    { path: '/workouts/session', render: () => <SessionPage /> },
    { path: '/workouts/exercises', render: () => <ExercisesPage /> },
    { path: '/workouts/exercises/:id', render: (p) => <ExerciseDetailPage id={p.id} /> },
    { path: '/workouts/routine/:id', render: (p) => <RoutineEditPage id={p.id} /> },
    { path: '/workouts/history/:id', render: (p) => <SessionDetailPage id={p.id} /> },
    { path: '/diet', render: () => <DietPage /> },
    { path: '/diet/plans', render: () => <DietPage tab="plans" /> },
    { path: '/diet/foods', render: () => <DietPage tab="foods" /> },
    { path: '/diet/plans/:id', render: (p) => <PlanEditPage id={p.id} /> },
    { path: '/diet/foods/:id', render: (p) => <FoodEditPage id={p.id} /> },
    { path: '/metrics', render: () => <MetricsPage /> },
  ],
};
