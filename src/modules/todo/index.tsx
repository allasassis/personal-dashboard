import type { Module } from '..';
import { TodoPage } from './TodoPage';

export const todoModule: Module = {
  id: 'todo',
  label: 'To-do',
  nav: [{ path: '/todo', label: 'To-do', icon: 'check' }],
  routes: [{ path: '/todo', render: () => <TodoPage /> }],
};
