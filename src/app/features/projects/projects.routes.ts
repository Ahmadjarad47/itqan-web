import { Routes } from '@angular/router';

export default [
  {
    path: '',
    title: 'المشاريع',
    loadComponent: () => import('./project-list/project-list-page').then((m) => m.ProjectListPage),
  },
  {
    path: ':projectId',
    title: 'شجرة المنتج',
    loadComponent: () => import('./bom-explorer/bom-explorer-page').then((m) => m.BomExplorerPage),
  },
  {
    path: ':projectId/items/:nodeId',
    title: 'تفاصيل المكون',
    loadComponent: () => import('./item-detail/item-detail-page').then((m) => m.ItemDetailPage),
  },
] satisfies Routes;
