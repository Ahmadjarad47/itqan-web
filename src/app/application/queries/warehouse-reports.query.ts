import { computed, inject, Injectable } from '@angular/core';
import { EntityId, IsoDate, Material, StockMovement } from '@domain/models';
import { addDays, diffDays, movementDate, quantityIn, stockLevel, StockLevel, todayIso } from '@domain/rules';
import { InventoryStore } from '../state/inventory.store';
import { RequisitionStore, WarehouseStore } from '../state/warehouse.store';

export interface WarehouseSummary {
  readonly id: EntityId;
  readonly items: number;
  readonly quantity: number;
  readonly value: number;
  readonly inCount: number;
  readonly outCount: number;
  readonly inQty: number;
  readonly outQty: number;
}

export interface StagnantRow {
  readonly material: Material;
  readonly quantity: number;
  readonly value: number;
  readonly lastOut: IsoDate | null;
  readonly idleDays: number;
}

export interface MovingRow {
  readonly material: Material;
  readonly inQty: number;
  readonly outQty: number;
  readonly count: number;
}

export interface CriticalRow {
  readonly material: Material;
  readonly quantity: number;
  readonly level: StockLevel;
}

export interface ExpiryRow {
  readonly material: Material;
  readonly quantity: number;
  readonly expiryDate: IsoDate;
  readonly days: number;
  readonly reference: string;
}

export interface WarehouseAlert {
  readonly id: string;
  readonly tone: 'danger' | 'warning' | 'info';
  readonly icon: string;
  readonly title: string;
  readonly text: string;
  readonly link: string;
}

const OUTGOING = new Set(['issue', 'consumption', 'writeoff']);

/** Reports and KPIs of the warehouse dashboard (screen 1). */
@Injectable({ providedIn: 'root' })
export class WarehouseReportsQuery {
  private readonly inventory = inject(InventoryStore);
  private readonly warehouses = inject(WarehouseStore);
  private readonly requisitions = inject(RequisitionStore);

  /** Movement counts over the last 30 days and stock value per warehouse (including sub-warehouses). */
  readonly summaries = computed(() => {
    const since = addDays(todayIso(), -30);
    const map = new Map<EntityId, WarehouseSummary>();
    for (const warehouse of this.warehouses.all()) {
      const ids = this.warehouses.subtreeIds(warehouse.id);
      let items = 0;
      let quantity = 0;
      let value = 0;
      for (const material of this.inventory.all()) {
        const q = quantityIn(material, ids);
        if (q > 0) items++;
        quantity += q;
        value += q * material.unitCost;
      }
      const recent = this.inventory.movements().filter((m) => m.warehouseId && ids.has(m.warehouseId) && movementDate(m) >= since);
      const incoming = recent.filter((m) => m.quantity > 0);
      const outgoing = recent.filter((m) => m.quantity < 0);
      map.set(warehouse.id, {
        id: warehouse.id,
        items,
        quantity,
        value,
        inCount: incoming.length,
        outCount: outgoing.length,
        inQty: incoming.reduce((s, m) => s + m.quantity, 0),
        outQty: outgoing.reduce((s, m) => s - m.quantity, 0),
      });
    }
    return map;
  });

  readonly alerts = computed<WarehouseAlert[]>(() => {
    const today = todayIso();
    const alerts: WarehouseAlert[] = [];
    for (const row of this.critical(null)) {
      const link = `/warehouse/items/${row.material.id}`;
      if (row.level === 'empty' || row.level === 'low') {
        alerts.push({
          id: `low-${row.material.id}`,
          tone: row.level === 'empty' ? 'danger' : 'warning',
          icon: 'alert',
          title: row.level === 'empty' ? 'نفد المخزون' : 'تحت الحد الأدنى',
          text: `${row.material.name} — ${row.quantity} / ${row.material.minStock}`,
          link,
        });
      } else if (row.level === 'over') {
        alerts.push({ id: `over-${row.material.id}`, tone: 'info', icon: 'layers', title: 'فوق الحد الأقصى', text: `${row.material.name} — ${row.quantity} / ${row.material.maxStock}`, link });
      }
    }
    for (const row of this.expiring(null, 30)) {
      alerts.push({
        id: `exp-${row.material.id}-${row.expiryDate}`,
        tone: row.days < 0 ? 'danger' : 'warning',
        icon: 'clock',
        title: row.days < 0 ? 'منتهي الصلاحية' : `تنتهي صلاحيته خلال ${row.days} يوم`,
        text: `${row.material.name} — ${row.quantity}`,
        link: `/warehouse/items/${row.material.id}`,
      });
    }
    for (const r of this.requisitions.open()) {
      if (r.dueDate < today) {
        alerts.push({ id: `rq-${r.id}`, tone: 'danger', icon: 'inbox', title: `طلب احتياج متأخر ${r.number}`, text: `موعد التسليم ${r.dueDate}`, link: '/warehouse/movements' });
      }
    }
    return alerts;
  });

  private scope(warehouseId: EntityId | null): Set<EntityId> | null {
    return warehouseId ? this.warehouses.subtreeIds(warehouseId) : null;
  }

  private movementsIn(scope: Set<EntityId> | null): StockMovement[] {
    return this.inventory.movements().filter((m) => m.type !== 'transfer' && (!scope || (m.warehouseId !== null && scope.has(m.warehouseId))));
  }

  /** Items on hand with no outgoing movement during the last `days` days (العناصر الراكدة). */
  stagnant(warehouseId: EntityId | null, days: number): StagnantRow[] {
    const today = todayIso();
    const scope = this.scope(warehouseId);
    const lastOut = new Map<EntityId, IsoDate>();
    for (const m of this.movementsIn(scope)) {
      if (!OUTGOING.has(m.type)) continue;
      const date = movementDate(m);
      if (date > (lastOut.get(m.materialId) ?? '')) lastOut.set(m.materialId, date);
    }
    return this.inventory
      .all()
      .map((material) => {
        const quantity = quantityIn(material, scope);
        const last = lastOut.get(material.id) ?? null;
        const idleDays = diffDays(last ?? material.createdAt, today);
        return { material, quantity, value: quantity * material.unitCost, lastOut: last, idleDays };
      })
      .filter((row) => row.quantity > 0 && row.idleDays >= days)
      .sort((a, b) => b.idleDays - a.idleDays || b.value - a.value);
  }

  /** Items with the most incoming and outgoing quantity in the period (العناصر الأكثر حركة). */
  moving(warehouseId: EntityId | null, days: number, limit = 10): MovingRow[] {
    const since = addDays(todayIso(), -days);
    const stats = new Map<EntityId, { inQty: number; outQty: number; count: number }>();
    for (const m of this.movementsIn(this.scope(warehouseId))) {
      if (movementDate(m) < since) continue;
      const s = stats.get(m.materialId) ?? { inQty: 0, outQty: 0, count: 0 };
      if (m.quantity > 0) s.inQty += m.quantity;
      else s.outQty -= m.quantity;
      s.count++;
      stats.set(m.materialId, s);
    }
    return [...stats.entries()]
      .map(([id, s]) => ({ material: this.inventory.find(id)!, ...s }))
      .filter((row) => row.material)
      .sort((a, b) => b.count - a.count || b.outQty + b.inQty - (a.outQty + a.inQty))
      .slice(0, limit);
  }

  /** Items outside their Min/Max band (الحالات الحرجة). */
  critical(warehouseId: EntityId | null): CriticalRow[] {
    const scope = this.scope(warehouseId);
    const order: Record<StockLevel, number> = { empty: 0, low: 1, over: 2, ok: 3 };
    return this.inventory
      .all()
      .filter((m) => !scope || m.locations.some((l) => scope.has(l.warehouseId)))
      .map((material) => {
        const quantity = scope ? quantityIn(material, scope) : material.stock;
        // Min/Max are defined for the whole card, so the level always uses the total stock.
        return { material, quantity, level: stockLevel(material.stock, material.minStock, material.maxStock) };
      })
      .filter((row) => row.level !== 'ok')
      .sort((a, b) => order[a.level] - order[b.level]);
  }

  /** Remaining batches that expire within `days` days (or already expired). */
  expiring(warehouseId: EntityId | null, days: number): ExpiryRow[] {
    const today = todayIso();
    const limit = addDays(today, days);
    const scope = this.scope(warehouseId);
    const rows: ExpiryRow[] = [];
    for (const material of this.inventory.all()) {
      if (scope && !material.locations.some((l) => scope.has(l.warehouseId) && l.quantity > 0)) continue;
      for (const lot of this.inventory.ledger(material.id)?.lots ?? []) {
        if (!lot.expiryDate || lot.expiryDate > limit || lot.quantity <= 0) continue;
        rows.push({ material, quantity: lot.quantity, expiryDate: lot.expiryDate, days: diffDays(today, lot.expiryDate), reference: lot.reference });
      }
    }
    return rows.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  }
}
