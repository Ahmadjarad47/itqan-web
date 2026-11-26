import {
  BomNode,
  CatalogOption,
  CustomFieldDefinition,
  Department,
  Employee,
  Material,
  Project,
  Program,
  ProjectModel,
  PurchaseRequest,
  Requisition,
  Role,
  RoutingOperation,
  StockMovement,
  Supplier,
  Warehouse,
  WorkTask,
  Workstation,
} from '@domain/models';
import { isPurchaseCompleted, todayIso } from '@domain/rules';
import { CUSTOM_FIELDS, ROLES } from './access.seed';
import { DEPARTMENTS, EMPLOYEES, MATERIALS, SUPPLIERS, WORKSTATIONS } from './catalog.seed';
import { seedOperations } from './production.seed';
import { seedModels, seedPrograms } from './hierarchy.seed';
import { seedProjects } from './projects.seed';
import { seedPurchases } from './procurement.seed';
import { seedTasks } from './tasks.seed';
import { CATALOG_OPTIONS, seedInventory, seedRequisitions, seedWarehouses } from './warehouse.seed';

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
  readonly programs: Program[];
  readonly models: ProjectModel[];
  readonly warehouses: Warehouse[];
  readonly catalogOptions: CatalogOption[];
  readonly requisitions: Requisition[];
}

let cached: SeedData | null = null;

/** Builds one consistent demo dataset, anchored on today's date. */
export function seedData(): SeedData {
  if (cached) return cached;

  const today = todayIso();
  const { projects, nodes } = seedProjects(today);
  const purchases = seedPurchases(today, nodes, new Map(projects.map((p) => [p.id, p.productionQuantity])));

  const received = purchases.filter(isPurchaseCompleted);
  const purchasedCodes = new Map(received.map((r) => [r.id, nodes.find((n) => n.id === r.nodeId)?.code ?? r.number]));
  const { materials, movements } = seedInventory(today, MATERIALS, received, purchasedCodes);

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
    programs: seedPrograms(today),
    models: seedModels(today),
    warehouses: seedWarehouses(today),
    catalogOptions: CATALOG_OPTIONS,
    requisitions: seedRequisitions(today),
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
