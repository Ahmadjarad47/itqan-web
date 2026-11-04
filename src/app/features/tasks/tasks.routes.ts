import { Routes } from '@angular/router';

export default [
  { path: '', pathMatch: 'full', redirectTo: 'manage' },
  {
    path: 'manage',
    title: 'إدارة المهام',
    loadComponent: () => import('./task-manager/task-manager-page').then((m) => m.TaskManagerPage),
  },
  {
    path: 'mine',
    title: 'مهامي',
    loadComponent: () => import('./my-tasks/my-tasks-page').then((m) => m.MyTasksPage),
  },
] satisfies Routes;
