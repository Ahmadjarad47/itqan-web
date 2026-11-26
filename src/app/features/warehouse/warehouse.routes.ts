import { Routes } from '@angular/router';

export default [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    title: 'لوحة المستودعات',
    loadComponent: () => import('./dashboard/warehouse-dashboard-page').then((m) => m.WarehouseDashboardPage),
  },
  {
    path: 'sites/:warehouseId',
    title: 'تفاصيل المستودع',
    loadComponent: () => import('./warehouse-detail/warehouse-detail-page').then((m) => m.WarehouseDetailPage),
  },
  {
    path: 'items',
    title: 'بطاقات المنتجات',
    loadComponent: () => import('./items/item-list-page').then((m) => m.ItemListPage),
  },
  {
    path: 'items/:materialId',
    title: 'بطاقة المنتج',
    loadComponent: () => import('./item-card/item-card-page').then((m) => m.ItemCardPage),
  },
  {
    path: 'supply',
    title: 'طلبات التوريد للمستودعات',
    loadComponent: () => import('./supply/supply-requests-page').then((m) => m.SupplyRequestsPage),
  },
  {
    path: 'movements',
    title: 'حركة المستودع',
    loadComponent: () => import('./movements/movements-page').then((m) => m.MovementsPage),
  },
] satisfies Routes;
