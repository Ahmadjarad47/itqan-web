import { HasCustomFields } from './custom-field';
import { Entity, EntityId, IsoDate } from './common';

export interface Workstation extends Entity {
  readonly code: string;
  readonly name: string;
  readonly hourlyRate: number;
  readonly departmentId: EntityId;
}

/** internal: on the factory floor · company: elsewhere inside the company · external: subcontractor. */
export type OperationLocation = 'internal' | 'company' | 'external';

export interface LocationInfo {
  readonly label: string;
  readonly short: string;
  readonly icon: string;
  readonly hint: string;
}

export const OPERATION_LOCATIONS: Record<OperationLocation, LocationInfo> = {
  internal: { label: 'داخل المصنع', short: 'المصنع', icon: 'factory', hint: 'تُنفذ على محطة / ماكينة من مسار المصنع' },
  company: { label: 'داخل الشركة', short: 'الشركة', icon: 'building', hint: 'تُنفذ في قسم آخر من الشركة خارج خط الإنتاج' },
  external: { label: 'مقاول خارجي', short: 'خارجي', icon: 'external', hint: 'تُسلَّم القطعة لمقاول فرعي ويُتابع موعد استلامها' },
};

export const OPERATION_LOCATION_KEYS = Object.keys(OPERATION_LOCATIONS) as OperationLocation[];

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
  /** Executing department for operations done inside the company (outside the factory floor). */
  readonly departmentId: EntityId | null;
  /** Hourly labour rate for in-company operations. */
  readonly companyHourlyRate: number;
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
