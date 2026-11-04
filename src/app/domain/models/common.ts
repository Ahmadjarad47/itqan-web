/** Unique identifier shared by every aggregate in the system. */
export type EntityId = string;

/** Calendar date in ISO format (yyyy-mm-dd). */
export type IsoDate = string;

/** Full ISO timestamp. */
export type IsoDateTime = string;

export interface Entity {
  readonly id: EntityId;
}

export type Unit = 'pcs' | 'kg' | 'm' | 'm2' | 'l' | 'set';

export const UNIT_LABELS: Record<Unit, string> = {
  pcs: 'قطعة',
  kg: 'كغ',
  m: 'متر',
  m2: 'م²',
  l: 'لتر',
  set: 'طقم',
};
