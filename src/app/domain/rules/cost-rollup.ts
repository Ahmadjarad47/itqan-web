import { EntityId, Material, RoutingOperation, Workstation } from '../models';
import { BomTree } from './bom-tree';

export interface CostContext {
  readonly tree: BomTree;
  readonly operationsByNode: ReadonlyMap<EntityId, readonly RoutingOperation[]>;
  readonly materials: ReadonlyMap<EntityId, Material>;
  readonly workstations: ReadonlyMap<EntityId, Workstation>;
  /** End-product units to be produced; used to amortise setup time. */
  readonly productionQuantity: number;
}

export interface OperationCost {
  readonly labor: number;
  readonly consumables: number;
  readonly subcontract: number;
  readonly total: number;
}

export interface CostLine {
  readonly nodeId: EntityId;
  readonly level: number;
  readonly quantity: number;
  /** Purchase price and directly assigned raw materials of this node. */
  readonly ownMaterial: number;
  /** Sum of child unit costs multiplied by their usage quantity. */
  readonly childrenCost: number;
  readonly materialCost: number;
  readonly operationCost: number;
  readonly unitCost: number;
  readonly extendedCost: number;
  readonly children: readonly CostLine[];
}

/** Per-unit cost of a single routing operation. Setup time is spread over the lot. */
export function operationUnitCost(
  operation: RoutingOperation,
  workstation: Workstation | undefined,
  materials: ReadonlyMap<EntityId, Material>,
  lotSize: number,
): OperationCost {
  const rate = workstation?.hourlyRate ?? 0;
  const lot = Math.max(1, lotSize);
  const labor =
    operation.location === 'internal'
      ? ((operation.setupMinutes / 60) * rate) / lot + (operation.runMinutesPerUnit / 60) * rate
      : operation.location === 'company'
        ? (operation.plannedHours * (operation.companyHourlyRate || 0)) / lot
        : 0;
  const consumables = operation.consumables.reduce(
    (sum, usage) => sum + usage.quantity * (materials.get(usage.materialId)?.unitCost ?? 0),
    0,
  );
  const subcontract = operation.location === 'external' ? operation.externalUnitCost : 0;
  return { labor, consumables, subcontract, total: labor + consumables + subcontract };
}

/**
 * Bottom-up cost roll-up: every level is computed from the level below it,
 * so a change in any raw material price or operation cost propagates to level 0.
 */
export function rollUpCost(nodeId: EntityId, context: CostContext): CostLine {
  const { tree, materials } = context;
  const node = tree.node(nodeId);
  if (!node) {
    throw new Error(`Unknown BOM node ${nodeId}`);
  }

  const children = tree.children(nodeId).map((child) => rollUpCost(child.id, context));
  const childrenCost = children.reduce((sum, line) => sum + line.extendedCost, 0);

  const assigned = node.materials.reduce(
    (sum, item) => sum + item.quantity * (materials.get(item.materialId)?.unitCost ?? 0),
    0,
  );
  const purchase = node.decision === 'buy' ? (node.purchaseUnitPrice ?? 0) : 0;
  const ownMaterial = purchase + assigned;

  const lotSize = context.productionQuantity * tree.quantityPerEndProduct(nodeId);
  const operationCost =
    node.decision === 'buy'
      ? 0
      : (context.operationsByNode.get(nodeId) ?? []).reduce(
          (sum, op) =>
            sum + operationUnitCost(op, context.workstations.get(op.workstationId ?? ''), materials, lotSize).total,
          0,
        );

  const materialCost = ownMaterial + childrenCost;
  const unitCost = materialCost + operationCost;
  const quantity = node.parentId === null ? 1 : node.quantity;

  return {
    nodeId,
    level: tree.level(nodeId),
    quantity,
    ownMaterial,
    childrenCost,
    materialCost,
    operationCost,
    unitCost,
    extendedCost: unitCost * quantity,
    children,
  };
}

export function flattenCostLines(line: CostLine): CostLine[] {
  return [line, ...line.children.flatMap(flattenCostLines)];
}
