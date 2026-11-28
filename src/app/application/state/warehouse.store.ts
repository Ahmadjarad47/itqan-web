import { computed, inject, Injectable } from '@angular/core';
import { CatalogList, CatalogOption, EntityId, Requisition, RequisitionLine, RequisitionStatus, Shelf, Warehouse } from '@domain/models';
import { CatalogOptionRepository, RequisitionRepository, WarehouseRepository } from '@domain/ports/repositories';
import { nextSequence, todayIso } from '@domain/rules';
import { EntityStore, newId } from './entity-store';

export interface WarehouseTreeRow {
  readonly warehouse: Warehouse;
  readonly depth: number;
}

@Injectable({ providedIn: 'root' })
export class WarehouseStore extends EntityStore<Warehouse> {
  protected readonly repository = inject(WarehouseRepository);

  readonly sorted = computed(() => [...this.all()].sort((a, b) => a.code.localeCompare(b.code)));

  /** Depth-first hierarchy (main warehouses followed by their sub-warehouses). */
  readonly tree = computed<WarehouseTreeRow[]>(() => {
    const rows: WarehouseTreeRow[] = [];
    const ids = new Set(this.all().map((w) => w.id));
    const walk = (parentId: EntityId | null, depth: number) => {
      this.sorted()
        .filter((w) => (parentId === null ? !w.parentId || !ids.has(w.parentId) : w.parentId === parentId))
        .forEach((warehouse) => {
          rows.push({ warehouse, depth });
          walk(warehouse.id, depth + 1);
        });
    };
    walk(null, 0);
    return rows;
  });

  readonly shelvesById = computed(() => {
    const map = new Map<EntityId, Shelf>();
    this.all().forEach((w) => w.shelves.forEach((s) => map.set(s.id, s)));
    return map;
  });

  children(id: EntityId): Warehouse[] {
    return this.sorted().filter((w) => w.parentId === id);
  }

  /** The warehouse and all of its sub-warehouses. */
  subtreeIds(id: EntityId): Set<EntityId> {
    const ids = new Set<EntityId>([id]);
    let added = true;
    while (added) {
      added = false;
      for (const w of this.all()) {
        if (w.parentId && ids.has(w.parentId) && !ids.has(w.id)) {
          ids.add(w.id);
          added = true;
        }
      }
    }
    return ids;
  }

  /** Full path such as «المستودع الرئيسي / مستودع المعادن». */
  path(id: EntityId | null | undefined): string {
    const names: string[] = [];
    let current = this.find(id);
    const seen = new Set<EntityId>();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      names.unshift(current.name);
      current = this.find(current.parentId);
    }
    return names.join(' / ');
  }

  locationLabel(warehouseId: EntityId | null | undefined, shelfId: EntityId | null | undefined): string {
    const warehouse = this.find(warehouseId);
    if (!warehouse) return '—';
    const shelf = warehouse.shelves.find((s) => s.id === shelfId);
    return shelf ? `${warehouse.name} · ${shelf.code}` : warehouse.name;
  }

  isCodeTaken(code: string, exceptId?: EntityId): boolean {
    const wanted = code.trim().toUpperCase();
    return this.all().some((w) => w.id !== exceptId && w.code.toUpperCase() === wanted);
  }

  create(data: Omit<Warehouse, 'id' | 'shelves' | 'createdAt'>): Warehouse {
    return this.insert({ ...data, id: newId('wh'), shelves: [], createdAt: todayIso() });
  }

  update(id: EntityId, changes: Partial<Omit<Warehouse, 'id' | 'shelves'>>): void {
    // A warehouse can never become its own ancestor.
    if (changes.parentId && this.subtreeIds(id).has(changes.parentId)) return;
    this.modify(id, changes);
  }

  addShelf(id: EntityId, shelf: Omit<Shelf, 'id'>): void {
    this.modify(id, (w) => ({ ...w, shelves: [...w.shelves, { ...shelf, id: newId('sh') }] }));
  }

  /** Creates `count` shelves coded `<prefix>-01`, `<prefix>-02`, ... after the existing ones. */
  addShelfRange(id: EntityId, prefix: string, count: number): void {
    this.modify(id, (w) => {
      const taken = new Set(w.shelves.map((s) => s.code.toUpperCase()));
      const shelves = [...w.shelves];
      let n = 1;
      while (shelves.length < w.shelves.length + count) {
        const code = `${prefix}-${String(n++).padStart(2, '0')}`;
        if (!taken.has(code.toUpperCase())) shelves.push({ id: newId('sh'), code, name: '' });
      }
      return { ...w, shelves };
    });
  }

  updateShelf(id: EntityId, shelfId: EntityId, changes: Partial<Omit<Shelf, 'id'>>): void {
    this.modify(id, (w) => ({ ...w, shelves: w.shelves.map((s) => (s.id === shelfId ? { ...s, ...changes } : s)) }));
  }

  removeShelf(id: EntityId, shelfId: EntityId): void {
    this.modify(id, (w) => ({ ...w, shelves: w.shelves.filter((s) => s.id !== shelfId) }));
  }

  remove(id: EntityId): void {
    const parentId = this.find(id)?.parentId ?? null;
    this.children(id).forEach((child) => this.modify(child.id, { parentId }));
    this.removeWhere((w) => w.id === id);
  }
}

@Injectable({ providedIn: 'root' })
export class CatalogOptionStore extends EntityStore<CatalogOption> {
  protected readonly repository = inject(CatalogOptionRepository);

  readonly categories = computed(() => this.list('category'));
  readonly natures = computed(() => this.list('nature'));

  private list(list: CatalogList): CatalogOption[] {
    return this.all()
      .filter((o) => o.list === list)
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }

  name(id: EntityId | null | undefined): string {
    return this.find(id)?.name ?? '—';
  }

  create(list: CatalogList, name: string, code: string): CatalogOption {
    return this.insert({ id: newId('opt'), list, name: name.trim(), code: code.trim().toUpperCase() });
  }

  update(id: EntityId, changes: Partial<Pick<CatalogOption, 'name' | 'code'>>): void {
    this.modify(id, { ...changes, ...(changes.code ? { code: changes.code.toUpperCase() } : {}) });
  }

  remove(id: EntityId): void {
    this.removeWhere((o) => o.id === id);
  }
}

export type NewRequisition = Omit<Requisition, 'id' | 'number' | 'status' | 'deliveredAt' | 'lines'> & {
  readonly lines: readonly Omit<RequisitionLine, 'id'>[];
};

@Injectable({ providedIn: 'root' })
export class RequisitionStore extends EntityStore<Requisition> {
  protected readonly repository = inject(RequisitionRepository);

  readonly open = computed(() => this.all().filter((r) => r.status !== 'delivered' && r.status !== 'cancelled'));

  create(data: NewRequisition, paperNumber?: string): Requisition {
    const prefix = `${data.origin === 'paper' ? 'MRP' : 'MR'}-${new Date().getFullYear()}-`;
    const sequence = nextSequence(this.all().map((r) => r.number), prefix);
    const number =
      data.origin === 'paper' && paperNumber?.trim()
        ? paperNumber.trim()
        : `${prefix}${String(sequence).padStart(3, '0')}`;
    return this.insert({
      ...data,
      id: newId('rq'),
      number,
      status: 'new',
      deliveredAt: null,
      lines: data.lines.map((line) => ({ ...line, id: newId('rl') })),
    });
  }

  setStatus(id: EntityId, status: RequisitionStatus): void {
    this.modify(id, { status, deliveredAt: status === 'delivered' ? todayIso() : null });
  }

  update(id: EntityId, changes: Partial<Omit<Requisition, 'id' | 'number'>>): void {
    this.modify(id, changes);
  }
}
