import { Attachment } from './attachment';
import { Entity, EntityId, IsoDate, Unit } from './common';

export type PurchaseStageKey =
  | 'technicalInfo'
  | 'marketResearch'
  | 'rfqSent'
  | 'optionsPresented'
  | 'mcdmDecision'
  | 'poCreated'
  | 'leadTime'
  | 'delivered'
  | 'qualityControl'
  | 'warehouseReceipt';

export interface PurchaseStage {
  readonly key: PurchaseStageKey;
  readonly done: boolean;
  readonly date: IsoDate | null;
  readonly note: string;
  readonly attachments: readonly Attachment[];
}

export interface SupplierQuote {
  readonly id: EntityId;
  readonly supplierId: EntityId;
  readonly unitPrice: number;
  readonly leadTimeDays: number;
  readonly note: string;
}

export interface McdmCriterion {
  readonly id: EntityId;
  readonly name: string;
  /** Relative weight in percent. */
  readonly weight: number;
}

export interface McdmMatrix {
  readonly criteria: readonly McdmCriterion[];
  /** scores[quoteId][criterionId] on a 1..10 scale. */
  readonly scores: Readonly<Record<EntityId, Readonly<Record<EntityId, number>>>>;
}

export type QualityResult = 'passed' | 'failed';

export type PurchasePriority = 'normal' | 'high' | 'urgent';

export const PRIORITY_LABELS: Record<PurchasePriority, string> = {
  normal: 'عادية',
  high: 'مرتفعة',
  urgent: 'عاجلة',
};

export interface PurchaseRequest extends Entity {
  readonly number: string;
  readonly title: string;
  /** Null for standalone purchases that are not linked to any project. */
  readonly projectId: EntityId | null;
  readonly nodeId: EntityId | null;
  readonly quantity: number;
  readonly unit: Unit;
  readonly priority: PurchasePriority;
  readonly supplierId: EntityId | null;
  readonly unitPrice: number | null;
  readonly stages: readonly PurchaseStage[];
  readonly quotes: readonly SupplierQuote[];
  readonly mcdm: McdmMatrix;
  readonly eta: IsoDate | null;
  readonly revisedEta: IsoDate | null;
  readonly qualityResult: QualityResult | null;
  readonly correctiveAction: string;
  readonly createdAt: IsoDate;
}
