import { inject, Injectable } from '@angular/core';
import { BomNode, Discipline, EntityId, IsoDate, Project, PurchaseRequest } from '@domain/models';
import { todayIso } from '@domain/rules';
import { newId } from '../state/entity-store';
import { BomStore } from '../state/bom.store';
import { ProjectModelStore } from '../state/program.store';
import { ProjectStore } from '../state/project.store';
import { PurchaseStore } from '../state/purchase.store';
import { RoutingStore } from '../state/routing.store';
import { TaskStore } from '../state/task.store';

export interface ProjectDraft {
  readonly code: string;
  readonly name: string;
  readonly customer: string;
  readonly programId: EntityId | null;
  readonly productionQuantity: number;
  readonly dueDate: IsoDate;
  readonly discipline: Discipline;
  readonly description: string;
  readonly image: string | null;
}

@Injectable({ providedIn: 'root' })
export class ProjectSetupUseCase {
  private readonly projects = inject(ProjectStore);
  private readonly bom = inject(BomStore);
  private readonly routing = inject(RoutingStore);
  private readonly tasks = inject(TaskStore);
  private readonly purchases = inject(PurchaseStore);
  private readonly models = inject(ProjectModelStore);

  /** A project is created together with its level 0 node (the end product). */
  create(draft: ProjectDraft): Project {
    const id = newId('p');
    const root = this.bom.createRoot(id, {
      code: draft.code,
      name: draft.name,
      description: draft.description,
      discipline: draft.discipline,
      quantity: 1,
      unit: 'pcs',
      image: draft.image,
    });
    return this.projects.create({
      id,
      code: draft.code,
      name: draft.name,
      customer: draft.customer,
      programId: draft.programId,
      rootNodeId: root.id,
      productionQuantity: Math.max(1, draft.productionQuantity),
      dueDate: draft.dueDate,
      status: 'planning',
      createdAt: todayIso(),
    });
  }

  /** Deletes a component with its subtree, routings, tasks and unstarted purchases. */
  removeComponent(node: BomNode): void {
    const removed = this.bom.removeSubtree(node.id);
    this.routing.removeForNodes(removed);
    this.tasks.removeForNodes(removed);
    for (const id of removed) {
      const request = this.purchases.byNode().get(id);
      if (request) this.releasePurchase(request);
    }
  }

  removeProject(projectId: EntityId): void {
    const project = this.projects.find(projectId);
    const root = this.bom.find(project?.rootNodeId);
    if (root) this.removeComponent(root);
    // Components outside the root subtree, then requests of the project not reached through a component.
    for (const node of this.bom.all().filter((n) => n.projectId === projectId)) {
      if (this.bom.find(node.id)) this.removeComponent(node);
    }
    this.purchases
      .all()
      .filter((r) => r.projectId === projectId)
      .forEach((r) => this.releasePurchase(r));
    this.models.removeProject(projectId);
    this.projects.remove(projectId);
  }

  /** Started requests stay in procurement, detached; unstarted ones are deleted. */
  private releasePurchase(request: PurchaseRequest): void {
    if (request.stages.some((s) => s.done)) {
      this.purchases.update(request.id, { nodeId: null, projectId: null });
    } else {
      this.purchases.remove(request.id);
    }
  }
}
