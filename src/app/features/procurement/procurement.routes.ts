import { Routes } from '@angular/router';

export default [
  { path: '', pathMatch: 'full', redirectTo: 'requests' },
  {
    path: 'requests',
    title: 'طلبات الشراء',
    loadComponent: () => import('./purchase-list/purchase-list-page').then((m) => m.PurchaseListPage),
  },
  {
    path: 'requests/:requestId',
    title: 'متابعة طلب الشراء',
    loadComponent: () => import('./purchase-detail/purchase-detail-page').then((m) => m.PurchaseDetailPage),
  },
  {
    path: 'suppliers',
    title: 'الموردون',
    loadComponent: () => import('./suppliers/suppliers-page').then((m) => m.SuppliersPage),
  },
] satisfies Routes;
