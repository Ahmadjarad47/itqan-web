import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InventoryStore } from '@application/state/inventory.store';
import { WarehouseStore } from '@application/state/warehouse.store';
import { EntityId, MOVEMENT_LABELS, RECEIPT_SOURCE_LABELS, StockMovement, StockMovementType, UNIT_LABELS } from '@domain/models';
import { movementDate } from '@domain/rules';
import { ArDatePipe, MoneyPipe, NumPipe } from '@shared/pipes/format.pipes';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { downloadCsv } from './csv';

type Direction = 'all' | 'in' | 'out' | 'transfer';
type View = 'list' | 'item' | 'day' | 'type';

interface Group {
  readonly key: string;
  readonly label: string;
  readonly inQty: number;
  readonly outQty: number;
  readonly count: number;
  readonly value: number;
}

/** Filterable stock-movement log («آخر 10 حركات» with several display modes). */
@Component({
  selector: 'app-movement-log',
  imports: [RouterLink, Icon, EmptyState, NumPipe, MoneyPipe, ArDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './movement-log.html',
  styleUrls: ['./warehouse-common.scss', './movement-log.scss'],
})
export class MovementLog {
  private readonly inventory = inject(InventoryStore);
  protected readonly warehouses = inject(WarehouseStore);

  /** Null shows every warehouse. */
  readonly warehouseIds = input<ReadonlySet<EntityId> | null>(null);
  readonly limit = input(10);
  readonly heading = input('آخر الحركات');

  protected readonly movementLabels = MOVEMENT_LABELS;
  protected readonly sourceLabels = RECEIPT_SOURCE_LABELS;
  protected readonly unitLabels = UNIT_LABELS;
  protected readonly types = Object.keys(MOVEMENT_LABELS) as StockMovementType[];

  protected readonly direction = signal<Direction>('all');
  protected readonly type = signal<StockMovementType | ''>('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly search = signal('');
  protected readonly view = signal<View>('list');
  protected readonly showAll = signal(false);

  protected readonly filtered = computed(() => {
    const scope = this.warehouseIds();
    const term = this.search().trim().toLowerCase();
    return this.inventory.movements().filter((m) => {
      if (scope && (!m.warehouseId || !scope.has(m.warehouseId))) return false;
      const direction = this.direction();
      if (direction === 'transfer' && m.type !== 'transfer') return false;
      if (direction === 'in' && (m.type === 'transfer' || m.quantity < 0)) return false;
      if (direction === 'out' && (m.type === 'transfer' || m.quantity > 0)) return false;
      if (this.type() && m.type !== this.type()) return false;
      const date = movementDate(m);
      if (this.from() && date < this.from()) return false;
      if (this.to() && date > this.to()) return false;
      if (term) {
        const material = this.inventory.find(m.materialId);
        const text = `${material?.name ?? ''} ${material?.code ?? ''} ${m.reference} ${m.documentNo}`.toLowerCase();
        if (!text.includes(term)) return false;
      }
      return true;
    });
  });

  protected readonly rows = computed(() => {
    const list = this.showAll() ? this.filtered() : this.filtered().slice(0, this.limit());
    return list.map((movement) => this.row(movement));
  });

  protected readonly groups = computed<Group[]>(() => {
    const view = this.view();
    const map = new Map<string, Group>();
    for (const m of this.filtered()) {
      const material = this.inventory.find(m.materialId);
      const key = view === 'item' ? m.materialId : view === 'day' ? movementDate(m) : m.type;
      const label = view === 'item' ? `${material?.code ?? ''} — ${material?.name ?? '—'}` : view === 'day' ? movementDate(m) : MOVEMENT_LABELS[m.type];
      const g = map.get(key) ?? { key, label, inQty: 0, outQty: 0, count: 0, value: 0 };
      map.set(key, {
        ...g,
        inQty: g.inQty + Math.max(0, m.quantity),
        outQty: g.outQty + Math.max(0, -m.quantity),
        count: g.count + 1,
        value: g.value + Math.abs(m.quantity) * (m.unitCost ?? material?.unitCost ?? 0),
      });
    }
    const groups = [...map.values()];
    return view === 'day' ? groups.sort((a, b) => b.key.localeCompare(a.key)) : groups.sort((a, b) => b.count - a.count);
  });

  protected readonly hasFilters = computed(() => this.direction() !== 'all' || !!this.type() || !!this.from() || !!this.to() || !!this.search());

  protected reset(): void {
    this.direction.set('all');
    this.type.set('');
    this.from.set('');
    this.to.set('');
    this.search.set('');
  }

  protected exportCsv(): void {
    downloadCsv(
      'stock-movements',
      ['التاريخ', 'الرمز', 'العنصر', 'نوع الحركة', 'الكمية', 'الموقع', 'سعر الوحدة', 'المرجع'],
      this.filtered().map((m) => {
        const r = this.row(m);
        return [r.date, r.material?.code, r.material?.name, MOVEMENT_LABELS[m.type], m.quantity, r.location, m.unitCost ?? '', m.documentNo || m.reference];
      }),
    );
  }

  private row(movement: StockMovement) {
    const material = this.inventory.find(movement.materialId);
    return {
      movement,
      material,
      date: movementDate(movement),
      location: this.warehouses.locationLabel(movement.warehouseId, movement.shelfId),
    };
  }
}
