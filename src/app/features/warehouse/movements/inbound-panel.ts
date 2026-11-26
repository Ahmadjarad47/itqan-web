import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InventoryStore } from '@application/state/inventory.store';
import { PurchaseStore } from '@application/state/purchase.store';
import { SupplierStore } from '@application/state/supplier.store';
import { WarehouseStore } from '@application/state/warehouse.store';
import { WarehouseUseCase } from '@application/use-cases/warehouse.use-case';
import { CanDirective } from '@core/auth/can.directive';
import { ToastService } from '@core/feedback/toast.service';
import { Attachment, EntityId, IsoDate, RECEIPT_SOURCE_LABELS, ReceiptSource, StockMovement, UNIT_LABELS } from '@domain/models';
import { movementDate, todayIso } from '@domain/rules';
import { ArDatePipe, MoneyPipe, NumPipe } from '@shared/pipes/format.pipes';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { AttachmentList } from '@shared/ui/file-drop/attachment-list';
import { FileDrop } from '@shared/ui/file-drop/file-drop';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';
import { downloadCsv } from '../shared/csv';
import { ItemPicker } from '../shared/item-picker';
import { LocationPicker } from '../shared/location-picker';

interface InvoiceGroup {
  readonly key: string;
  readonly documentNo: string;
  readonly source: ReceiptSource | null;
  readonly date: IsoDate;
  readonly supplierId: EntityId | null;
  readonly lines: StockMovement[];
  readonly total: number;
  readonly attachments: Attachment[];
}

/** Section 1 of screen 4 — recording incoming material (تسجيل الوارد) and browsing invoices. */
@Component({
  selector: 'app-inbound-panel',
  imports: [RouterLink, CanDirective, Icon, Modal, EmptyState, FileDrop, AttachmentList, ItemPicker, LocationPicker, MoneyPipe, NumPipe, ArDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inbound-panel.html',
  styleUrls: ['../shared/warehouse-common.scss', './movements.scss'],
})
export class InboundPanel {
  private readonly toast = inject(ToastService);
  private readonly flows = inject(WarehouseUseCase);
  private readonly purchases = inject(PurchaseStore);
  protected readonly inventory = inject(InventoryStore);
  protected readonly warehouses = inject(WarehouseStore);
  protected readonly suppliers = inject(SupplierStore);

  /** Pre-selections coming from the URL. */
  readonly presetItem = input<EntityId | null>(null);
  readonly presetSupply = input<EntityId | null>(null);

  protected readonly unitLabels = UNIT_LABELS;
  protected readonly sourceLabels = RECEIPT_SOURCE_LABELS;
  protected readonly sources: ReceiptSource[] = ['supply', 'invoice', 'return', 'other'];
  protected readonly allSources = Object.keys(RECEIPT_SOURCE_LABELS) as ReceiptSource[];

  // Form
  protected readonly itemId = signal<EntityId | null>(null);
  protected readonly quantity = signal(0);
  protected readonly date = signal<IsoDate>(todayIso());
  protected readonly source = signal<ReceiptSource>('invoice');
  protected readonly purchaseId = signal<EntityId | null>(null);
  protected readonly documentNo = signal('');
  protected readonly supplierId = signal<EntityId | null>(null);
  protected readonly unitCost = signal(0);
  protected readonly warehouseId = signal<EntityId | null>(null);
  protected readonly shelfId = signal<EntityId | null>(null);
  protected readonly expiryDate = signal<IsoDate | ''>('');
  protected readonly attachments = signal<readonly Attachment[]>([]);
  protected readonly note = signal('');

  // Browser
  protected readonly view = signal<'invoices' | 'lines'>('invoices');
  protected readonly sourceFilter = signal<ReceiptSource | ''>('');
  protected readonly supplierFilter = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly search = signal('');
  protected readonly openInvoice = signal<InvoiceGroup | null>(null);
  protected readonly invoiceOpen = signal(false);

  protected readonly material = computed(() => this.inventory.find(this.itemId()));

  /** Supply requests that passed QC and wait to be received (optionally for the chosen item). */
  protected readonly awaiting = computed(() => {
    const item = this.itemId();
    return this.flows.awaitingReceipt().filter((r) => !item || !r.materialId || r.materialId === item);
  });

  protected readonly costPreview = computed(() => {
    const m = this.material();
    const ledger = this.inventory.ledger(this.itemId());
    const qty = this.quantity();
    if (!m || !ledger || qty <= 0) return null;
    const newQty = ledger.quantity + qty;
    const newValue = ledger.value + qty * this.unitCost();
    return {
      average: newQty ? newValue / newQty : this.unitCost(),
      fifo: ledger.lots.length ? ledger.lots[0].unitCost : this.unitCost(),
    };
  });

  protected readonly error = computed<string | null>(() => {
    if (!this.itemId()) return 'اختر رمز بطاقة العنصر';
    if (this.quantity() <= 0) return 'أدخل الكمية';
    if (!this.date()) return 'أدخل التاريخ';
    if (this.source() === 'supply' && !this.purchaseId()) return 'اختر رقم طلب التوريد';
    if (this.source() === 'invoice' && !this.documentNo().trim()) return 'أدخل رقم فاتورة الشراء';
    if (this.unitCost() < 0) return 'سعر الشراء غير صالح';
    if (!this.warehouseId()) return 'حدد المستودع';
    return null;
  });

  private readonly receipts = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.inventory.movements().filter((m) => {
      if (m.type !== 'receipt') return false;
      if (this.sourceFilter() && m.source !== this.sourceFilter()) return false;
      if (this.supplierFilter() && m.supplierId !== this.supplierFilter()) return false;
      const date = movementDate(m);
      if (this.from() && date < this.from()) return false;
      if (this.to() && date > this.to()) return false;
      if (term) {
        const material = this.inventory.find(m.materialId);
        if (!`${m.documentNo} ${material?.name ?? ''} ${material?.code ?? ''}`.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  });

  protected readonly lines = computed(() =>
    this.receipts()
      .slice(0, 200)
      .map((m) => ({ movement: m, material: this.inventory.find(m.materialId), place: this.warehouses.locationLabel(m.warehouseId, m.shelfId) })),
  );

  protected readonly invoices = computed<InvoiceGroup[]>(() => {
    const map = new Map<string, InvoiceGroup>();
    for (const m of this.receipts()) {
      const key = m.documentNo ? `${m.source}|${m.documentNo}` : `single|${m.id}`;
      const g = map.get(key);
      const amount = m.quantity * (m.unitCost ?? 0);
      if (g) {
        g.lines.push(m);
        g.attachments.push(...m.attachments);
        map.set(key, { ...g, total: g.total + amount });
      } else {
        map.set(key, { key, documentNo: m.documentNo, source: m.source, date: movementDate(m), supplierId: m.supplierId, lines: [m], total: amount, attachments: [...m.attachments] });
      }
    }
    return [...map.values()];
  });

  constructor() {
    effect(() => {
      const item = this.presetItem();
      if (item) untracked(() => this.selectItem(item));
    });
    effect(() => {
      const supply = this.presetSupply();
      if (supply) untracked(() => {
        this.source.set('supply');
        this.selectSupply(supply);
      });
    });
  }

  protected selectItem(id: EntityId | null): void {
    this.itemId.set(id);
    const m = this.material();
    if (!m) return;
    if (this.purchaseId() && this.purchases.find(this.purchaseId())?.materialId !== id) this.purchaseId.set(null);
    this.unitCost.set(Math.round(m.unitCost * 1000) / 1000);
    const place = m.locations.find((l) => l.quantity > 0) ?? m.locations[0];
    this.warehouseId.set(place?.warehouseId ?? null);
    this.shelfId.set(place?.shelfId ?? null);
  }

  protected setSource(source: ReceiptSource): void {
    this.source.set(source);
    if (source !== 'supply') this.purchaseId.set(null);
  }

  /** Choosing the supply-request number fills item, quantity, price and destination. */
  protected selectSupply(id: string): void {
    const request = this.purchases.find(id || null);
    this.purchaseId.set(request?.id ?? null);
    if (!request) return;
    if (request.materialId) this.selectItem(request.materialId);
    this.quantity.set(request.quantity);
    this.documentNo.set(request.number);
    this.supplierId.set(request.supplierId);
    if (request.unitPrice !== null) this.unitCost.set(request.unitPrice);
    if (request.warehouseId) {
      this.warehouseId.set(request.warehouseId);
      this.shelfId.set(this.material()?.locations.find((l) => l.warehouseId === request.warehouseId)?.shelfId ?? null);
    }
  }

  protected save(): void {
    if (this.error()) return;
    const m = this.material()!;
    const request = this.purchases.find(this.purchaseId());
    if (request && !request.materialId) {
      // A project purchase received here is linked to the chosen card.
      this.purchases.update(request.id, { materialId: m.id });
    }
    this.flows.receive({
      materialId: m.id,
      warehouseId: this.warehouseId()!,
      shelfId: this.shelfId(),
      quantity: this.quantity(),
      unitCost: this.unitCost(),
      date: this.date(),
      source: this.source(),
      documentNo: this.documentNo().trim(),
      reference: this.note().trim() || `${RECEIPT_SOURCE_LABELS[this.source()]} ${this.documentNo().trim()}`.trim(),
      supplierId: this.supplierId(),
      purchaseId: this.purchaseId(),
      expiryDate: this.expiryDate() || null,
      attachments: this.attachments(),
    });
    this.toast.success('تم تسجيل الوارد وتحديث السعر', `${this.quantity()} ${UNIT_LABELS[m.unit]} — ${m.name}`);
    this.resetForm();
  }

  protected resetForm(): void {
    this.itemId.set(null);
    this.quantity.set(0);
    this.date.set(todayIso());
    this.purchaseId.set(null);
    this.documentNo.set('');
    this.unitCost.set(0);
    this.warehouseId.set(null);
    this.shelfId.set(null);
    this.expiryDate.set('');
    this.attachments.set([]);
    this.note.set('');
  }

  protected addFiles(files: readonly Attachment[]): void {
    this.attachments.update((list) => [...list, ...files]);
  }

  protected removeFile(id: EntityId): void {
    this.attachments.update((list) => list.filter((f) => f.id !== id));
  }

  protected showInvoice(group: InvoiceGroup): void {
    this.openInvoice.set(group);
    this.invoiceOpen.set(true);
  }

  protected exportCsv(): void {
    downloadCsv(
      'receipts',
      ['التاريخ', 'المصدر', 'رقم المستند', 'المورد', 'الرمز', 'العنصر', 'الكمية', 'سعر الوحدة', 'المبلغ', 'الموقع'],
      this.lines().map((l) => [
        movementDate(l.movement),
        l.movement.source ? RECEIPT_SOURCE_LABELS[l.movement.source] : '',
        l.movement.documentNo,
        this.suppliers.find(l.movement.supplierId)?.name ?? '',
        l.material?.code,
        l.material?.name,
        l.movement.quantity,
        l.movement.unitCost ?? '',
        (l.movement.quantity * (l.movement.unitCost ?? 0)).toFixed(2),
        l.place,
      ]),
    );
  }
}
