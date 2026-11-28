import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthorizationService } from '@application/auth/authorization.service';
import { InventoryStore } from '@application/state/inventory.store';
import { CatalogOptionStore, WarehouseStore } from '@application/state/warehouse.store';
import { CanDirective } from '@core/auth/can.directive';
import { ConfirmService } from '@core/feedback/confirm.service';
import { ToastService } from '@core/feedback/toast.service';
import {
  Attachment,
  COST_METHOD_LABELS,
  CostMethod,
  EntityId,
  MATERIAL_KIND_LABELS,
  MaterialKind,
  MOVEMENT_LABELS,
  RECEIPT_SOURCE_LABELS,
  StockLocation,
  StockMovementType,
  Unit,
  UNIT_LABELS,
} from '@domain/models';
import { movementDate, previewIssueCost, sellingPrice, stockLevel, suggestedSupply, todayIso } from '@domain/rules';
import { ArDatePipe, MoneyPipe, NumPipe } from '@shared/pipes/format.pipes';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { AttachmentList } from '@shared/ui/file-drop/attachment-list';
import { FileDrop } from '@shared/ui/file-drop/file-drop';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatCard } from '@shared/ui/stat-card/stat-card';
import { downloadCsv } from '../shared/csv';
import { LocationPicker } from '../shared/location-picker';

type Tab = 'info' | 'locations' | 'history' | 'pricing';

interface EditDraft {
  name: string;
  categoryId: string;
  natureId: string;
  unit: Unit;
  kind: MaterialKind;
  minStock: number;
  maxStock: number;
  notes: string;
}

/** Product card: data, locations, history (سجل العنصر), cost and selling price. */
@Component({
  selector: 'app-item-card-page',
  imports: [RouterLink, CanDirective, PageHeader, StatCard, Icon, Modal, EmptyState, FileDrop, AttachmentList, LocationPicker, MoneyPipe, NumPipe, ArDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './item-card-page.html',
  styleUrls: ['../shared/warehouse-common.scss', './item-card-page.scss'],
})
export class ItemCardPage {
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly inventory = inject(InventoryStore);
  protected readonly options = inject(CatalogOptionStore);
  protected readonly warehouses = inject(WarehouseStore);

  readonly materialId = input.required<string>();

  protected readonly canManage = inject(AuthorizationService).can('inventory.manage');

  protected readonly unitLabels = UNIT_LABELS;
  protected readonly units = Object.keys(UNIT_LABELS) as Unit[];
  protected readonly kindLabels = MATERIAL_KIND_LABELS;
  protected readonly kinds = Object.keys(MATERIAL_KIND_LABELS) as MaterialKind[];
  protected readonly methodLabels = COST_METHOD_LABELS;
  protected readonly methods = Object.keys(COST_METHOD_LABELS) as CostMethod[];
  protected readonly movementLabels = MOVEMENT_LABELS;
  protected readonly sourceLabels = RECEIPT_SOURCE_LABELS;
  protected readonly historyTypes: StockMovementType[] = ['receipt', 'issue', 'transfer', 'writeoff', 'consumption', 'adjustment'];

  protected readonly tab = signal<Tab>('info');
  protected readonly historyType = signal<StockMovementType | ''>('');
  protected readonly pricingOpen = signal(false);
  protected readonly previewQty = signal(0);

  protected readonly editOpen = signal(false);
  protected readonly draft = signal<EditDraft | null>(null);

  protected readonly transferOpen = signal(false);
  protected readonly transferFrom = signal<StockLocation | null>(null);
  protected readonly toWarehouse = signal<EntityId | null>(null);
  protected readonly toShelf = signal<EntityId | null>(null);
  protected readonly transferQty = signal(0);
  protected readonly transferRef = signal('');

  protected readonly placeOpen = signal(false);
  protected readonly placeWarehouse = signal<EntityId | null>(null);
  protected readonly placeShelf = signal<EntityId | null>(null);

  protected readonly material = computed(() => this.inventory.find(this.materialId()));
  protected readonly ledger = computed(() => this.inventory.ledger(this.materialId()));
  protected readonly level = computed(() => {
    const m = this.material();
    return m ? stockLevel(m.stock, m.minStock, m.maxStock) : 'ok';
  });
  protected readonly sellPrice = computed(() => {
    const m = this.material();
    return m ? sellingPrice(m.unitCost, m.margin) : 0;
  });
  protected readonly supply = computed(() => {
    const m = this.material();
    return m ? suggestedSupply(m) : 0;
  });

  /** History rows, newest first (ledger runs oldest first). */
  protected readonly history = computed(() => {
    const rows = this.ledger()?.rows ?? [];
    const type = this.historyType();
    return [...rows]
      .filter((r) => !type || r.movement.type === type)
      .reverse()
      .map((row) => ({ ...row, date: movementDate(row.movement), place: this.warehouses.locationLabel(row.movement.warehouseId, row.movement.shelfId) }));
  });

  protected readonly locations = computed(() =>
    (this.material()?.locations ?? []).map((location) => ({
      location,
      warehouse: this.warehouses.find(location.warehouseId),
      label: this.warehouses.locationLabel(location.warehouseId, location.shelfId),
      path: this.warehouses.path(location.warehouseId),
    })),
  );

  protected readonly purchases = computed(() => (this.ledger()?.rows ?? []).filter((r) => r.quantity > 0 && r.movement.type !== 'transfer'));
  protected readonly issuePreview = computed(() => {
    const ledger = this.ledger();
    const m = this.material();
    const qty = this.previewQty();
    if (!ledger || !m || qty <= 0) return null;
    const cost = previewIssueCost(ledger, m.costMethod, qty);
    return { qty, cost, unit: cost / qty, remaining: Math.max(0, ledger.quantity - qty) };
  });

  // ---------- Edit ----------
  protected openEdit(): void {
    const m = this.material();
    if (!m) return;
    this.draft.set({
      name: m.name,
      categoryId: m.categoryId ?? '',
      natureId: m.natureId ?? '',
      unit: m.unit,
      kind: m.kind,
      minStock: m.minStock,
      maxStock: m.maxStock,
      notes: m.notes,
    });
    this.editOpen.set(true);
  }

  protected patchDraft(changes: Partial<EditDraft>): void {
    this.draft.update((d) => (d ? { ...d, ...changes } : d));
  }

  protected saveEdit(): void {
    const d = this.draft();
    if (!d || !d.name.trim()) return;
    if (d.maxStock && d.maxStock < d.minStock) {
      this.toast.warning('القيم الحرجة غير صحيحة', 'الحد الأقصى أقل من الحد الأدنى');
      return;
    }
    this.inventory.update(this.materialId(), {
      name: d.name.trim(),
      categoryId: d.categoryId || null,
      natureId: d.natureId || null,
      unit: d.unit,
      kind: d.kind,
      minStock: d.minStock,
      maxStock: d.maxStock,
      notes: d.notes.trim(),
    });
    this.editOpen.set(false);
    this.toast.success('تم تحديث البطاقة');
  }

  protected async setMethod(method: CostMethod): Promise<void> {
    const m = this.material();
    if (!m || m.costMethod === method) return;
    const ok = await this.confirm.ask({
      title: 'تغيير طريقة حساب التكلفة',
      message: `سيُعاد تقييم المخزون وتكلفة الوحدة وفق «${COST_METHOD_LABELS[method]}». عادةً تعتمد الشركة طريقة واحدة وتسجل جميع الحركات وفقها.`,
      confirmLabel: 'تغيير',
    });
    if (ok) this.inventory.update(m.id, { costMethod: method });
  }

  protected setMargin(type: 'amount' | 'percent', value: number): void {
    if (value < 0) return;
    this.inventory.update(this.materialId(), { margin: { type, value } });
  }

  protected addFiles(files: readonly Attachment[]): void {
    this.inventory.addSpecFiles(this.materialId(), files);
  }

  protected removeFile(id: EntityId): void {
    this.inventory.removeSpecFile(this.materialId(), id);
  }

  // ---------- Locations ----------
  protected openTransfer(location: StockLocation): void {
    this.transferFrom.set(location);
    this.toWarehouse.set(null);
    this.toShelf.set(null);
    this.transferQty.set(location.quantity);
    this.transferRef.set('');
    this.transferOpen.set(true);
  }

  protected transferError(): string | null {
    const from = this.transferFrom();
    if (!from) return 'اختر الموقع';
    if (!this.toWarehouse()) return 'اختر المستودع المستلم';
    if (this.toWarehouse() === from.warehouseId && this.toShelf() === from.shelfId) return 'الموقع المستلم هو نفسه المصدر';
    if (this.transferQty() <= 0) return 'أدخل الكمية';
    if (this.transferQty() > from.quantity) return 'الكمية أكبر من المتوفر في الموقع';
    return null;
  }

  protected confirmTransfer(): void {
    const from = this.transferFrom();
    if (!from || this.transferError()) return;
    const result = this.inventory.transfer({
      materialId: this.materialId(),
      from,
      to: { warehouseId: this.toWarehouse()!, shelfId: this.toShelf() },
      quantity: this.transferQty(),
      date: todayIso(),
      reference: this.transferRef().trim() || 'مناقلة بين المستودعات',
    });
    if (!result.allowed) {
      this.toast.warning('لم تتم المناقلة', result.reason);
      return;
    }
    this.transferOpen.set(false);
    this.toast.success('تمت المناقلة', `${this.transferQty()} ← ${this.warehouses.locationLabel(this.toWarehouse(), this.toShelf())}`);
  }

  protected openPlace(): void {
    this.placeWarehouse.set(null);
    this.placeShelf.set(null);
    this.placeOpen.set(true);
  }

  protected savePlace(): void {
    if (!this.placeWarehouse()) return;
    this.inventory.addLocation(this.materialId(), this.placeWarehouse()!, this.placeShelf());
    this.placeOpen.set(false);
  }

  protected removePlace(location: StockLocation): void {
    this.inventory.removeEmptyLocation(this.materialId(), location.warehouseId, location.shelfId);
  }

  protected exportHistory(): void {
    const m = this.material();
    downloadCsv(
      `history-${m?.code ?? 'item'}`,
      ['التاريخ', 'العملية', 'الكمية', 'سعر الوحدة', 'المبلغ الإجمالي', 'الكمية المتبقية', 'متوسط تكلفة الوحدة', 'تكلفة المخزون المتبقي', 'المرجع', 'الموقع'],
      this.history().map((r) => [
        r.date,
        MOVEMENT_LABELS[r.movement.type],
        r.quantity,
        r.unitPrice?.toFixed(4) ?? '',
        r.amount?.toFixed(2) ?? '',
        r.balanceQty,
        r.averageCost.toFixed(4),
        r.balanceValue.toFixed(2),
        r.movement.documentNo || r.movement.reference,
        r.place,
      ]),
    );
  }
}
