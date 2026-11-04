import {
  BomNode,
  Department,
  Employee,
  Material,
  Project,
  PurchaseRequest,
  RoutingOperation,
  StockMovement,
  Supplier,
  WorkTask,
  Workstation,
} from '@domain/models';
import { isPurchaseCompleted, todayIso } from '@domain/rules';
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
    nodes,
    materials,
    movements,
    suppliers: SUPPLIERS,
    purchases,
    workstations: WORKSTATIONS,
    operations: seedOperations(today),
    departments: DEPARTMENTS,
    employees: EMPLOYEES,
    tasks: seedTasks(today),
  };
  return cached;
}
