import { Entity, EntityId, IsoDate, IsoDateTime } from './common';

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

export interface WorkTask extends Entity {
  readonly number: string;
  readonly projectId: EntityId;
  readonly nodeId: EntityId;
  readonly operationId: EntityId;
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
