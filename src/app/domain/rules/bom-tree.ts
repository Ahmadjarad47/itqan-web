import { BomNode, EntityId } from '../models';

/**
 * Read-only index over a recursive parent-child product structure.
 * Levels are derived from depth, so there is no limit on the number of levels.
 */
export class BomTree {
  private readonly byId = new Map<EntityId, BomNode>();
  private readonly childMap = new Map<EntityId, BomNode[]>();

  constructor(nodes: readonly BomNode[]) {
    for (const node of nodes) {
      this.byId.set(node.id, node);
    }
    for (const node of nodes) {
      if (node.parentId === null) continue;
      const siblings = this.childMap.get(node.parentId) ?? [];
      siblings.push(node);
      this.childMap.set(node.parentId, siblings);
    }
    for (const siblings of this.childMap.values()) {
      siblings.sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
    }
  }

  node(id: EntityId): BomNode | undefined {
    return this.byId.get(id);
  }

  children(id: EntityId): readonly BomNode[] {
    return this.childMap.get(id) ?? [];
  }

  isLeaf(id: EntityId): boolean {
    return this.children(id).length === 0;
  }

  /** Nodes from the root down to (and including) the given node. */
  path(id: EntityId): BomNode[] {
    const path: BomNode[] = [];
    const seen = new Set<EntityId>();
    let current = this.byId.get(id);
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      path.unshift(current);
      current = current.parentId ? this.byId.get(current.parentId) : undefined;
    }
    return path;
  }

  level(id: EntityId): number {
    return Math.max(0, this.path(id).length - 1);
  }

  /** All nodes below the given node, depth first. */
  descendants(id: EntityId): BomNode[] {
    const result: BomNode[] = [];
    const seen = new Set<EntityId>([id]);
    const visit = (parentId: EntityId) => {
      for (const child of this.children(parentId)) {
        if (seen.has(child.id)) continue;
        seen.add(child.id);
        result.push(child);
        visit(child.id);
      }
    };
    visit(id);
    return result;
  }

  /** Units of this node needed for one unit of the end product. */
  quantityPerEndProduct(id: EntityId): number {
    return this.path(id)
      .slice(1)
      .reduce((total, node) => total * node.quantity, 1);
  }

  depth(rootId: EntityId): number {
    return this.descendants(rootId).reduce((max, node) => Math.max(max, this.level(node.id)), 0);
  }
}
