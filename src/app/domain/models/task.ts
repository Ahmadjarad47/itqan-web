import { Entity, EntityId, IsoDate, IsoDateTime } from './common';
import { PurchaseStageKey } from './purchase';

export type TaskStatus = 'sent' | 'accepted' | 'rejected' | 'active' | 'completed';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  sent: 'مُرسلة',
  accepted: 'مقبولة',
  rejected: 'مرفوضة / مُعادة',
  active: 'نشطة',
  completed: 'مكتملة',
};

export type RejectReason = 'time' | 'department' | 'other';

export const REJECT_REASON_LABELS: Record<RejectReason, string> = {
  time: 'عدم توافر الوقت',
  department: 'خطأ في القسم',
  other: 'سبب آخر',
};

export interface TaskProgressEntry {
  readonly id: EntityId;
  readonly at: IsoDateTime;
  readonly completedQuantity: number;
  readonly qualityOk: boolean;
  readonly note: string;
}

export interface TaskEvent {
  readonly status: TaskStatus;
  readonly at: IsoDateTime;
  readonly note: string;
}

/**
 * What the task executes: a manufacturing operation of the component's routing,
 * a step of the component's purchase flow, or free work described by the manager
 * (either for a component, outside the plan, or not linked to any project).
 */
export type TaskKind = 'operation' | 'purchase' | 'custom';

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  operation: 'تصنيع',
  purchase: 'شراء',
  custom: 'مهمة مخصصة',
};

/** A chat message exchanged between the manager and the assignee inside a task. */
export interface TaskMessage {
  readonly id: EntityId;
  readonly authorId: EntityId;
  readonly at: IsoDateTime;
  readonly text: string;
}

export interface WorkTask extends Entity {
  readonly number: string;
  readonly kind: TaskKind;
  /** Null for standalone tasks that are not part of any project. */
  readonly projectId: EntityId | null;
  readonly nodeId: EntityId | null;
  readonly operationId: EntityId | null;
  readonly purchaseId: EntityId | null;
  readonly purchaseStage: PurchaseStageKey | null;
  /** Title of custom tasks (operation / purchase tasks derive theirs). */
  readonly title: string;
  readonly description: string;
  /** Manager who created and follows the task. */
  readonly createdById: EntityId | null;
  readonly messages: readonly TaskMessage[];
  /** Last time each participant opened the chat, used for unread counters. */
  readonly chatReadAt: Readonly<Record<EntityId, IsoDateTime>>;
  readonly departmentId: EntityId;
  readonly assigneeId: EntityId;
  readonly start: IsoDate;
  readonly end: IsoDate;
  readonly notes: string;
  readonly status: TaskStatus;
  readonly archived: boolean;
  readonly seenByAssignee: boolean;
  readonly rejectReason: RejectReason | null;
  readonly rejectNote: string;
  readonly targetQuantity: number;
  readonly progress: readonly TaskProgressEntry[];
  readonly history: readonly TaskEvent[];
  readonly createdAt: IsoDateTime;
}
