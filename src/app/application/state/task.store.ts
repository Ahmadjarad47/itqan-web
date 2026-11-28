import { computed, inject, Injectable } from '@angular/core';
import { EntityId, RejectReason, TaskProgressEntry, TaskStatus, WorkTask } from '@domain/models';
import { TaskRepository } from '@domain/ports/repositories';
import { canTransition, nextSequence, nowIso, unreadMessages } from '@domain/rules';
import { EntityStore, newId } from './entity-store';

export type NewTask = Pick<
  WorkTask,
  | 'kind'
  | 'projectId'
  | 'nodeId'
  | 'operationId'
  | 'purchaseId'
  | 'purchaseStage'
  | 'title'
  | 'description'
  | 'createdById'
  | 'departmentId'
  | 'assigneeId'
  | 'start'
  | 'end'
  | 'notes'
  | 'targetQuantity'
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

  protected override normalize(task: WorkTask): WorkTask {
    return {
      ...task,
      kind: task.kind ?? (task.operationId ? 'operation' : 'custom'),
      purchaseId: task.purchaseId ?? null,
      purchaseStage: task.purchaseStage ?? null,
      title: task.title ?? '',
      description: task.description ?? '',
      createdById: task.createdById ?? null,
      messages: task.messages ?? [],
      chatReadAt: task.chatReadAt ?? {},
    };
  }

  create(data: NewTask): WorkTask {
    const at = nowIso();
    return this.insert({
      ...data,
      id: newId('t'),
      number: `TSK-${nextSequence(this.all().map((t) => t.number), 'TSK-', 101)}`,
      status: 'sent',
      archived: false,
      seenByAssignee: false,
      rejectReason: null,
      rejectNote: '',
      progress: [],
      messages: [],
      chatReadAt: {},
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

  postMessage(id: EntityId, authorId: EntityId, text: string): void {
    const body = text.trim();
    if (!body) return;
    this.modify(id, (task) => ({
      ...task,
      messages: [...task.messages, { id: newId('tm'), authorId, at: nowIso(), text: body }],
      chatReadAt: { ...task.chatReadAt, [authorId]: nowIso() },
    }));
  }

  markChatRead(id: EntityId, userId: EntityId): void {
    const task = this.find(id);
    if (!task || !userId || unreadMessages(task, userId) === 0) return;
    this.modify(id, { chatReadAt: { ...task.chatReadAt, [userId]: nowIso() } });
  }

  markSeen(id: EntityId): void {
    if (this.find(id)?.seenByAssignee === false) this.modify(id, { seenByAssignee: true });
  }

  setArchived(id: EntityId, archived: boolean): void {
    this.modify(id, { archived });
  }

  removeForNodes(nodeIds: readonly EntityId[]): void {
    const ids = new Set(nodeIds);
    this.removeWhere((task) => !!task.nodeId && ids.has(task.nodeId));
  }
}
