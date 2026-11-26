import { Entity } from './common';

/** Every action the UI can authorise. Format: `<module>.<action>`. */
export type Permission =
  | 'dashboard.view'
  | 'projects.view'
  | 'projects.manage'
  | 'bom.edit'
  | 'bom.decide'
  | 'costing.view'
  | 'costing.simulate'
  | 'procurement.view'
  | 'procurement.manage'
  | 'suppliers.manage'
  | 'inventory.view'
  | 'inventory.manage'
  | 'warehouses.manage'
  | 'production.view'
  | 'routing.edit'
  | 'tasks.manage'
  | 'tasks.own'
  | 'admin.roles'
  | 'admin.users'
  | 'admin.fields';

export interface PermissionInfo {
  readonly key: Permission;
  readonly label: string;
  readonly hint: string;
}

export interface PermissionGroup {
  readonly module: string;
  readonly icon: string;
  readonly permissions: readonly PermissionInfo[];
}

export const PERMISSION_GROUPS: readonly PermissionGroup[] = [
  {
    module: 'لوحة القيادة',
    icon: 'dashboard',
    permissions: [{ key: 'dashboard.view', label: 'عرض لوحة القيادة', hint: 'المؤشرات العامة وتقدم المشاريع' }],
  },
  {
    module: 'المشاريع وشجرة المنتج',
    icon: 'tree',
    permissions: [
      { key: 'projects.view', label: 'عرض المشاريع والشجرة', hint: 'تصفح المستويات وتفاصيل المكونات' },
      { key: 'projects.manage', label: 'إدارة المشاريع', hint: 'إنشاء المشاريع وتعديل كمية الإنتاج' },
      { key: 'bom.edit', label: 'تحرير شجرة المنتج', hint: 'إضافة وتعديل وحذف المكونات والملفات والمواد' },
      { key: 'bom.decide', label: 'قرار التصنيع / الشراء', hint: 'تحديد MAKE أو BUY للمكونات' },
    ],
  },
  {
    module: 'التكلفة التراكمية',
    icon: 'coins',
    permissions: [
      { key: 'costing.view', label: 'عرض تقارير التكلفة', hint: 'التكلفة التراكمية حسب الشجرة' },
      { key: 'costing.simulate', label: 'تعديل الأسعار ومحاكاتها', hint: 'تغيير أسعار المواد وأسعار الشراء' },
    ],
  },
  {
    module: 'الشراء والموردون',
    icon: 'cart',
    permissions: [
      { key: 'procurement.view', label: 'عرض طلبات الشراء', hint: 'القوائم وحالة كل طلب' },
      { key: 'procurement.manage', label: 'إدارة تدفق الشراء', hint: 'المراحل، عروض الأسعار، MCDM، الشراء المستقل' },
      { key: 'suppliers.manage', label: 'إدارة الموردين', hint: 'إضافة وتعديل وحذف الموردين' },
    ],
  },
  {
    module: 'إدارة المستودعات',
    icon: 'warehouse',
    permissions: [
      { key: 'inventory.view', label: 'عرض المستودعات والمخزون', hint: 'لوحة المستودعات، البطاقات، الحركات والتقارير' },
      { key: 'inventory.manage', label: 'حركات المخزون وبطاقات المنتجات', hint: 'إنشاء البطاقات، الوارد والصادر، المناقلة والإتلاف، طلبات الاحتياج والتوريد' },
      { key: 'warehouses.manage', label: 'إدارة المستودعات', hint: 'إنشاء المستودعات والرفوف وترميزها والقوائم المنسدلة' },
    ],
  },
  {
    module: 'الإنتاج',
    icon: 'factory',
    permissions: [
      { key: 'production.view', label: 'عرض الإنتاج وجانت', hint: 'حوض التصنيع والمسارات ومخطط جانت' },
      { key: 'routing.edit', label: 'تحرير مسارات الإنتاج', hint: 'العمليات، التقدم، الجودة' },
    ],
  },
  {
    module: 'تتبع المهام',
    icon: 'clipboard',
    permissions: [
      { key: 'tasks.manage', label: 'إدارة المهام (شاشة المدير)', hint: 'إنشاء وإسناد وأرشفة المهام' },
      { key: 'tasks.own', label: 'مهامي (شاشة الموظف)', hint: 'استلام وتنفيذ المهام الشخصية' },
    ],
  },
  {
    module: 'إدارة النظام',
    icon: 'shield',
    permissions: [
      { key: 'admin.roles', label: 'إدارة الأدوار والصلاحيات', hint: 'إنشاء الأدوار وتحديد صلاحياتها' },
      { key: 'admin.users', label: 'إدارة المستخدمين', hint: 'إضافة المستخدمين وإسناد الأدوار' },
      { key: 'admin.fields', label: 'الحقول المخصصة', hint: 'تعريف حقول ديناميكية للكيانات' },
    ],
  },
];

export const ALL_PERMISSIONS: readonly Permission[] = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key));

export interface Role extends Entity {
  readonly name: string;
  readonly description: string;
  readonly color: string;
  readonly permissions: readonly Permission[];
  /** Built-in roles cannot be deleted. */
  readonly system: boolean;
}

/** Id of the built-in administrator role; it always keeps every permission. */
export const ADMIN_ROLE_ID = 'r-admin';

export const ROLE_COLORS = ['#054239', '#428177', '#988561', '#6b1f2a', '#3d3a3b', '#33658a', '#a8741a'] as const;
