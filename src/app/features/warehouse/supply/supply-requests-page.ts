import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { InventoryStore } from '@application/state/inventory.store';
import { PurchaseStore } from '@application/state/purchase.store';
import { SupplierStore } from '@application/state/supplier.store';
import { WarehouseStore } from '@application/state/warehouse.store';
import { CanDirective } from '@core/auth/can.directive';
import { ToastService } from '@core/feedback/toast.service';
import { EntityId, PRIORITY_LABELS, PurchasePriority, PurchaseRequest, UNIT_LABELS } from '@domain/models';
import {
  currentStageIndex,
  etaDelayDays,
  isStageDone,
  purchaseProgress,
  purchaseStatusLabel,
  stockLevel,
  suggestedSupply,
  todayIso,
} from '@domain/rules';
import { ArDatePipe, MoneyPipe, NumPipe } from '@shared/pipes/format.pipes';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { ProgressBar } from '@shared/ui/progress/progress';
import { StatCard } from '@shared/ui/stat-card/stat-card';
import { StageDots } from '@features/procurement/shared/stage-dots';
import { ItemPicker } from '../shared/item-picker';

type Segment = 'all' | 'open' | 'awaiting' | 'received' | 'rejected' | 'late';
type Sort = 'number' | 'eta' | 'priority' | 'stage';

const PRIORITY_ORDER: Record<PurchasePriority, number> = { urgent: 0, high: 1, normal: 2 };

/** Screen 3 — warehouse supply requests, their stage and tracking. */
@Component({
  selector: 'app-supply-requests-page',
  imports: [RouterLink, CanDirective, PageHeader, StatCard, Icon, Modal, EmptyState, ProgressBar, StageDots, ItemPicker, MoneyPipe, NumPipe, ArDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './supply-requests-page.html',
  styleUrls: ['../shared/warehouse-common.scss', './supply-requests-page.scss'],
})
export class SupplyRequestsPage implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly purchases = inject(PurchaseStore);
  protected readonly inventory = inject(InventoryStore);
  protected readonly warehouses = inject(WarehouseStore);
  protected readonly suppliers = inject(SupplierStore);

  protected readonly unitLabels = UNIT_LABELS;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly priorities = Object.keys(PRIORITY_LABELS) as PurchasePriority[];
  protected readonly today = todayIso();

  protected readonly segment = signal<Segment>('all');
  protected readonly sort = signal<Sort>('number');
  protected readonly search = signal('');
  protected readonly warehouseFilter = signal('');

  protected readonly creating = signal(false);
  protected readonly itemId = signal<EntityId | null>(null);
  protected readonly quantity = signal(0);
  protected readonly priority = signal<PurchasePriority>('normal');
  protected readonly destination = signal<EntityId | null>(null);

  private readonly supplyRequests = computed(() => this.purchases.sorted().filter((r) => r.materialId));

  private readonly tests: Record<Segment, (r: PurchaseRequest) => boolean> = {
    all: () => true,
    open: (r) => !isStageDone(r, 'qualityControl') && r.qualityResult !== 'failed',
    awaiting: (r) => r.qualityResult === 'passed' && isStageDone(r, 'qualityControl') && !isStageDone(r, 'warehouseReceipt'),
    received: (r) => isStageDone(r, 'warehouseReceipt'),
    rejected: (r) => r.qualityResult === 'failed',
    late: (r) => etaDelayDays(r, this.today) > 0 && !isStageDone(r, 'warehouseReceipt'),
  };

  protected readonly segments: { key: Segment; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'open', label: 'قيد الشراء' },
    { key: 'awaiting', label: 'اجتازت الجودة — بانتظار الاستلام' },
    { key: 'late', label: 'متأخرة' },
    { key: 'rejected', label: 'مرفوضة بالجودة' },
    { key: 'received', label: 'مستلمة' },
  ];

  protected readonly counts = computed(() => {
    const result = {} as Record<Segment, number>;
    for (const s of this.segments) result[s.key] = this.supplyRequests().filter(this.tests[s.key]).length;
    return result;
  });

  protected readonly rows = computed(() => {
    const term = this.search().trim().toLowerCase();
    const scope = this.warehouseFilter() ? this.warehouses.subtreeIds(this.warehouseFilter()) : null;
    const rows = this.supplyRequests()
      .filter(this.tests[this.segment()])
      .filter((r) => !scope || (r.warehouseId !== null && scope.has(r.warehouseId)))
      .map((request) => ({
        request,
        material: this.inventory.find(request.materialId),
        supplier: this.suppliers.find(request.supplierId),
        status: purchaseStatusLabel(request),
        stage: currentStageIndex(request),
        progress: purchaseProgress(request),
        delay: etaDelayDays(request, this.today),
        awaiting: this.tests.awaiting(request),
        received: isStageDone(request, 'warehouseReceipt'),
      }))
      .filter((r) => !term || `${r.request.number} ${r.request.title} ${r.material?.code ?? ''}`.toLowerCase().includes(term));
    const sort = this.sort();
    return rows.sort((a, b) =>
      sort === 'eta'
        ? (a.request.eta ?? '9999').localeCompare(b.request.eta ?? '9999')
        : sort === 'priority'
          ? PRIORITY_ORDER[a.request.priority] - PRIORITY_ORDER[b.request.priority]
          : sort === 'stage'
            ? b.stage - a.stage
            : b.request.number.localeCompare(a.request.number),
    );
  });

  /** Items under their minimum that have no open supply request yet. */
  protected readonly suggestions = computed(() => {
    const open = new Set(this.supplyRequests().filter((r) => !isStageDone(r, 'warehouseReceipt')).map((r) => r.materialId));
    return this.inventory
      .all()
      .filter((m) => !open.has(m.id) && ['low', 'empty'].includes(stockLevel(m.stock, m.minStock, m.maxStock)))
      .map((m) => ({ material: m, quantity: suggestedSupply(m) }));
  });

  protected readonly totals = computed(() => {
    const all = this.supplyRequests();
    return {
      open: all.filter((r) => !isStageDone(r, 'warehouseReceipt')).length,
      awaiting: this.counts().awaiting,
      late: this.counts().late,
      committed: all.filter((r) => r.unitPrice !== null && !isStageDone(r, 'warehouseReceipt')).reduce((s, r) => s + (r.unitPrice ?? 0) * r.quantity, 0),
    };
  });

  protected readonly selected = computed(() => this.inventory.find(this.itemId()));
  protected readonly selectedInfo = computed(() => {
    const m = this.selected();
    if (!m) return null;
    const ledger = this.inventory.ledger(m.id);
    const lastPurchase = [...(ledger?.rows ?? [])].reverse().find((r) => r.quantity > 0 && r.movement.type === 'receipt');
    return {
      material: m,
      level: stockLevel(m.stock, m.minStock, m.maxStock),
      suggested: suggestedSupply(m),
      lastPrice: lastPurchase?.unitPrice ?? null,
      lastDate: lastPurchase?.movement.date ?? null,
      places: m.locations.filter((l) => l.quantity > 0).map((l) => `${this.warehouses.locationLabel(l.warehouseId, l.shelfId)}: ${l.quantity}`),
      open: this.supplyRequests().filter((r) => r.materialId === m.id && !isStageDone(r, 'warehouseReceipt')),
    };
  });

  ngOnInit(): void {
    const item = this.route.snapshot.queryParamMap.get('item');
    if (item && this.inventory.find(item)) this.openCreate(item);
  }

  protected openCreate(materialId: EntityId | null = null, quantity?: number): void {
    this.itemId.set(materialId);
    this.priority.set('normal');
    this.applyItemDefaults(quantity);
    this.creating.set(true);
  }

  protected selectItem(id: EntityId | null): void {
    this.itemId.set(id);
    this.applyItemDefaults();
  }

  private applyItemDefaults(quantity?: number): void {
    const m = this.selected();
    this.quantity.set(quantity ?? (m ? suggestedSupply(m) : 0));
    this.destination.set(m?.locations[0]?.warehouseId ?? null);
  }

  protected create(): void {
    const m = this.selected();
    if (!m || this.quantity() <= 0) return;
    const request = this.purchases.create({
      title: m.name,
      projectId: null,
      nodeId: null,
      materialId: m.id,
      warehouseId: this.destination(),
      quantity: this.quantity(),
      unit: m.unit,
      priority: this.priority(),
    });
    this.creating.set(false);
    this.toast.success('تم إنشاء طلب التوريد', `${request.number} — أكمل طلب العروض والشراء حتى فحص الجودة`);
    void this.router.navigate(['/procurement/requests', request.id]);
  }

  protected open(request: PurchaseRequest): void {
    void this.router.navigate(['/procurement/requests', request.id]);
  }

  protected receive(request: PurchaseRequest, event: Event): void {
    event.stopPropagation();
    void this.router.navigate(['/warehouse/movements'], { queryParams: { tab: 'in', supply: request.id } });
  }
}
