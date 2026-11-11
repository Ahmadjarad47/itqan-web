import { inject, Injectable } from '@angular/core';
import { EntityId, ProjectVersion, RoutingOperation } from '@domain/models';
import { diffTrees, nowIso, TreeDiff } from '@domain/rules';
import { BomStore } from '../state/bom.store';
import { newId } from '../state/entity-store';
import { ProjectStore } from '../state/project.store';
import { ProjectVersionStore } from '../state/project-version.store';
import { RoutingStore } from '../state/routing.store';
import { SessionStore } from '../state/session.store';
import { ProjectSetupUseCase } from './project-setup.use-case';

/** Execution fields of an operation; a restore keeps the shop-floor progress already reported. */
const EXECUTION_FIELDS = [
  'actualHours',
  'completed',
  'onTime',
  'actualFinish',
  'delayReason',
  'progressPercent',
  'completedQuantity',
  'qcStatus',
  'qcNote',
  'consumablesPosted',
] as const satisfies readonly (keyof RoutingOperation)[];

/** Saves, compares and restores versions of a project's engineering definition. */
@Injectable({ providedIn: 'root' })
export class ProjectVersioningUseCase {
  private readonly projects = inject(ProjectStore);
  private readonly bom = inject(BomStore);
  private readonly routing = inject(RoutingStore);
  private readonly versions = inject(ProjectVersionStore);
  private readonly session = inject(SessionStore);
  private readonly setup = inject(ProjectSetupUseCase);

  /** Current tree and routings of the project, as they would be frozen in a version. */
  current(projectId: EntityId): Pick<ProjectVersion, 'nodes' | 'operations'> {
    const nodes = this.bom.forProject(projectId);
    const ids = new Set(nodes.map((n) => n.id));
    return { nodes, operations: this.routing.all().filter((op) => ids.has(op.nodeId)) };
  }

  save(projectId: EntityId, label: string, note: string, automatic = false): ProjectVersion {
    const number = this.versions.nextNumber(projectId);
    return this.versions.create({
      id: newId('ver'),
      projectId,
      number,
      label: label.trim() || `الإصدار ${number}`,
      note: note.trim(),
      createdAt: nowIso(),
      createdById: this.session.userId() || null,
      automatic,
      ...this.current(projectId),
    });
  }

  /** What changed from the version to the project as it is now. */
  diff(version: ProjectVersion): TreeDiff {
    return diffTrees(version, this.current(version.projectId));
  }

  /**
   * Brings the tree and routings back to the version. The current state is saved
   * first as an automatic version, so a restore can always be undone.
   */
  restore(versionId: EntityId): ProjectVersion | undefined {
    const version = this.versions.find(versionId);
    const project = this.projects.find(version?.projectId);
    if (!version || !project) return undefined;

    const backup = this.save(project.id, `قبل استعادة v${version.number}`, 'نسخة تلقائية قبل الاستعادة', true);

    // Components added after the version are removed with their routings, tasks and purchases.
    const keep = new Set(version.nodes.map((n) => n.id));
    const extraRoots = this.bom
      .forProject(project.id)
      .filter((n) => !keep.has(n.id) && (n.parentId === null || keep.has(n.parentId)));
    extraRoots.forEach((node) => this.setup.removeComponent(node));

    this.bom.putMany(version.nodes);

    const live = new Map(this.routing.all().map((op) => [op.id, op]));
    const versionOps = new Set(version.operations.map((op) => op.id));
    this.routing.removeIds(backup.operations.filter((op) => !versionOps.has(op.id)).map((op) => op.id));
    this.routing.putMany(
      version.operations.map((op) => {
        const current = live.get(op.id);
        if (!current) return op;
        const progress = Object.fromEntries(EXECUTION_FIELDS.map((key) => [key, current[key]]));
        return { ...op, ...progress };
      }),
    );
    return backup;
  }

  /** Starts a new project from the version (a branch of the design). */
  branch(versionId: EntityId, draft: { code: string; name: string; customer: string }) {
    const version = this.versions.find(versionId);
    const project = this.projects.find(version?.projectId);
    const root = version?.nodes.find((n) => n.parentId === null);
    if (!version || !project || !root) return undefined;
    return this.setup.create(
      {
        code: draft.code,
        name: draft.name,
        customer: draft.customer,
        programId: project.programId,
        productionQuantity: project.productionQuantity,
        dueDate: project.dueDate,
        discipline: root.discipline,
        description: root.description,
        image: root.image,
      },
      { rootId: root.id, nodes: version.nodes, operations: version.operations, includeRouting: true },
    );
  }
}
