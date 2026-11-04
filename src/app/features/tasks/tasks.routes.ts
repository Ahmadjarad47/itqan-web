import { Routes } from '@angular/router';
import { landingUrl, requirePermission } from '@core/auth/permission.guard';

export default [
  { path: '', pathMatch: 'full', redirectTo: () => landingUrl() },
  {
    path: 'manage',
    title: 'إدارة المهام',
    canActivate: [requirePermission('tasks.manage')],
    loadComponent: () => import('./task-manager/task-manager-page').then((m) => m.TaskManagerPage),
  },
  {
    path: 'mine',
    title: 'مهامي',
    canActivate: [requirePermission('tasks.own')],
    loadComponent: () => import('./my-tasks/my-tasks-page').then((m) => m.MyTasksPage),
  },
] satisfies Routes;
