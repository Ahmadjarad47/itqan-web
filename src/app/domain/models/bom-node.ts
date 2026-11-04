import { HasCustomFields } from './custom-field';
import { Attachment } from './attachment';
import { Entity, EntityId, IsoDate, Unit } from './common';
import { Discipline } from './discipline';

export type SourcingDecision = 'make' | 'buy';

export const SOURCING_LABELS: Record<SourcingDecision, string> = {
  make: 'تصنيع',
  buy: 'شراء',
};

/** Warehouse item consumed directly by a component (usually raw material at level N). */
export interface MaterialAssignment {
  readonly materialId: EntityId;
  readonly quantity: number;
}

/**
 * A node in the recursive product tree (parent-child). The level is derived from
 * the depth of the node, so the tree supports an unlimited number of levels.
 */
export interface BomNode extends Entity, HasCustomFields {
  readonly projectId: EntityId;
  readonly parentId: EntityId | null;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly discipline: Discipline;
  /** Usage quantity inside the parent (multiplier). */
  readonly quantity: number;
  readonly unit: Unit;
  /** Optional image as data URL; a generated visual is used when empty. */
  readonly image: string | null;
  readonly decision: SourcingDecision | null;
  /** Purchase unit price, used by the cost roll-up for bought parts. */
  readonly purchaseUnitPrice: number | null;
  readonly attachments: readonly Attachment[];
  readonly materials: readonly MaterialAssignment[];
  readonly createdAt: IsoDate;
}

export const LEVEL_TITLES = ['المنتج النهائي', 'المكونات الرئيسية', 'المكونات الفرعية'] as const;

export function levelTitle(level: number): string {
  return LEVEL_TITLES[level] ?? 'مكونات فرعية / أجزاء تفصيلية';
}
