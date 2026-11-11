import { BomNode, EntityId, IsoDate, RoutingOperation } from '../models';
import { BomTree } from './bom-tree';
import { addDays, diffDays, minDate } from './dates';

export interface CloneOptions {
  /** Project that receives the copy. */
  readonly projectId: EntityId;
  /** Parent of the copied root inside the target tree (null = becomes the level 0 node). */
  readonly parentId: EntityId | null;
  /** Code given to the copied root; descendants are re-coded hierarchically under it. */
  readonly rootCode: string;
  readonly includeRouting: boolean;
  /** Shifts the copied schedule so the earliest operation starts on this date. */
  readonly scheduleFrom: IsoDate | null;
  readonly today: IsoDate;
  readonly newId: (prefix: string) => EntityId;
}

export interface ClonedTree {
  readonly nodes: BomNode[];
  readonly operations: RoutingOperation[];
  /** Source node id → id of its copy. */
  readonly nodeIds: ReadonlyMap<EntityId, EntityId>;
}

/** Child code under a parent, matching the convention ATL-2 / ATL-2.3 / ATL-2.3.1. */
export function childCode(parentCode: string, parentIsRoot: boolean, index: number): string {
  return parentIsRoot ? `${parentCode.split('-')[0]}-${index}` : `${parentCode}.${index}`;
}

/**
 * Deep-copies a subtree (structure, materials, attachments, custom fields and,
 * optionally, its routing). Execution state is reset: the copy is a fresh plan.
 */
export function cloneSubtree(
  rootId: EntityId,
  source: { readonly nodes: readonly BomNode[]; readonly operations: readonly RoutingOperation[] },
  options: CloneOptions,
): ClonedTree {
  const tree = new BomTree(source.nodes);
  const sourceRoot = tree.node(rootId);
  if (!sourceRoot) return { nodes: [], operations: [], nodeIds: new Map() };

  const nodeIds = new Map<EntityId, EntityId>();
  const nodes: BomNode[] = [];

  const visit = (node: BomNode, parentId: EntityId | null, code: string): void => {
    const id = options.newId('n');
    nodeIds.set(node.id, id);
    nodes.push({
      ...node,
      id,
      projectId: options.projectId,
      parentId,
      code,
      attachments: node.attachments.map((a) => ({ ...a, id: options.newId('att') })),
      materials: node.materials.map((m) => ({ ...m })),
      createdAt: options.today,
    });
    tree.children(node.id).forEach((child, i) => visit(child, id, childCode(code, parentId === null, i + 1)));
  };
  visit(sourceRoot, options.parentId, options.rootCode);

  if (!options.includeRouting) return { nodes, operations: [], nodeIds };

  const sourceOps = source.operations.filter((op) => nodeIds.has(op.nodeId));
  const opIds = new Map(sourceOps.map((op) => [op.id, options.newId('op')] as const));
  const start = minDate(sourceOps.map((op) => op.earliestStart));
  const shift = options.scheduleFrom && start ? diffDays(start, options.scheduleFrom) : 0;

  const operations = sourceOps.map<RoutingOperation>((op) => ({
    ...op,
    id: opIds.get(op.id)!,
    nodeId: nodeIds.get(op.nodeId)!,
    inputs: op.inputs.map((input) => ({
      ...input,
      refId:
        input.kind === 'component'
          ? (nodeIds.get(input.refId) ?? input.refId)
          : input.kind === 'operation'
            ? (opIds.get(input.refId) ?? input.refId)
            : input.refId,
    })),
    consumables: op.consumables.map((c) => ({ ...c })),
    earliestStart: addDays(op.earliestStart, shift),
    latestFinish: addDays(op.latestFinish, shift),
    actualHours: 0,
    completed: false,
    onTime: true,
    actualFinish: null,
    delayReason: '',
    progressPercent: 0,
    completedQuantity: 0,
    qcStatus: 'pending',
    qcNote: '',
    consumablesPosted: false,
  }));

  return { nodes, operations, nodeIds };
}

export type TreeChangeField = 'name' | 'code' | 'quantity' | 'unit' | 'decision' | 'price' | 'materials' | 'parent' | 'owner' | 'routing';

export const TREE_CHANGE_LABELS: Record<TreeChangeField, string> = {
  name: 'الاسم',
  code: 'الرمز',
  quantity: 'الكمية',
  unit: 'الوحدة',
  decision: 'قرار التصنيع/الشراء',
  price: 'سعر الشراء',
  materials: 'المواد',
  parent: 'الموقع في الشجرة',
  owner: 'المسؤول',
  routing: 'مسار التصنيع',
};

export interface TreeDiff {
  readonly added: readonly BomNode[];
  readonly removed: readonly BomNode[];
  readonly changed: readonly { readonly node: BomNode; readonly fields: readonly TreeChangeField[] }[];
}

const routingSignature = (ops: readonly RoutingOperation[]): string =>
  ops
    .map((op) => [op.sequence, op.name, op.location, op.workstationId, op.plannedHours, op.setupMinutes, op.runMinutesPerUnit, op.externalUnitCost].join('|'))
    .sort()
    .join(';');

const materialSignature = (node: BomNode): string =>
  node.materials
    .map((m) => `${m.materialId}:${m.quantity}`)
    .sort()
    .join(',');

/** Compares two states of the same project tree, matching nodes by id. */
export function diffTrees(
  before: { readonly nodes: readonly BomNode[]; readonly operations: readonly RoutingOperation[] },
  after: { readonly nodes: readonly BomNode[]; readonly operations: readonly RoutingOperation[] },
): TreeDiff {
  const beforeById = new Map(before.nodes.map((n) => [n.id, n]));
  const afterIds = new Set(after.nodes.map((n) => n.id));
  const opsBy = (ops: readonly RoutingOperation[]) => {
    const map = new Map<EntityId, RoutingOperation[]>();
    for (const op of ops) map.set(op.nodeId, [...(map.get(op.nodeId) ?? []), op]);
    return map;
  };
  const beforeOps = opsBy(before.operations);
  const afterOps = opsBy(after.operations);

  const changed: { node: BomNode; fields: TreeChangeField[] }[] = [];
  const added: BomNode[] = [];
  for (const node of after.nodes) {
    const old = beforeById.get(node.id);
    if (!old) {
      added.push(node);
      continue;
    }
    const fields: TreeChangeField[] = [];
    if (old.name !== node.name) fields.push('name');
    if (old.code !== node.code) fields.push('code');
    if (old.quantity !== node.quantity) fields.push('quantity');
    if (old.unit !== node.unit) fields.push('unit');
    if (old.decision !== node.decision) fields.push('decision');
    if (old.purchaseUnitPrice !== node.purchaseUnitPrice) fields.push('price');
    if (materialSignature(old) !== materialSignature(node)) fields.push('materials');
    if (old.parentId !== node.parentId) fields.push('parent');
    if (old.ownerId !== node.ownerId) fields.push('owner');
    if (routingSignature(beforeOps.get(node.id) ?? []) !== routingSignature(afterOps.get(node.id) ?? [])) fields.push('routing');
    if (fields.length) changed.push({ node, fields });
  }
  return { added, removed: before.nodes.filter((n) => !afterIds.has(n.id)), changed };
}
