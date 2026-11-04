import { Routes } from '@angular/router';
import { Shell } from '@core/layout/shell';

export const routes: Routes = [
  {
    path: '',
    component: Shell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'لوحة القيادة',
        loadComponent: () => import('@features/dashboard/dashboard-page').then((m) => m.DashboardPage),
      },
      { path: 'projects', loadChildren: () => import('@features/projects/projects.routes') },
      {
        path: 'costing',
        title: 'التكلفة التراكمية',
        loadComponent: () => import('@features/costing/costing-page').then((m) => m.CostingPage),
      },
      { path: 'procurement', loadChildren: () => import('@features/procurement/procurement.routes') },
      {
        path: 'inventory',
        title: 'المستودع',
        loadComponent: () => import('@features/inventory/inventory-page').then((m) => m.InventoryPage),
      },
      { path: 'production', loadChildren: () => import('@features/production/production.routes') },
      { path: 'tasks', loadChildren: () => import('@features/tasks/tasks.routes') },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
