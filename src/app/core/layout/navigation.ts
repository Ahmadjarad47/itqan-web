export interface NavItem {
  readonly label: string;
  readonly icon: string;
  readonly link: string;
  readonly exact?: boolean;
}

export interface NavGroup {
  readonly title: string;
  readonly items: readonly NavItem[];
}

export const NAVIGATION: readonly NavGroup[] = [
  {
    title: 'عام',
    items: [{ label: 'لوحة القيادة', icon: 'dashboard', link: '/dashboard' }],
  },
  {
    title: 'الهندسة والتخطيط',
    items: [
      { label: 'المشاريع وشجرة المنتج', icon: 'tree', link: '/projects' },
      { label: 'التكلفة التراكمية', icon: 'coins', link: '/costing' },
    ],
  },
  {
    title: 'سلسلة التوريد',
    items: [
      { label: 'طلبات الشراء', icon: 'cart', link: '/procurement/requests' },
      { label: 'الموردون', icon: 'truck', link: '/procurement/suppliers' },
      { label: 'المستودع', icon: 'warehouse', link: '/inventory' },
    ],
  },
  {
    title: 'الإنتاج',
    items: [
      { label: 'حوض التصنيع والمسارات', icon: 'factory', link: '/production/pool' },
      { label: 'مخطط جانت', icon: 'gantt', link: '/production/gantt' },
    ],
  },
  {
    title: 'تتبع العمليات',
    items: [
      { label: 'إدارة المهام', icon: 'clipboard', link: '/tasks/manage' },
      { label: 'مهامي', icon: 'user-check', link: '/tasks/mine' },
    ],
  },
];
