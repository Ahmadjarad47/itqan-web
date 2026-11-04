import { Routes } from '@angular/router';
import { landingUrl, requirePermission } from '@core/auth/permission.guard';

export default [
  { path: '', pathMatch: 'full', redirectTo: () => landingUrl() },
  {
    path: 'roles',
    title: 'الأدوار والصلاحيات',
    canActivate: [requirePermission('admin.roles')],
    loadComponent: () => import('./roles/roles-page').then((m) => m.RolesPage),
  },
  {
    path: 'users',
    title: 'المستخدمون',
    canActivate: [requirePermission('admin.users')],
    loadComponent: () => import('./users/users-page').then((m) => m.UsersPage),
  },
  {
    path: 'fields',
    title: 'الحقول المخصصة',
    canActivate: [requirePermission('admin.fields')],
    loadComponent: () => import('./custom-fields/custom-fields-page').then((m) => m.CustomFieldsPage),
  },
] satisfies Routes;
