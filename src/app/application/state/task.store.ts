import { computed, inject, Injectable } from '@angular/core';
import { EntityId, RejectReason, TaskProgressEntry, TaskStatus, WorkTask } from '@domain/models';
import { TaskRepository } from '@domain/ports/repositories';
import { canTransition, nowIso } from '@domain/rules';
import { EntityStore, newId } from './entity-store';

export type NewTask = Pick<
  WorkTask,
  'projectId' | 'nodeId' | 'operationId' | 'departmentId' | 'assigneeId' | 'start' | 'end' | 'notes' | 'targetQuantity'
>;

@Injectable({ providedIn: 'root' })
export class TaskStore extends EntityStore<WorkTask> {
  protected readonly repository = inject(TaskRepository);

  readonly sorted = computed(() => [...this.all()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  readonly active = computed(() => this.sorted().filter((task) => !task.archived));
  readonly archived = computed(() => this.sorted().filter((task) => task.archived));

  forAssignee(employeeId: EntityId): readonly WorkTask[] {
    return this.active().filter((task) => task.assigneeId === employeeId);
  }

  create(data: NewTask): WorkTask {
    const at = nowIso();
    return this.insert({
      ...data,
      id: newId('t'),
      number: `TSK-${101 + this.all().length}`,
      status: 'sent',
      archived: false,
      seenByAssignee: false,
      rejectReason: null,
      rejectNote: '',
      progress: [],
      history: [{ status: 'sent', at, note: '' }],
      createdAt: at,
    });
  }

  transition(id: EntityId, status: TaskStatus, note = ''): boolean {
    const task = this.find(id);
    if (!task || !canTransition(task.status, status)) return false;
    this.modify(id, {
      status,
      seenByAssignee: status === 'sent' ? false : task.seenByAssignee,
      history: [...task.history, { status, at: nowIso(), note }],
    });
    return true;
  }

  reject(id: EntityId, reason: RejectReason, note: string): boolean {
    if (!this.transition(id, 'rejected', note)) return false;
    this.modify(id, { rejectReason: reason, rejectNote: note });
    return true;
  }

  /** Manager re-sends a returned task, optionally to another department/person. */
  reassign(id: EntityId, departmentId: EntityId, assigneeId: EntityId): void {
    this.modify(id, { departmentId, assigneeId, rejectReason: null, rejectNote: '' });
    this.transition(id, 'sent', 'إعادة إسناد');
  }

  addProgress(id: EntityId, entry: Omit<TaskProgressEntry, 'id' | 'at'>): WorkTask | undefined {
    return this.modify(id, (task) => ({
      ...task,
      progress: [...task.progress, { ...entry, id: newId('tp'), at: nowIso() }],
    }));
  }

  markSeen(id: EntityId): void {
    if (this.find(id)?.seenByAssignee === false) this.modify(id, { seenByAssignee: true });
  }

  setArchived(id: EntityId, archived: boolean): void {
    this.modify(id, { archived });
  }

  removeForNodes(nodeIds: readonly EntityId[]): void {
    const ids = new Set(nodeIds);
    this.removeWhere((task) => ids.has(task.nodeId));
  }
}
