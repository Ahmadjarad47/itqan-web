import { computed, inject, Injectable } from '@angular/core';
import { EntityId, RoutingOperation, Workstation } from '@domain/models';
import { OperationRepository, WorkstationRepository } from '@domain/ports/repositories';
import { addDays, todayIso } from '@domain/rules';
import { EntityStore, newId } from './entity-store';

@Injectable({ providedIn: 'root' })
export class WorkstationStore extends EntityStore<Workstation> {
  protected readonly repository = inject(WorkstationRepository);

  readonly sorted = computed(() => [...this.all()].sort((a, b) => a.code.localeCompare(b.code)));
}

@Injectable({ providedIn: 'root' })
export class RoutingStore extends EntityStore<RoutingOperation> {
  protected readonly repository = inject(OperationRepository);

  protected override normalize(op: RoutingOperation): RoutingOperation {
    return { ...op, departmentId: op.departmentId ?? null, companyHourlyRate: op.companyHourlyRate ?? 0 };
  }

  readonly byNode = computed(() => {
    const map = new Map<EntityId, RoutingOperation[]>();
    for (const op of this.all()) {
      const list = map.get(op.nodeId) ?? [];
      list.push(op);
      map.set(op.nodeId, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.sequence - b.sequence);
    return map as ReadonlyMap<EntityId, readonly RoutingOperation[]>;
  });

  forNode(nodeId: EntityId): readonly RoutingOperation[] {
    return this.byNode().get(nodeId) ?? [];
  }

  /** Creates a blank operation scheduled right after the last one of the component. */
  createBlank(nodeId: EntityId): RoutingOperation {
    const existing = this.forNode(nodeId);
    const last = existing.at(-1);
    const start = last ? addDays(last.latestFinish, 1) : todayIso();
    return this.insert({
      id: newId('op'),
      nodeId,
      sequence: (last?.sequence ?? 0) + 10,
      name: 'عملية جديدة',
      description: '',
      location: 'internal',
      subcontractor: '',
      externalUnitCost: 0,
      workstationId: null,
      departmentId: null,
      companyHourlyRate: 0,
      inputs: [],
      earliestStart: start,
      latestFinish: addDays(start, 2),
      plannedHours: 8,
      actualHours: 0,
      setupMinutes: 15,
      runMinutesPerUnit: 30,
      consumables: [],
      instructions: '',
      completed: false,
      onTime: true,
      actualFinish: null,
      delayReason: '',
      progressMode: 'percent',
      progressPercent: 0,
      completedQuantity: 0,
      qcStatus: 'pending',
      qcNote: '',
      reworkSequence: null,
      consumablesPosted: false,
    });
  }

  update(id: EntityId, changes: Partial<Omit<RoutingOperation, 'id' | 'nodeId'>>): RoutingOperation | undefined {
    return this.modify(id, changes);
  }

  remove(id: EntityId): void {
    this.removeWhere((op) => op.id === id);
  }

  removeForNodes(nodeIds: readonly EntityId[]): void {
    const ids = new Set(nodeIds);
    this.removeWhere((op) => ids.has(op.nodeId));
  }
}
