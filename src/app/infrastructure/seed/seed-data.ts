import {
  BomNode,
  CustomFieldDefinition,
  Department,
  Employee,
  Material,
  Project,
  PurchaseRequest,
  Role,
  RoutingOperation,
  StockMovement,
  Supplier,
  WorkTask,
  Workstation,
} from '@domain/models';
import { isPurchaseCompleted, todayIso } from '@domain/rules';
import { CUSTOM_FIELDS, ROLES } from './access.seed';
import { DEPARTMENTS, EMPLOYEES, MATERIALS, SUPPLIERS, WORKSTATIONS } from './catalog.seed';
import { seedOperations } from './production.seed';
import { seedProjects } from './projects.seed';
import { seedPurchases } from './procurement.seed';
import { seedTasks } from './tasks.seed';

export interface SeedData {
  readonly projects: Project[];
  readonly nodes: BomNode[];
  readonly materials: Material[];
  readonly movements: StockMovement[];
  readonly suppliers: Supplier[];
  readonly purchases: PurchaseRequest[];
  readonly workstations: Workstation[];
  readonly operations: RoutingOperation[];
  readonly departments: Department[];
  readonly employees: Employee[];
  readonly tasks: WorkTask[];
  readonly roles: Role[];
  readonly customFields: CustomFieldDefinition[];
}

let cached: SeedData | null = null;

/** Builds one consistent demo dataset, anchored on today's date. */
export function seedData(): SeedData {
  if (cached) return cached;

  const today = todayIso();
  const { projects, nodes } = seedProjects(today);
  const purchases = seedPurchases(today, nodes, new Map(projects.map((p) => [p.id, p.productionQuantity])));

  const received = purchases.filter(isPurchaseCompleted);
  const purchasedMaterials: Material[] = received.map((request) => ({
    id: `m-${request.id}`,
    code: nodes.find((n) => n.id === request.nodeId)?.code ?? request.number,
    name: request.title,
    kind: 'purchased',
    unit: request.unit,
    unitCost: request.unitPrice ?? 0,
    stock: request.quantity,
    minStock: 0,
    warehouse: 'مستودع الأجزاء المشتراة',
  }));

  const materials = [...MATERIALS, ...purchasedMaterials];
  const movements: StockMovement[] = [
    ...materials.map((item, index) => ({
      id: `mv-${index + 1}`,
      materialId: item.id,
      type: 'receipt' as const,
      quantity: item.stock,
      reference: item.kind === 'purchased' ? 'استلام شراء' : 'رصيد افتتاحي',
      at: `${today}T07:00:00.000Z`,
    })),
  ];

  cached = {
    projects,
    nodes: nodes.map(withSampleFields),
    materials,
    movements,
    suppliers: SUPPLIERS.map((supplier, i) => ({
      ...supplier,
      customFields: { 'cf-tax': String(400100200 + i * 1371), 'cf-terms': ['30 يوم', 'نقداً', '60 يوم'][i % 3] },
    })),
    purchases,
    workstations: WORKSTATIONS,
    operations: seedOperations(today),
    departments: DEPARTMENTS,
    employees: EMPLOYEES,
    tasks: seedTasks(today),
    roles: ROLES,
    customFields: CUSTOM_FIELDS,
  };
  return cached;
}

const GRADES: Record<string, string> = { 'm-ST37-10': 'ST37', 'm-ST37-3': 'ST37', 'm-SS304-2': 'SS304', 'm-AL6061': 'AL6061', 'm-C45-50': 'C45' };

/** Demo values for the dynamic fields of manufactured parts. */
function withSampleFields(node: BomNode): BomNode {
  const grade = node.materials.map((m) => GRADES[m.materialId]).find(Boolean);
  if (!grade) return node;
  return { ...node, customFields: { 'cf-grade': grade, 'cf-approved': true, 'cf-finish': grade === 'ST37' ? ['دهان إلكتروستاتيكي'] : [] } };
}
