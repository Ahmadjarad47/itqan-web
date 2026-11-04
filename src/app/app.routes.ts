import { Routes } from '@angular/router';
import { landingUrl, requirePermission } from '@core/auth/permission.guard';
import { Shell } from '@core/layout/shell';

export const routes: Routes = [
  {
    path: '',
    component: Shell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: () => landingUrl() },
      {
        path: 'dashboard',
        title: 'لوحة القيادة',
        canActivate: [requirePermission('dashboard.view')],
        loadComponent: () => import('@features/dashboard/dashboard-page').then((m) => m.DashboardPage),
      },
      {
        path: 'projects',
        canActivate: [requirePermission('projects.view')],
        loadChildren: () => import('@features/projects/projects.routes'),
      },
      {
        path: 'costing',
        title: 'التكلفة التراكمية',
        canActivate: [requirePermission('costing.view')],
        loadComponent: () => import('@features/costing/costing-page').then((m) => m.CostingPage),
      },
      {
        path: 'procurement',
        canActivate: [requirePermission('procurement.view')],
        loadChildren: () => import('@features/procurement/procurement.routes'),
      },
      {
        path: 'inventory',
        title: 'المستودع',
        canActivate: [requirePermission('inventory.view')],
        loadComponent: () => import('@features/inventory/inventory-page').then((m) => m.InventoryPage),
      },
      {
        path: 'production',
        canActivate: [requirePermission('production.view')],
        loadChildren: () => import('@features/production/production.routes'),
      },
      { path: 'tasks', loadChildren: () => import('@features/tasks/tasks.routes') },
      { path: 'admin', loadChildren: () => import('@features/admin/admin.routes') },
      {
        path: 'forbidden',
        title: 'غير مصرّح',
        loadComponent: () => import('@core/auth/forbidden-page').then((m) => m.ForbiddenPage),
      },
      { path: '**', redirectTo: () => landingUrl() },
    ],
  },
];
