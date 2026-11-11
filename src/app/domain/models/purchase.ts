import { HasCustomFields } from './custom-field';
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
  /** Completion date of the stage (for market research: the end of the search). */
  readonly date: IsoDate | null;
  /** When work on the stage started (used to measure the market-research duration). */
  readonly startDate: IsoDate | null;
  readonly note: string;
  readonly attachments: readonly Attachment[];
}

export type ContactChannel = 'email' | 'phone' | 'whatsapp' | 'visit' | 'portal' | 'other';

export const CONTACT_CHANNEL_LABELS: Record<ContactChannel, string> = {
  email: 'بريد إلكتروني',
  phone: 'اتصال هاتفي',
  whatsapp: 'واتساب',
  visit: 'زيارة',
  portal: 'منصة / موقع المورد',
  other: 'أخرى',
};

export const CONTACT_CHANNEL_ICONS: Record<ContactChannel, string> = {
  email: 'mail',
  phone: 'phone',
  whatsapp: 'message',
  visit: 'building',
  portal: 'external',
  other: 'more',
};

/** A supplier that was asked for a price quotation during the RFQ stage. */
export interface SupplierContact {
  readonly id: EntityId;
  readonly supplierId: EntityId;
  readonly contactedAt: IsoDate;
  readonly channel: ContactChannel;
  /** Date the supplier is expected to reply with the price quotation. */
  readonly expectedReplyDate: IsoDate | null;
  readonly note: string;
  readonly replied: boolean;
}

export interface SupplierQuote {
  readonly id: EntityId;
  readonly supplierId: EntityId;
  readonly unitPrice: number;
  readonly leadTimeDays: number;
  readonly note: string;
  readonly receivedAt: IsoDate | null;
  readonly channel: ContactChannel;
  /** Shipping / extra charges for the whole order. */
  readonly shippingCost: number;
  readonly paymentTerms: string;
  readonly warranty: string;
  readonly validUntil: IsoDate | null;
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

export interface PurchaseRequest extends Entity, HasCustomFields {
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
  readonly contacts: readonly SupplierContact[];
  readonly quotes: readonly SupplierQuote[];
  readonly mcdm: McdmMatrix;
  readonly eta: IsoDate | null;
  readonly revisedEta: IsoDate | null;
  readonly qualityResult: QualityResult | null;
  readonly correctiveAction: string;
  readonly createdAt: IsoDate;
}
