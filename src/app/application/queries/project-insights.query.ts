import { computed, inject, Injectable } from '@angular/core';
import { EntityId } from '@domain/models';
import { CostLine, flattenCostLines, purchaseProgress, rollUpCost, rollUpProgress } from '@domain/rules';
import { BomStore } from '../state/bom.store';
import { InventoryStore } from '../state/inventory.store';
import { ProjectStore } from '../state/project.store';
import { PurchaseStore } from '../state/purchase.store';
import { RoutingStore, WorkstationStore } from '../state/routing.store';

/**
 * Derived read model: live cost roll-up and cumulative progress for every project.
 * Built from computed signals, so any change in prices, routings or purchases
 * is reflected instantly from level N up to level 0.
 */
@Injectable({ providedIn: 'root' })
export class ProjectInsightsQuery {
  private readonly projects = inject(ProjectStore);
  private readonly bom = inject(BomStore);
  private readonly routing = inject(RoutingStore);
  private readonly inventory = inject(InventoryStore);
  private readonly workstations = inject(WorkstationStore);
  private readonly purchases = inject(PurchaseStore);

  readonly costByProject = computed(() => {
    const tree = this.bom.tree();
    const result = new Map<EntityId, CostLine>();
    for (const project of this.projects.all()) {
      if (!tree.node(project.rootNodeId)) continue;
      result.set(
        project.id,
        rollUpCost(project.rootNodeId, {
          tree,
          operationsByNode: this.routing.byNode(),
          materials: this.inventory.byId(),
          workstations: this.workstations.byId(),
          productionQuantity: project.productionQuantity,
        }),
      );
    }
    return result;
  });

  readonly costByNode = computed(() => {
    const map = new Map<EntityId, CostLine>();
    for (const root of this.costByProject().values()) {
      for (const line of flattenCostLines(root)) map.set(line.nodeId, line);
    }
    return map;
  });

  readonly purchaseProgressByNode = computed(() => {
    const map = new Map<EntityId, number>();
    for (const [nodeId, request] of this.purchases.byNode()) map.set(nodeId, purchaseProgress(request));
    return map;
  });

  readonly progressByNode = computed(() => {
    const tree = this.bom.tree();
    const map = new Map<EntityId, number>();
    for (const project of this.projects.all()) {
      if (!tree.node(project.rootNodeId)) continue;
      const progress = rollUpProgress(project.rootNodeId, {
        tree,
        operationsByNode: this.routing.byNode(),
        purchaseProgressByNode: this.purchaseProgressByNode(),
        productionQuantity: project.productionQuantity,
      });
      progress.forEach((value, key) => map.set(key, value));
    }
    return map;
  });

  /** Units of a component required for the whole production order of its project. */
  lotSize(nodeId: EntityId): number {
    const node = this.bom.find(nodeId);
    const project = this.projects.find(node?.projectId);
    if (!node || !project) return 1;
    return project.productionQuantity * this.bom.tree().quantityPerEndProduct(nodeId);
  }

  projectProgress(projectId: EntityId): number {
    const project = this.projects.find(projectId);
    return project ? (this.progressByNode().get(project.rootNodeId) ?? 0) : 0;
  }
}
