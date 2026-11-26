import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { InventoryStore } from '@application/state/inventory.store';
import { WarehouseStore } from '@application/state/warehouse.store';
import { EntityId } from '@domain/models';
import { NumPipe } from '@shared/pipes/format.pipes';

/**
 * Warehouse + shelf selector. With `stockOf` set, only the places holding that item are
 * offered (outgoing movements) and their available quantity is shown.
 */
@Component({
  selector: 'app-location-picker',
  imports: [NumPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (stockOf()) {
      <select class="select" [class.input--sm]="small()" [value]="key()" (change)="pick($any($event.target).value)">
        <option value="">— اختر الموقع —</option>
        @for (l of stockedPlaces(); track l.key) {
          <option [value]="l.key" [selected]="l.key === key()">{{ l.label }} ({{ l.quantity | num }})</option>
        }
      </select>
    } @else {
      <select class="select" [class.input--sm]="small()" (change)="setWarehouse($any($event.target).value)">
        <option value="" [selected]="!warehouseId()">— المستودع —</option>
        @for (row of warehouses.tree(); track row.warehouse.id) {
          <option [value]="row.warehouse.id" [selected]="row.warehouse.id === warehouseId()">{{ indent(row.depth) }}{{ row.warehouse.name }}</option>
        }
      </select>
      <select class="select" [class.input--sm]="small()" [disabled]="!warehouseId()" (change)="shelfId.set($any($event.target).value || null)">
        <option value="" [selected]="!shelfId()">بدون رف</option>
        @for (s of shelves(); track s.id) {
          <option [value]="s.id" [selected]="s.id === shelfId()">{{ s.code }}{{ s.name ? ' — ' + s.name : '' }}</option>
        }
      </select>
    }
  `,
  styles: `
    :host {
      display: flex;
      gap: 8px;
      min-width: 0;
    }
    .select {
      flex: 1;
      min-width: 0;
    }
  `,
})
export class LocationPicker {
  protected readonly warehouses = inject(WarehouseStore);
  private readonly inventory = inject(InventoryStore);

  readonly warehouseId = model<EntityId | null>(null);
  readonly shelfId = model<EntityId | null>(null);
  readonly stockOf = input<EntityId | null>(null);
  readonly small = input(false);

  protected readonly shelves = computed(() => this.warehouses.find(this.warehouseId())?.shelves ?? []);
  protected readonly key = computed(() => (this.warehouseId() ? `${this.warehouseId()}|${this.shelfId() ?? ''}` : ''));

  protected readonly stockedPlaces = computed(() =>
    (this.inventory.find(this.stockOf())?.locations ?? [])
      .filter((l) => l.quantity > 0)
      .map((l) => ({
        key: `${l.warehouseId}|${l.shelfId ?? ''}`,
        label: this.warehouses.locationLabel(l.warehouseId, l.shelfId),
        quantity: l.quantity,
      })),
  );

  protected indent(depth: number): string {
    return depth ? '  '.repeat(depth) + '↳ ' : '';
  }

  protected setWarehouse(id: string): void {
    this.warehouseId.set(id || null);
    this.shelfId.set(null);
  }

  protected pick(key: string): void {
    const [warehouseId, shelfId] = key.split('|');
    this.warehouseId.set(warehouseId || null);
    this.shelfId.set(shelfId || null);
  }
}
