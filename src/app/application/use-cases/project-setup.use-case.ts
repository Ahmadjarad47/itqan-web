import { inject, Injectable } from '@angular/core';
import { BomNode, Discipline, EntityId, IsoDate, Project, RoutingOperation } from '@domain/models';
import { cloneSubtree, todayIso } from '@domain/rules';
import { newId } from '../state/entity-store';
import { BomStore } from '../state/bom.store';
import { ProjectModelStore } from '../state/program.store';
import { ProjectStore } from '../state/project.store';
import { ProjectVersionStore } from '../state/project-version.store';
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

/** Tree to copy into a new project: a live project or a saved version. */
export interface TreeTemplate {
  readonly rootId: EntityId;
  readonly nodes: readonly BomNode[];
  readonly operations: readonly RoutingOperation[];
  readonly includeRouting: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProjectSetupUseCase {
  private readonly projects = inject(ProjectStore);
  private readonly bom = inject(BomStore);
  private readonly routing = inject(RoutingStore);
  private readonly tasks = inject(TaskStore);
  private readonly purchases = inject(PurchaseStore);
  private readonly models = inject(ProjectModelStore);
  private readonly versions = inject(ProjectVersionStore);

  /** A project is created together with its level 0 node (the end product). */
  create(draft: ProjectDraft, template?: TreeTemplate): Project {
    const id = newId('p');
    const root = template ? this.cloneRoot(id, draft, template) : this.bom.createRoot(id, {
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

  /** The template tree becomes the level 0 of the new project, renamed after the draft. */
  private cloneRoot(projectId: EntityId, draft: ProjectDraft, template: TreeTemplate): BomNode {
    const copy = cloneSubtree(template.rootId, template, {
      projectId,
      parentId: null,
      rootCode: draft.code,
      includeRouting: template.includeRouting,
      scheduleFrom: todayIso(),
      today: todayIso(),
      newId,
    });
    const [root, ...rest] = copy.nodes;
    const renamed: BomNode = {
      ...root,
      name: draft.name,
      description: draft.description || root.description,
      discipline: draft.discipline,
      image: draft.image ?? root.image,
    };
    this.bom.putMany([renamed, ...rest]);
    this.routing.putMany(copy.operations);
    return renamed;
  }

  /**
   * Copies a component with its whole subtree (from any project, including this one)
   * under the target parent. Codes are regenerated to fit the target tree.
   */
  importSubtree(sourceNodeId: EntityId, targetParentId: EntityId, includeRouting: boolean): BomNode | undefined {
    const target = this.bom.find(targetParentId);
    if (!target || !this.bom.find(sourceNodeId)) return undefined;
    const copy = cloneSubtree(
      sourceNodeId,
      { nodes: this.bom.all(), operations: this.routing.all() },
      {
        projectId: target.projectId,
        parentId: target.id,
        rootCode: this.bom.nextChildCode(target.id),
        includeRouting,
        scheduleFrom: todayIso(),
        today: todayIso(),
        newId,
      },
    );
    this.bom.putMany(copy.nodes);
    this.routing.putMany(copy.operations);
    return copy.nodes[0];
  }

  /** Deletes a component with its subtree, routings, tasks and unstarted purchases. */
  removeComponent(node: BomNode): void {
    const removed = this.bom.removeSubtree(node.id);
    this.routing.removeForNodes(removed);
    this.tasks.removeForNodes(removed);
    for (const id of removed) {
      const request = this.purchases.byNode().get(id);
      if (!request) continue;
      if (request.stages.some((s) => s.done)) {
        this.purchases.update(request.id, { nodeId: null, projectId: null });
      } else {
        this.purchases.remove(request.id);
      }
    }
  }

  removeProject(projectId: EntityId): void {
    const project = this.projects.find(projectId);
    const root = this.bom.find(project?.rootNodeId);
    if (root) this.removeComponent(root);
    this.models.removeProject(projectId);
    this.versions.removeProject(projectId);
    this.projects.remove(projectId);
  }
}
