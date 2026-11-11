import { Entity, EntityId, IsoDate } from './common';

export type ProjectStatus = 'planning' | 'active' | 'on-hold' | 'completed';

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'قيد التخطيط',
  active: 'قيد التنفيذ',
  'on-hold': 'متوقف مؤقتاً',
  completed: 'مكتمل',
};

export interface Project extends Entity {
  readonly code: string;
  readonly name: string;
  readonly customer: string;
  /** Program the project belongs to (null when not grouped under a program). */
  readonly programId: EntityId | null;
  /** Level 0 node: the shippable end product. */
  readonly rootNodeId: EntityId;
  /** Number of end-product units to be produced. */
  readonly productionQuantity: number;
  readonly dueDate: IsoDate;
  readonly status: ProjectStatus;
  readonly createdAt: IsoDate;
}
