import { Routes } from '@angular/router';

export default [
  { path: '', pathMatch: 'full', redirectTo: 'pool' },
  {
    path: 'pool',
    title: 'حوض التصنيع',
    loadComponent: () => import('./make-pool/make-pool-page').then((m) => m.MakePoolPage),
  },
  {
    path: 'routing/:nodeId',
    title: 'جدول مسار الإنتاج',
    loadComponent: () => import('./routing-editor/routing-editor-page').then((m) => m.RoutingEditorPage),
  },
  {
    path: 'gantt',
    title: 'مخطط جانت',
    loadComponent: () => import('./gantt/gantt-page').then((m) => m.GanttPage),
  },
] satisfies Routes;
