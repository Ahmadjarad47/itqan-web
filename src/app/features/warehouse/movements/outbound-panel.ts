import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { InventoryStore } from '@application/state/inventory.store';
import { DepartmentStore } from '@application/state/organization.store';
import { ProjectStore } from '@application/state/project.store';
import { RequisitionStore, WarehouseStore } from '@application/state/warehouse.store';
import { WarehouseUseCase } from '@application/use-cases/warehouse.use-case';
import { CanDirective } from '@core/auth/can.directive';
import { ToastService } from '@core/feedback/toast.service';
import { EntityId, IsoDate, Requisition, REQUISITION_STATUS_LABELS, RequisitionStatus, UNIT_LABELS } from '@domain/models';
import { diffDays, previewIssueCost, sellingPrice, todayIso } from '@domain/rules';
import { ArDatePipe, MoneyPipe, NumPipe } from '@shared/pipes/format.pipes';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';
import { ItemPicker } from '../shared/item-picker';
import { LocationPicker } from '../shared/location-picker';
import { MovementLog } from '../shared/movement-log';
import { RequisitionFormDialog } from './requisition-form-dialog';

export type OutboundReason = 'requisition' | 'transfer' | 'writeoff';

const REASONS: { key: OutboundReason; label: string }[] = [
  { key: 'requisition', label: 'طلب احتياج لأحد المشاريع / الأقسام' },
  { key: 'transfer', label: 'مناقلة بين المستودعات' },
  { key: 'writeoff', label: 'شطب من المخزون (إتلاف)' },
];

type ReqSort = 'due' | 'request' | 'status' | 'number';

const STATUS_ORDER: Record<RequisitionStatus, number> = { new: 0, preparing: 1, ready: 2, delivered: 3, cancelled: 4 };

interface IssueLine {
  lineId: EntityId;
  materialId: EntityId;
  requested: number;
  note: string;
  warehouseId: EntityId | null;
  shelfId: EntityId | null;
  quantity: number;
  sellPrice: number | null;
}

/** Section 2 of screen 4 — outgoing material (تسجيل الصادر). */
@Component({
  selector: 'app-outbound-panel',
  imports: [CanDirective, Icon, Modal, EmptyState, ItemPicker, LocationPicker, MovementLog, RequisitionFormDialog, MoneyPipe, NumPipe, ArDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './outbound-panel.html',
  styleUrls: ['../shared/warehouse-common.scss', './movements.scss'],
})
export class OutboundPanel {
  private readonly toast = inject(ToastService);
  private readonly flows = inject(WarehouseUseCase);
  protected readonly inventory = inject(InventoryStore);
  protected readonly requisitions = inject(RequisitionStore);
  protected readonly warehouses = inject(WarehouseStore);
  protected readonly departments = inject(DepartmentStore);
  protected readonly projects = inject(ProjectStore);

  readonly presetItem = input<EntityId | null>(null);

  protected readonly reasons = REASONS;
  protected readonly unitLabels = UNIT_LABELS;
  protected readonly statusLabels = REQUISITION_STATUS_LABELS;
  protected readonly statuses = Object.keys(REQUISITION_STATUS_LABELS) as RequisitionStatus[];
  protected readonly today = todayIso();

  protected readonly reason = signal<OutboundReason>('requisition');

  // Requisition board
  protected readonly statusFilter = signal<RequisitionStatus | 'open' | ''>('open');
  protected readonly reqSort = signal<ReqSort>('due');
  protected readonly reqSearch = signal('');
  protected readonly formOpen = signal(false);
  protected readonly formOrigin = signal<'system' | 'paper'>('system');

  // Issue dialog
  protected readonly issueOpen = signal(false);
  protected readonly issuing = signal<Requisition | null>(null);
  protected readonly issueLines = signal<IssueLine[]>([]);
  protected readonly issueDate = signal<IsoDate>(todayIso());

  // Transfer / write-off form
  protected readonly itemId = signal<EntityId | null>(null);
  protected readonly fromWarehouse = signal<EntityId | null>(null);
  protected readonly fromShelf = signal<EntityId | null>(null);
  protected readonly toWarehouse = signal<EntityId | null>(null);
  protected readonly toShelf = signal<EntityId | null>(null);
  protected readonly quantity = signal(0);
  protected readonly date = signal<IsoDate>(todayIso());
  protected readonly reference = signal('');

  protected readonly rows = computed(() => {
    const filter = this.statusFilter();
    const term = this.reqSearch().trim().toLowerCase();
    const sort = this.reqSort();
    return this.requisitions
      .all()
      .filter((r) => !filter || (filter === 'open' ? r.status !== 'delivered' && r.status !== 'cancelled' : r.status === filter))
      .map((r) => ({
        requisition: r,
        party: this.departments.find(r.departmentId)?.name ?? r.requester,
        project: this.projects.find(r.projectId),
        overdue: r.dueDate < this.today && r.status !== 'delivered' && r.status !== 'cancelled',
        daysLeft: diffDays(this.today, r.dueDate),
        available: r.lines.every((l) => (this.inventory.find(l.materialId)?.stock ?? 0) >= l.quantity),
      }))
      .filter((r) => !term || `${r.requisition.number} ${r.party} ${r.requisition.requester}`.toLowerCase().includes(term))
      .sort((a, b) => {
        const x = a.requisition;
        const y = b.requisition;
        if (sort === 'request') return y.requestDate.localeCompare(x.requestDate);
        if (sort === 'status') return STATUS_ORDER[x.status] - STATUS_ORDER[y.status] || x.dueDate.localeCompare(y.dueDate);
        if (sort === 'number') return y.number.localeCompare(x.number);
        return x.dueDate.localeCompare(y.dueDate);
      });
  });

  protected readonly counts = computed(() => {
    const all = this.requisitions.all();
    return {
      open: this.requisitions.open().length,
      new: all.filter((r) => r.status === 'new').length,
      preparing: all.filter((r) => r.status === 'preparing').length,
      ready: all.filter((r) => r.status === 'ready').length,
      overdue: this.requisitions.open().filter((r) => r.dueDate < this.today).length,
    };
  });

  protected readonly issueTotals = computed(() => {
    let cost = 0;
    let sale = 0;
    for (const line of this.issueLines()) {
      const m = this.inventory.find(line.materialId);
      const ledger = this.inventory.ledger(line.materialId);
      if (!m || !ledger || line.quantity <= 0) continue;
      cost += previewIssueCost(ledger, m.costMethod, line.quantity);
      sale += (line.sellPrice ?? 0) * line.quantity;
    }
    return { cost, sale };
  });

  protected readonly issueError = computed<string | null>(() => {
    const lines = this.issueLines();
    if (!lines.some((l) => l.quantity > 0)) return 'أدخل كمية لعنصر واحد على الأقل';
    // A requisition may list an item twice, so lines of one location are also checked together.
    const claimed = new Map<string, number>();
    for (const l of lines) {
      if (l.quantity <= 0) continue;
      if (!l.warehouseId) return 'حدد موقع الصرف لكل عنصر';
      if (l.sellPrice !== null && l.sellPrice < 0) return 'سعر البيع لا يمكن أن يكون سالباً';
      const available = this.available(l.materialId, l.warehouseId, l.shelfId);
      if (l.quantity > available) return 'الكمية أكبر من المتوفر في الموقع المحدد';
      const key = `${l.materialId}|${l.warehouseId}|${l.shelfId}`;
      const total = Math.round(((claimed.get(key) ?? 0) + l.quantity) * 10000) / 10000;
      if (total > available) return 'مجموع الكميات أكبر من المتوفر في الموقع المحدد';
      claimed.set(key, total);
    }
    return null;
  });

  protected readonly material = computed(() => this.inventory.find(this.itemId()));
  protected readonly moveCost = computed(() => {
    const m = this.material();
    const ledger = this.inventory.ledger(this.itemId());
    return m && ledger && this.quantity() > 0 ? previewIssueCost(ledger, m.costMethod, this.quantity()) : 0;
  });

  protected readonly moveError = computed<string | null>(() => {
    if (!this.itemId()) return 'اختر رمز بطاقة العنصر';
    if (!this.fromWarehouse()) return 'حدد الموقع المصدر';
    if (this.quantity() <= 0) return 'أدخل الكمية';
    if (this.quantity() > this.available(this.itemId()!, this.fromWarehouse()!, this.fromShelf())) return 'الكمية أكبر من المتوفر';
    if (this.reason() === 'transfer') {
      if (!this.toWarehouse()) return 'حدد المستودع المستلم';
      if (this.toWarehouse() === this.fromWarehouse() && this.toShelf() === this.fromShelf()) return 'الموقع المستلم هو نفسه المصدر';
    }
    if (this.reason() === 'writeoff' && !this.reference().trim()) return 'اذكر سبب الشطب';
    return null;
  });

  constructor() {
    effect(() => {
      const item = this.presetItem();
      if (item) untracked(() => this.selectItem(item));
    });
  }

  protected available(materialId: EntityId, warehouseId: EntityId | null, shelfId: EntityId | null): number {
    return this.inventory.find(materialId)?.locations.find((l) => l.warehouseId === warehouseId && l.shelfId === shelfId)?.quantity ?? 0;
  }

  protected setStatus(requisition: Requisition, status: RequisitionStatus): void {
    if (status === 'delivered') {
      this.openIssue(requisition);
      return;
    }
    this.requisitions.setStatus(requisition.id, status);
    this.toast.info(`${requisition.number}: ${REQUISITION_STATUS_LABELS[status]}`);
  }

  protected newRequisition(origin: 'system' | 'paper'): void {
    this.formOrigin.set(origin);
    this.formOpen.set(true);
  }

  protected openIssue(requisition: Requisition): void {
    this.issuing.set(requisition);
    this.issueDate.set(todayIso());
    this.issueLines.set(
      requisition.lines.map((line) => {
        const m = this.inventory.find(line.materialId);
        // Prefer the requested warehouse, then the fullest place.
        const places = (m?.locations ?? []).filter((l) => l.quantity > 0).sort((a, b) => b.quantity - a.quantity);
        const place = places.find((l) => l.warehouseId === requisition.warehouseId && l.quantity >= line.quantity) ?? places.find((l) => l.quantity >= line.quantity) ?? places[0];
        return {
          lineId: line.id,
          materialId: line.materialId,
          requested: line.quantity,
          note: line.note,
          warehouseId: place?.warehouseId ?? null,
          shelfId: place?.shelfId ?? null,
          quantity: Math.min(line.quantity, place?.quantity ?? 0),
          sellPrice: null,
        };
      }),
    );
    this.issueOpen.set(true);
  }

  protected patchLine(lineId: EntityId, changes: Partial<IssueLine>): void {
    this.issueLines.update((lines) => lines.map((l) => (l.lineId === lineId ? { ...l, ...changes } : l)));
  }

  protected suggestSell(line: IssueLine): void {
    const m = this.inventory.find(line.materialId);
    if (m) this.patchLine(line.lineId, { sellPrice: Math.round(sellingPrice(m.unitCost, m.margin) * 100) / 100 });
  }

  protected lineCost(line: IssueLine): number {
    const m = this.inventory.find(line.materialId);
    const ledger = this.inventory.ledger(line.materialId);
    return m && ledger && line.quantity > 0 ? previewIssueCost(ledger, m.costMethod, line.quantity) / line.quantity : (m?.unitCost ?? 0);
  }

  protected confirmIssue(): void {
    const requisition = this.issuing();
    if (!requisition || this.issueError()) return;
    const result = this.flows.issueRequisition(requisition.id, this.issueLines(), this.issueDate());
    if (!result.allowed) {
      this.toast.warning('لم يتم الصرف', result.reason);
      return;
    }
    this.issueOpen.set(false);
    this.toast.success('تم الصرف وتحديث المخزون وسجل العناصر', requisition.number);
  }

  protected selectItem(id: EntityId | null): void {
    this.itemId.set(id);
    const place = this.material()?.locations.filter((l) => l.quantity > 0).sort((a, b) => b.quantity - a.quantity)[0];
    this.fromWarehouse.set(place?.warehouseId ?? null);
    this.fromShelf.set(place?.shelfId ?? null);
  }

  protected confirmMove(): void {
    if (this.moveError()) return;
    const m = this.material()!;
    if (this.reason() === 'transfer') {
      const result = this.inventory.transfer({
        materialId: m.id,
        from: { warehouseId: this.fromWarehouse()!, shelfId: this.fromShelf() },
        to: { warehouseId: this.toWarehouse()!, shelfId: this.toShelf() },
        quantity: this.quantity(),
        date: this.date(),
        reference: this.reference().trim() || 'مناقلة بين المستودعات',
      });
      if (!result.allowed) {
        this.toast.warning('لم تتم المناقلة', result.reason);
        return;
      }
      this.toast.success('تمت المناقلة', `${m.name} → ${this.warehouses.locationLabel(this.toWarehouse(), this.toShelf())}`);
    } else {
      const movement = this.inventory.issue({
        materialId: m.id,
        type: 'writeoff',
        warehouseId: this.fromWarehouse(),
        shelfId: this.fromShelf(),
        quantity: this.quantity(),
        date: this.date(),
        reference: `شطب: ${this.reference().trim()}`,
      });
      if (!movement) {
        this.toast.warning('لم يتم الشطب', 'الكمية أكبر من المتوفر');
        return;
      }
      this.toast.success('تم شطب الكمية من المخزون', m.name);
    }
    this.itemId.set(null);
    this.quantity.set(0);
    this.reference.set('');
    this.toWarehouse.set(null);
    this.toShelf.set(null);
  }
}
