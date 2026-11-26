import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { WarehouseReportsQuery } from '@application/queries/warehouse-reports.query';
import { InventoryStore } from '@application/state/inventory.store';
import { EmployeeStore } from '@application/state/organization.store';
import { CatalogOptionStore, WarehouseStore } from '@application/state/warehouse.store';
import { CanDirective } from '@core/auth/can.directive';
import { ConfirmService } from '@core/feedback/confirm.service';
import { ToastService } from '@core/feedback/toast.service';
import { EntityId, Shelf, UNIT_LABELS } from '@domain/models';
import { stockLevel } from '@domain/rules';
import { MoneyPipe, NumPipe } from '@shared/pipes/format.pipes';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatCard } from '@shared/ui/stat-card/stat-card';
import { MovementLog } from '../shared/movement-log';
import { WarehouseFormDialog } from '../shared/warehouse-form-dialog';
import { WarehouseReports } from '../shared/warehouse-reports';

type Tab = 'items' | 'shelves' | 'movements' | 'reports';

/** One warehouse: shelves, items with their quantities, movement log and reports. */
@Component({
  selector: 'app-warehouse-detail-page',
  imports: [RouterLink, CanDirective, PageHeader, StatCard, Icon, Modal, EmptyState, MoneyPipe, NumPipe, MovementLog, WarehouseReports, WarehouseFormDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './warehouse-detail-page.html',
  styleUrls: ['../shared/warehouse-common.scss', './warehouse-detail-page.scss'],
})
export class WarehouseDetailPage {
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly inventory = inject(InventoryStore);
  private readonly reports = inject(WarehouseReportsQuery);
  protected readonly warehouses = inject(WarehouseStore);
  protected readonly employees = inject(EmployeeStore);
  protected readonly options = inject(CatalogOptionStore);

  readonly warehouseId = input.required<string>();

  protected readonly unitLabels = UNIT_LABELS;
  protected readonly tab = signal<Tab>('items');
  protected readonly shelfFilter = signal<string>('');
  protected readonly includeChildren = signal(true);
  protected readonly search = signal('');
  protected readonly editing = signal(false);
  protected readonly addingChild = signal(false);

  protected readonly shelfOpen = signal(false);
  protected readonly shelfEditing = signal<Shelf | null>(null);
  protected readonly shelfCode = signal('');
  protected readonly shelfName = signal('');
  protected readonly rangePrefix = signal('');
  protected readonly rangeCount = signal(5);

  protected readonly warehouse = computed(() => this.warehouses.find(this.warehouseId()));
  protected readonly parent = computed(() => this.warehouses.find(this.warehouse()?.parentId));
  protected readonly children = computed(() => this.warehouses.children(this.warehouseId()));
  protected readonly manager = computed(() => this.employees.find(this.warehouse()?.managerId));
  protected readonly summary = computed(() => this.reports.summaries().get(this.warehouseId()));
  protected readonly scope = computed<ReadonlySet<EntityId>>(() =>
    this.includeChildren() ? this.warehouses.subtreeIds(this.warehouseId()) : new Set([this.warehouseId()]),
  );

  /** Items stored here, one row per item and shelf. */
  protected readonly stockRows = computed(() => {
    const scope = this.scope();
    const term = this.search().trim().toLowerCase();
    const rows = [];
    for (const material of this.inventory.sorted()) {
      if (term && !`${material.name} ${material.code}`.toLowerCase().includes(term)) continue;
      for (const location of material.locations) {
        if (!scope.has(location.warehouseId)) continue;
        if (this.shelfFilter() && (location.shelfId ?? '') !== this.shelfFilter()) continue;
        rows.push({
          material,
          location,
          place: this.warehouses.locationLabel(location.warehouseId, location.shelfId),
          value: location.quantity * material.unitCost,
          level: stockLevel(material.stock, material.minStock, material.maxStock),
        });
      }
    }
    return rows;
  });

  protected readonly shelfStats = computed(() => {
    const map = new Map<string, { items: number; quantity: number }>();
    for (const material of this.inventory.all()) {
      for (const l of material.locations) {
        if (l.warehouseId !== this.warehouseId() || !l.shelfId) continue;
        const s = map.get(l.shelfId) ?? { items: 0, quantity: 0 };
        map.set(l.shelfId, { items: s.items + (l.quantity > 0 ? 1 : 0), quantity: s.quantity + l.quantity });
      }
    }
    return map;
  });

  protected readonly stockValue = computed(() => this.stockRows().reduce((s, r) => s + r.value, 0));

  protected openShelf(shelf: Shelf | null = null): void {
    this.shelfEditing.set(shelf);
    this.shelfCode.set(shelf?.code ?? '');
    this.shelfName.set(shelf?.name ?? '');
    this.rangePrefix.set(this.warehouse()?.shelves[0]?.code.split('-')[0] ?? '');
    this.shelfOpen.set(true);
  }

  protected shelfCodeTaken(): boolean {
    const code = this.shelfCode().trim().toUpperCase();
    return !!this.warehouse()?.shelves.some((s) => s.id !== this.shelfEditing()?.id && s.code.toUpperCase() === code);
  }

  protected saveShelf(): void {
    const code = this.shelfCode().trim().toUpperCase();
    if (!code || this.shelfCodeTaken()) return;
    const editing = this.shelfEditing();
    if (editing) this.warehouses.updateShelf(this.warehouseId(), editing.id, { code, name: this.shelfName().trim() });
    else this.warehouses.addShelf(this.warehouseId(), { code, name: this.shelfName().trim() });
    this.toast.success(editing ? 'تم تعديل الرف' : 'تمت إضافة الرف', code);
    this.shelfOpen.set(false);
  }

  protected addRange(): void {
    const prefix = this.rangePrefix().trim().toUpperCase();
    const count = Math.floor(this.rangeCount());
    if (!prefix || count <= 0) return;
    this.warehouses.addShelfRange(this.warehouseId(), prefix, Math.min(count, 200));
    this.toast.success('تم ترميز الرفوف', `${count} رف بالبادئة ${prefix}`);
    this.shelfOpen.set(false);
  }

  protected async removeShelf(shelf: Shelf): Promise<void> {
    if (this.shelfStats().get(shelf.id)?.quantity) {
      this.toast.warning('لا يمكن حذف الرف', 'يحتوي الرف على كميات؛ انقلها أولاً');
      return;
    }
    const ok = await this.confirm.ask({ title: 'حذف الرف', message: `حذف الرف ${shelf.code}؟`, confirmLabel: 'حذف', danger: true });
    if (ok) this.warehouses.removeShelf(this.warehouseId(), shelf.id);
  }

  protected async removeWarehouse(): Promise<void> {
    const w = this.warehouse();
    if (!w) return;
    const hasStock = this.inventory.all().some((m) => m.locations.some((l) => l.warehouseId === w.id && l.quantity > 0));
    if (hasStock) {
      this.toast.warning('لا يمكن حذف المستودع', 'يحتوي على أرصدة؛ انقلها إلى مستودع آخر أولاً');
      return;
    }
    const ok = await this.confirm.ask({
      title: 'حذف المستودع',
      message: `سيتم حذف «${w.name}» ورفوفه، وتنتقل المستودعات التابعة له إلى المستوى الأعلى.`,
      confirmLabel: 'حذف',
      danger: true,
    });
    if (!ok) return;
    this.warehouses.remove(w.id);
    this.toast.success('تم حذف المستودع', w.name);
    void this.router.navigate(['/warehouse/dashboard']);
  }
}
