import { HasCustomFields } from './custom-field';
import { Entity, EntityId, IsoDate } from './common';

export interface Workstation extends Entity {
  readonly code: string;
  readonly name: string;
  readonly hourlyRate: number;
  readonly departmentId: EntityId;
}

export type OperationLocation = 'internal' | 'external';

export type OperationInputKind = 'material' | 'component' | 'operation';

export const INPUT_KIND_LABELS: Record<OperationInputKind, string> = {
  material: 'مادة خام',
  component: 'مكون',
  operation: 'مخرج عملية',
};

export interface OperationInput {
  readonly kind: OperationInputKind;
  readonly refId: EntityId;
  readonly quantity: number;
}

export interface ConsumableUsage {
  readonly materialId: EntityId;
  /** Quantity consumed per produced unit. */
  readonly quantity: number;
}

export type QcStatus = 'pending' | 'passed' | 'rejected';

export const QC_LABELS: Record<QcStatus, string> = {
  pending: 'بانتظار الفحص',
  passed: 'مقبول',
  rejected: 'مرفوض',
};

export type ProgressMode = 'percent' | 'quantity';

export interface RoutingOperation extends Entity, HasCustomFields {
  readonly nodeId: EntityId;
  readonly sequence: number;
  readonly name: string;
  readonly description: string;
  readonly location: OperationLocation;
  readonly subcontractor: string;
  /** Cost per unit for subcontracted operations. */
  readonly externalUnitCost: number;
  readonly workstationId: EntityId | null;
  readonly inputs: readonly OperationInput[];
  readonly earliestStart: IsoDate;
  readonly latestFinish: IsoDate;
  readonly plannedHours: number;
  readonly actualHours: number;
  readonly setupMinutes: number;
  readonly runMinutesPerUnit: number;
  readonly consumables: readonly ConsumableUsage[];
  readonly instructions: string;
  readonly completed: boolean;
  readonly onTime: boolean;
  readonly actualFinish: IsoDate | null;
  readonly delayReason: string;
  readonly progressMode: ProgressMode;
  readonly progressPercent: number;
  readonly completedQuantity: number;
  readonly qcStatus: QcStatus;
  readonly qcNote: string;
  /** Sequence to return to when quality control rejects the output. */
  readonly reworkSequence: number | null;
  readonly consumablesPosted: boolean;
}
