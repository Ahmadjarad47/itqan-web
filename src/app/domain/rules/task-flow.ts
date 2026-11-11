import { EntityId, IsoDate, TaskStatus, WorkTask } from '../models';

const TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  sent: ['accepted', 'rejected'],
  accepted: ['active'],
  rejected: ['sent'],
  active: ['completed'],
  completed: [],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function taskCompletedQuantity(task: WorkTask): number {
  return task.progress.reduce((sum, entry) => sum + entry.completedQuantity, 0);
}

export function taskProgress(task: WorkTask): number {
  if (task.status === 'completed') return 100;
  if (!task.targetQuantity) return 0;
  return Math.min(100, (taskCompletedQuantity(task) / task.targetQuantity) * 100);
}

export function isTaskOverdue(task: WorkTask, today: IsoDate): boolean {
  return task.status !== 'completed' && task.end < today;
}

/** Messages written by others since the user last opened the task chat. */
export function unreadMessages(task: WorkTask, userId: EntityId): number {
  const readAt = task.chatReadAt[userId] ?? '';
  return task.messages.filter((m) => m.authorId !== userId && m.at > readAt).length;
}
