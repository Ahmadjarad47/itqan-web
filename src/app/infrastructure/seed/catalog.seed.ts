import { Department, Employee, Material, Supplier, Unit, Workstation } from '@domain/models';

export const DEPARTMENTS: Department[] = [
  { id: 'd-laser', name: 'قسم القص بالليزر', icon: 'zap' },
  { id: 'd-bending', name: 'قسم الثني والتشكيل', icon: 'layers' },
  { id: 'd-welding', name: 'قسم اللحام والتشطيب', icon: 'flame' },
  { id: 'd-machining', name: 'قسم التشغيل CNC', icon: 'cog' },
  { id: 'd-assembly', name: 'قسم التجميع', icon: 'wrench' },
  { id: 'd-electrical', name: 'قسم الكهرباء والأتمتة', icon: 'cpu' },
  { id: 'd-quality', name: 'قسم مراقبة الجودة', icon: 'shield' },
  { id: 'd-management', name: 'الإدارة العامة', icon: 'building' },
  { id: 'd-planning', name: 'قسم التخطيط والهندسة', icon: 'tree' },
  { id: 'd-procurement', name: 'قسم المشتريات', icon: 'cart' },
  { id: 'd-warehouse', name: 'قسم المستودعات', icon: 'warehouse' },
];

const employee = (id: string, name: string, title: string, departmentId: string, roleId: string): Employee => ({
  id,
  name,
  title,
  departmentId,
  roleId,
  email: `${id}@factory.example`,
  active: true,
});

export const EMPLOYEES: Employee[] = [
  employee('u-admin', 'م. نادر العبدالله', 'مدير النظام', 'd-management', 'r-admin'),
  employee('u-pm', 'م. سامر الحلبي', 'مدير الإنتاج والتخطيط', 'd-management', 'r-production-manager'),
  employee('u-eng', 'م. ريم الصباغ', 'مهندسة تخطيط', 'd-planning', 'r-planner'),
  employee('u-buyer', 'ليث المصري', 'مسؤول المشتريات', 'd-procurement', 'r-buyer'),
  employee('u-store', 'جمال قدور', 'أمين المستودع', 'd-warehouse', 'r-storekeeper'),
  employee('e-1', 'أحمد الخطيب', 'فني قص ليزر', 'd-laser', 'r-operator'),
  employee('e-2', 'محمد العلي', 'فني ثني وتشكيل', 'd-bending', 'r-operator'),
  employee('e-3', 'خالد الشامي', 'لحّام MIG', 'd-welding', 'r-operator'),
  employee('e-4', 'يوسف دياب', 'لحّام TIG', 'd-welding', 'r-operator'),
  employee('e-5', 'رامي حداد', 'مشغل CNC', 'd-machining', 'r-operator'),
  employee('e-6', 'عمر السيد', 'فني تجميع', 'd-assembly', 'r-operator'),
  employee('e-7', 'لؤي منصور', 'فني كهرباء', 'd-electrical', 'r-operator'),
  employee('e-8', 'رنا الأحمد', 'مهندسة جودة', 'd-quality', 'r-operator'),
  employee('e-9', 'هبة النجار', 'مهندسة أتمتة', 'd-electrical', 'r-operator'),
];

export const WORKSTATIONS: Workstation[] = [
  { id: 'ws-saw', code: 'WS-SAW-01', name: 'منشار شريطي آلي', hourlyRate: 18, departmentId: 'd-laser' },
  { id: 'ws-laser', code: 'WS-LZR-01', name: 'ليزر فايبر 6 كيلوواط', hourlyRate: 45, departmentId: 'd-laser' },
  { id: 'ws-press', code: 'WS-ABK-01', name: 'مكبس ثني Abkant 160 طن', hourlyRate: 30, departmentId: 'd-bending' },
  { id: 'ws-mig', code: 'WS-MIG-01', name: 'محطة لحام غازي MIG', hourlyRate: 25, departmentId: 'd-welding' },
  { id: 'ws-tig', code: 'WS-TIG-01', name: 'محطة لحام TIG', hourlyRate: 28, departmentId: 'd-welding' },
  { id: 'ws-grind', code: 'WS-GRD-01', name: 'محطة تجليخ وصنفرة', hourlyRate: 15, departmentId: 'd-welding' },
  { id: 'ws-lathe', code: 'WS-CNC-01', name: 'مخرطة CNC', hourlyRate: 40, departmentId: 'd-machining' },
  { id: 'ws-mill', code: 'WS-MIL-01', name: 'فريزة CNC خماسية المحاور', hourlyRate: 55, departmentId: 'd-machining' },
  { id: 'ws-assembly', code: 'WS-ASM-01', name: 'خط التجميع الميكانيكي', hourlyRate: 20, departmentId: 'd-assembly' },
  { id: 'ws-panel', code: 'WS-ELC-01', name: 'منصة تجميع اللوحات الكهربائية', hourlyRate: 22, departmentId: 'd-electrical' },
  { id: 'ws-qc', code: 'WS-QC-01', name: 'مختبر الجودة والقياس', hourlyRate: 30, departmentId: 'd-quality' },
];

const material = (
  code: string,
  name: string,
  kind: Material['kind'],
  unit: Unit,
  unitCost: number,
  stock: number,
  minStock: number,
  warehouse: string,
): Material => ({ id: `m-${code}`, code, name, kind, unit, unitCost, stock, minStock, warehouse });

export const MATERIALS: Material[] = [
  material('ST37-10', 'صاج فولاذي ST37 سماكة 10 مم', 'raw', 'kg', 1.1, 2400, 800, 'مستودع المعادن'),
  material('ST37-3', 'صاج فولاذي ST37 سماكة 3 مم', 'raw', 'kg', 1.15, 1350, 500, 'مستودع المعادن'),
  material('SS304-2', 'صاج ستانلس 304 سماكة 2 مم', 'raw', 'kg', 4.2, 320, 200, 'مستودع المعادن'),
  material('PRF-80', 'بروفيل فولاذي 80×80×4', 'raw', 'm', 9.5, 140, 60, 'مستودع المعادن'),
  material('PRF-40', 'بروفيل فولاذي 40×40×3', 'raw', 'm', 4.8, 220, 80, 'مستودع المعادن'),
  material('C45-50', 'قضيب مدور C45 قطر 50 مم', 'raw', 'kg', 1.6, 610, 250, 'مستودع المعادن'),
  material('AL6061', 'ألمنيوم 6061 مسحوب', 'raw', 'kg', 5.5, 95, 120, 'مستودع المعادن'),
  material('CBL-2.5', 'كابل نحاسي 2.5 مم²', 'raw', 'm', 0.9, 900, 300, 'مستودع الكهرباء'),
  material('HOSE-12', 'خرطوم هيدروليكي 1/2 إنش', 'raw', 'm', 6, 45, 30, 'مستودع الهيدروليك'),
  material('SAND-80', 'ورق صنفرة P80', 'consumable', 'pcs', 0.6, 380, 150, 'مستودع المستهلكات'),
  material('FLAP-125', 'قرص رفراف 125 مم', 'consumable', 'pcs', 2.4, 42, 60, 'مستودع المستهلكات'),
  material('CUT-115', 'قرص قص 115 مم', 'consumable', 'pcs', 1.2, 210, 80, 'مستودع المستهلكات'),
  material('WIRE-08', 'سلك لحام MIG قطر 0.8 مم', 'consumable', 'kg', 3.2, 160, 50, 'مستودع المستهلكات'),
  material('GAS-MIX', 'غاز حماية Ar/CO₂', 'consumable', 'l', 0.05, 12000, 4000, 'مستودع المستهلكات'),
  material('PAINT-01', 'دهان إيبوكسي أساس', 'consumable', 'l', 9, 75, 40, 'مستودع المستهلكات'),
];

export const SUPPLIERS: Supplier[] = [
  { id: 's-1', name: 'شركة دمشق للمعادن', category: 'معادن وصاج', rating: 4, contactPerson: 'م. باسل عيسى', phone: '+963 11 555 0101', email: 'sales@damascus-metals.example', city: 'دمشق' },
  { id: 's-2', name: 'مؤسسة حلب للتجهيزات الكهربائية', category: 'مكونات كهربائية', rating: 5, contactPerson: 'ماهر زيدان', phone: '+963 21 555 0144', email: 'info@aleppo-electric.example', city: 'حلب' },
  { id: 's-3', name: 'الشركة المتحدة للأتمتة الصناعية', category: 'إلكترونيات وأتمتة', rating: 4, contactPerson: 'م. لينا حمدان', phone: '+963 11 555 0177', email: 'contact@united-automation.example', city: 'دمشق' },
  { id: 's-4', name: 'مؤسسة الساحل للأنظمة الهوائية', category: 'أنظمة هوائية', rating: 3, contactPerson: 'جورج خوري', phone: '+963 41 555 0123', email: 'orders@sahel-pneumatics.example', city: 'اللاذقية' },
  { id: 's-5', name: 'الشركة الوطنية للهيدروليك', category: 'أنظمة هيدروليكية', rating: 4, contactPerson: 'م. فادي سليمان', phone: '+963 31 555 0190', email: 'sales@national-hydraulics.example', city: 'حمص' },
  { id: 's-6', name: 'مستودعات البراغي الحديثة', category: 'عناصر ربط وتثبيت', rating: 3, contactPerson: 'نزار الحمصي', phone: '+963 33 555 0112', email: 'info@modern-fasteners.example', city: 'حماة' },
  { id: 's-7', name: 'شركة الأمل للدهانات الصناعية', category: 'دهانات ومعالجة سطوح', rating: 4, contactPerson: 'سامي العمر', phone: '+963 11 555 0165', email: 'service@amal-coatings.example', city: 'ريف دمشق' },
  { id: 's-8', name: 'ورشة الدقة للخراطة', category: 'خدمات تصنيع خارجية', rating: 5, contactPerson: 'أبو محمد الدقاق', phone: '+963 21 555 0138', email: 'workshop@precision-turning.example', city: 'حلب' },
  { id: 's-9', name: 'الشرق لتقنيات التحكم', category: 'إلكترونيات وأتمتة', rating: 3, contactPerson: 'م. علا يوسف', phone: '+963 11 555 0150', email: 'sales@east-controls.example', city: 'دمشق' },
];
