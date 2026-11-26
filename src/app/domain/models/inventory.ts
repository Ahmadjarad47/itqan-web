import { Attachment } from './attachment';
import { HasCustomFields } from './custom-field';
import { Entity, EntityId, IsoDate, IsoDateTime, Unit } from './common';

/** System kind used by production and costing (not the user-editable category). */
export type MaterialKind = 'raw' | 'consumable' | 'purchased';

export const MATERIAL_KIND_LABELS: Record<MaterialKind, string> = {
  raw: 'مادة خام',
  consumable: 'مواد مستهلكة',
  purchased: 'جزء مُشترى',
};

/** Inventory valuation method chosen when the product card is created. */
export type CostMethod = 'fifo' | 'average';

export const COST_METHOD_LABELS: Record<CostMethod, string> = {
  fifo: 'الوارد أولاً يصرف أولاً (FIFO)',
  average: 'المتوسط المرجح للتكلفة',
};

export interface ProfitMargin {
  readonly type: 'amount' | 'percent';
  readonly value: number;
}

/** Quantity of an item stored on one shelf (or loose in a warehouse when `shelfId` is null). */
export interface StockLocation {
  readonly warehouseId: EntityId;
  readonly shelfId: EntityId | null;
  readonly quantity: number;
}

/** Product card (بطاقة المنتج). */
export interface Material extends Entity, HasCustomFields {
  readonly code: string;
  readonly name: string;
  readonly kind: MaterialKind;
  readonly unit: Unit;
  /** Current unit cost, refreshed from the history according to `costMethod`. */
  readonly unitCost: number;
  /** Total quantity on hand (sum of `locations`). */
  readonly stock: number;
  readonly minStock: number;
  readonly maxStock: number;
  /** Basic category (أدوات، مواد أولية، ...) from an editable list. */
  readonly categoryId: EntityId | null;
  /** Detailed classification (كهربائية، ميكانيكية، ...) from an editable list. */
  readonly natureId: EntityId | null;
  readonly costMethod: CostMethod;
  readonly margin: ProfitMargin;
  readonly locations: readonly StockLocation[];
  readonly specFiles: readonly Attachment[];
  readonly notes: string;
  readonly createdAt: IsoDate;
}

export type StockMovementType = 'receipt' | 'issue' | 'consumption' | 'adjustment' | 'transfer' | 'writeoff';

export const MOVEMENT_LABELS: Record<StockMovementType, string> = {
  receipt: 'إدخال',
  issue: 'صرف',
  consumption: 'استهلاك عملية',
  adjustment: 'تسوية',
  transfer: 'مناقلة',
  writeoff: 'إتلاف / شطب',
};

/** How an incoming quantity was obtained. */
export type ReceiptSource = 'supply' | 'invoice' | 'opening' | 'return' | 'other';

export const RECEIPT_SOURCE_LABELS: Record<ReceiptSource, string> = {
  supply: 'طلب توريد',
  invoice: 'فاتورة شراء',
  opening: 'رصيد افتتاحي',
  return: 'مرتجع',
  other: 'أخرى',
};

export interface StockMovement extends Entity {
  readonly materialId: EntityId;
  readonly type: StockMovementType;
  /** Signed quantity: positive for incoming, negative for outgoing. */
  readonly quantity: number;
  readonly reference: string;
  /** Recording timestamp. */
  readonly at: IsoDateTime;
  /** Business date of the operation. */
  readonly date: IsoDate;
  readonly warehouseId: EntityId | null;
  readonly shelfId: EntityId | null;
  /** Purchase price for incoming movements, issued cost per unit for outgoing ones. */
  readonly unitCost: number | null;
  /** Optional selling price per unit on issues. */
  readonly sellPrice: number | null;
  readonly source: ReceiptSource | null;
  /** Invoice, supply-request or requisition number. */
  readonly documentNo: string;
  readonly supplierId: EntityId | null;
  readonly purchaseId: EntityId | null;
  readonly requisitionId: EntityId | null;
  readonly expiryDate: IsoDate | null;
  /** Links both legs of a transfer between warehouses. */
  readonly transferId: EntityId | null;
  readonly attachments: readonly Attachment[];
}

/** Warehouse shelf with its own code. */
export interface Shelf {
  readonly id: EntityId;
  readonly code: string;
  readonly name: string;
}

export interface Warehouse extends Entity {
  readonly code: string;
  readonly name: string;
  readonly address: string;
  readonly managerId: EntityId | null;
  readonly phones: string;
  /** Parent warehouse for sub-warehouses (hierarchy). */
  readonly parentId: EntityId | null;
  readonly shelves: readonly Shelf[];
  readonly createdAt: IsoDate;
}

/** Editable dropdown lists of the product card. */
export type CatalogList = 'category' | 'nature';

export const CATALOG_LIST_LABELS: Record<CatalogList, string> = {
  category: 'الفئة الأساسية',
  nature: 'التصنيف التفصيلي',
};

export interface CatalogOption extends Entity {
  readonly list: CatalogList;
  readonly name: string;
  /** Short code used to generate item codes. */
  readonly code: string;
}

export type RequisitionStatus = 'new' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

export const REQUISITION_STATUS_LABELS: Record<RequisitionStatus, string> = {
  new: 'جديد',
  preparing: 'جاري التجهيز',
  ready: 'جاهز للتسليم',
  delivered: 'تم التسليم',
  cancelled: 'ملغى',
};

export interface RequisitionLine {
  readonly id: EntityId;
  readonly materialId: EntityId;
  readonly quantity: number;
  readonly note: string;
}

/** Material requisition (طلب احتياج) served by the warehouse. */
export interface Requisition extends Entity {
  readonly number: string;
  readonly origin: 'system' | 'paper';
  readonly departmentId: EntityId | null;
  /** Free-text requesting party (used for paper requisitions). */
  readonly requester: string;
  readonly projectId: EntityId | null;
  readonly requestDate: IsoDate;
  readonly dueDate: IsoDate;
  readonly warehouseId: EntityId | null;
  readonly status: RequisitionStatus;
  readonly lines: readonly RequisitionLine[];
  readonly notes: string;
  readonly deliveredAt: IsoDate | null;
}
