import { EntityId, RoutingOperation } from '../models';
import { BomTree } from './bom-tree';

export function operationProgress(operation: RoutingOperation, lotSize: number): number {
  if (operation.completed) return 100;
  if (operation.progressMode === 'percent') return clampPercent(operation.progressPercent);
  return clampPercent((operation.completedQuantity / Math.max(1, lotSize)) * 100);
}

export interface ProgressContext {
  readonly tree: BomTree;
  readonly operationsByNode: ReadonlyMap<EntityId, readonly RoutingOperation[]>;
  readonly purchaseProgressByNode: ReadonlyMap<EntityId, number>;
  readonly productionQuantity: number;
}

/**
 * Cumulative completion: operation progress is reflected on its component first,
 * then aggregated upwards through every parent until level 0.
 */
export function rollUpProgress(rootId: EntityId, context: ProgressContext): Map<EntityId, number> {
  const result = new Map<EntityId, number>();
  const visited = new Set<EntityId>();

  const visit = (nodeId: EntityId): number => {
    const node = context.tree.node(nodeId);
    if (!node) return 0;
    visited.add(nodeId);

    if (node.decision === 'buy') {
      const value = context.purchaseProgressByNode.get(nodeId) ?? 0;
      result.set(nodeId, value);
      return value;
    }

    const parts = context.tree
      .children(nodeId)
      .filter((child) => !visited.has(child.id))
      .map((child) => visit(child.id));
    const operations = context.operationsByNode.get(nodeId) ?? [];
    if (operations.length) {
      const lotSize = context.productionQuantity * context.tree.quantityPerEndProduct(nodeId);
      const totalWeight = operations.reduce((sum, op) => sum + Math.max(op.plannedHours, 1), 0);
      const weighted = operations.reduce(
        (sum, op) => sum + operationProgress(op, lotSize) * Math.max(op.plannedHours, 1),
        0,
      );
      parts.push(weighted / totalWeight);
    }

    const value = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
    result.set(nodeId, value);
    return value;
  };

  visit(rootId);
  return result;
}

export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
}
