import { ALL_PERMISSIONS, CustomFieldDefinition, Permission, Role } from '@domain/models';

const VIEW_ALL: Permission[] = ['dashboard.view', 'projects.view', 'costing.view', 'procurement.view', 'inventory.view', 'production.view'];

export const ROLES: Role[] = [
  {
    id: 'r-admin',
    name: 'مدير النظام',
    description: 'صلاحيات كاملة على جميع الوحدات وإدارة النظام',
    color: '#054239',
    permissions: [...ALL_PERMISSIONS],
    system: true,
  },
  {
    id: 'r-production-manager',
    name: 'مدير الإنتاج',
    description: 'التخطيط، قرارات التوريد، المسارات وإدارة المهام',
    color: '#428177',
    permissions: [...VIEW_ALL, 'projects.manage', 'bom.edit', 'bom.decide', 'costing.simulate', 'routing.edit', 'tasks.manage', 'tasks.own'],
    system: true,
  },
  {
    id: 'r-planner',
    name: 'مهندس تخطيط',
    description: 'بناء شجرة المنتج ومسارات الإنتاج',
    color: '#33658a',
    permissions: [...VIEW_ALL, 'bom.edit', 'routing.edit', 'tasks.own'],
    system: false,
  },
  {
    id: 'r-buyer',
    name: 'مسؤول المشتريات',
    description: 'تدفق الشراء وعروض الأسعار والموردون',
    color: '#988561',
    permissions: ['dashboard.view', 'projects.view', 'procurement.view', 'procurement.manage', 'suppliers.manage', 'inventory.view', 'costing.view'],
    system: false,
  },
  {
    id: 'r-storekeeper',
    name: 'أمين المستودع',
    description: 'أرصدة المخزون وحركات الاستلام والصرف',
    color: '#a8741a',
    permissions: ['dashboard.view', 'inventory.view', 'inventory.manage', 'procurement.view'],
    system: false,
  },
  {
    id: 'r-operator',
    name: 'موظف إنتاج',
    description: 'لوحة المهام الشخصية فقط',
    color: '#6b1f2a',
    permissions: ['tasks.own', 'production.view'],
    system: true,
  },
];

const field = (
  id: string,
  entity: CustomFieldDefinition['entity'],
  order: number,
  label: string,
  type: CustomFieldDefinition['type'],
  extra: Partial<CustomFieldDefinition> = {},
): CustomFieldDefinition => ({
  id,
  entity,
  label,
  type,
  required: false,
  options: [],
  placeholder: '',
  unit: '',
  order,
  active: true,
  showInList: false,
  ...extra,
});

export const CUSTOM_FIELDS: CustomFieldDefinition[] = [
  field('cf-weight', 'bomNode', 1, 'الوزن التقديري', 'number', { unit: 'كغ' }),
  field('cf-grade', 'bomNode', 2, 'مادة الصنع', 'select', { options: ['ST37', 'ST52', 'SS304', 'SS316', 'AL6061', 'C45', 'أخرى'] }),
  field('cf-finish', 'bomNode', 3, 'المعالجة السطحية', 'multiselect', { options: ['دهان إلكتروستاتيكي', 'غلفنة', 'أنودة', 'تلميع', 'كروم'] }),
  field('cf-approved', 'bomNode', 4, 'الرسم معتمد هندسياً', 'checkbox'),
  field('cf-tax', 'supplier', 1, 'الرقم الضريبي', 'text', { showInList: true, placeholder: 'مثال: 123456789' }),
  field('cf-terms', 'supplier', 2, 'شروط الدفع', 'select', { options: ['نقداً', '30 يوم', '60 يوم', 'دفعة مقدمة 50%'], showInList: true }),
  field('cf-costcenter', 'purchase', 1, 'مركز التكلفة', 'text', { required: true }),
  field('cf-incoterm', 'purchase', 2, 'شروط التسليم', 'select', { options: ['EXW', 'FOB', 'CIF', 'DAP', 'تسليم المصنع'] }),
  field('cf-location', 'material', 1, 'موقع الرف', 'text', { showInList: true, placeholder: 'A-01-03' }),
  field('cf-tools', 'operation', 1, 'أدوات خاصة مطلوبة', 'textarea'),
];
