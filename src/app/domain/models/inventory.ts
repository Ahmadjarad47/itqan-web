import { HasCustomFields } from './custom-field';
import { Entity, EntityId, IsoDateTime, Unit } from './common';

export type MaterialKind = 'raw' | 'consumable' | 'purchased';

export const MATERIAL_KIND_LABELS: Record<MaterialKind, string> = {
  raw: 'مادة خام',
  consumable: 'مواد مستهلكة',
  purchased: 'جزء مُشترى',
};

export interface Material extends Entity, HasCustomFields {
  readonly code: string;
  readonly name: string;
  readonly kind: MaterialKind;
  readonly unit: Unit;
  readonly unitCost: number;
  readonly stock: number;
  readonly minStock: number;
  readonly warehouse: string;
}

export type StockMovementType = 'receipt' | 'issue' | 'consumption' | 'adjustment';

export const MOVEMENT_LABELS: Record<StockMovementType, string> = {
  receipt: 'استلام',
  issue: 'صرف',
  consumption: 'استهلاك عملية',
  adjustment: 'تسوية',
};

export interface StockMovement extends Entity {
  readonly materialId: EntityId;
  readonly type: StockMovementType;
  /** Signed quantity: positive for receipts, negative for issues and consumption. */
  readonly quantity: number;
  readonly reference: string;
  readonly at: IsoDateTime;
}
