import { Permission } from '@domain/models';

export interface NavItem {
  readonly label: string;
  readonly icon: string;
  readonly link: string;
  readonly permission: Permission;
}

export interface NavGroup {
  readonly title: string;
  readonly items: readonly NavItem[];
}

export const NAVIGATION: readonly NavGroup[] = [
  {
    title: 'عام',
    items: [{ label: 'لوحة القيادة', icon: 'dashboard', link: '/dashboard', permission: 'dashboard.view' }],
  },
  {
    title: 'الهندسة والتخطيط',
    items: [
      { label: 'المشاريع وشجرة المنتج', icon: 'tree', link: '/projects', permission: 'projects.view' },
      { label: 'التكلفة التراكمية', icon: 'coins', link: '/costing', permission: 'costing.view' },
    ],
  },
  {
    title: 'سلسلة التوريد',
    items: [
      { label: 'طلبات الشراء', icon: 'cart', link: '/procurement/requests', permission: 'procurement.view' },
      { label: 'الموردون', icon: 'truck', link: '/procurement/suppliers', permission: 'procurement.view' },
    ],
  },
  {
    title: 'إدارة المستودعات',
    items: [
      { label: 'لوحة المستودعات', icon: 'warehouse', link: '/warehouse/dashboard', permission: 'inventory.view' },
      { label: 'بطاقات المنتجات', icon: 'package', link: '/warehouse/items', permission: 'inventory.view' },
      { label: 'طلبات التوريد', icon: 'truck', link: '/warehouse/supply', permission: 'inventory.view' },
      { label: 'حركة المستودع', icon: 'refresh', link: '/warehouse/movements', permission: 'inventory.view' },
    ],
  },
  {
    title: 'الإنتاج',
    items: [
      { label: 'حوض التصنيع والمسارات', icon: 'factory', link: '/production/pool', permission: 'production.view' },
      { label: 'مخطط جانت', icon: 'gantt', link: '/production/gantt', permission: 'production.view' },
    ],
  },
  {
    title: 'تتبع العمليات',
    items: [
      { label: 'إدارة المهام', icon: 'clipboard', link: '/tasks/manage', permission: 'tasks.manage' },
      { label: 'مهامي', icon: 'user-check', link: '/tasks/mine', permission: 'tasks.own' },
    ],
  },
  {
    title: 'إدارة النظام',
    items: [
      { label: 'الأدوار والصلاحيات', icon: 'shield', link: '/admin/roles', permission: 'admin.roles' },
      { label: 'المستخدمون', icon: 'users', link: '/admin/users', permission: 'admin.users' },
      { label: 'الحقول المخصصة', icon: 'layers', link: '/admin/fields', permission: 'admin.fields' },
    ],
  },
];
