import { computed, inject, Injectable, signal } from '@angular/core';
import {
  Attachment,
  EntityId,
  IsoDate,
  Material,
  ReceiptSource,
  StockLocation,
  StockMovement,
  StockMovementType,
} from '@domain/models';
import { MaterialRepository, StockMovementRepository } from '@domain/ports/repositories';
import {
  adjustLocations,
  buildLedger,
  compareMovements,
  deductAnywhere,
  Ledger,
  nowIso,
  todayIso,
  totalQuantity,
} from '@domain/rules';
import { EntityStore, newId } from './entity-store';

/** Warehouse names used before warehouses became entities, mapped to their seeded ids. */
const LEGACY_WAREHOUSES: Record<string, string> = {
  'مستودع المعادن': 'wh-metals',
  'مستودع الكهرباء': 'wh-electrical',
  'مستودع الهيدروليك': 'wh-hydraulic',
  'مستودع المستهلكات': 'wh-consumables',
  'مستودع الأجزاء المشتراة': 'wh-purchased',
};

export const DEFAULT_PURCHASED_WAREHOUSE = 'wh-purchased';

export type NewMaterial = Omit<Material, 'id' | 'stock' | 'locations' | 'createdAt'> & {
  /** Opening quantities per location, each with its own purchase price. */
  readonly opening?: readonly (StockLocation & { unitCost: number; expiryDate?: IsoDate | null })[];
  /** Designated storage places without stock. */
  readonly storage?: readonly Pick<StockLocation, 'warehouseId' | 'shelfId'>[];
};

export interface ReceiptInput {
  readonly materialId: EntityId;
  readonly warehouseId: EntityId;
  readonly shelfId: EntityId | null;
  readonly quantity: number;
  readonly unitCost: number;
  readonly date: IsoDate;
  readonly source: ReceiptSource;
  readonly documentNo: string;
  readonly reference?: string;
  readonly supplierId?: EntityId | null;
  readonly purchaseId?: EntityId | null;
  readonly expiryDate?: IsoDate | null;
  readonly attachments?: readonly Attachment[];
}

export interface IssueInput {
  readonly materialId: EntityId;
  readonly type: Extract<StockMovementType, 'issue' | 'writeoff' | 'consumption'>;
  /** Null takes the quantity from the fullest locations. */
  readonly warehouseId: EntityId | null;
  readonly shelfId: EntityId | null;
  readonly quantity: number;
  readonly date: IsoDate;
  readonly reference: string;
  readonly documentNo?: string;
  readonly sellPrice?: number | null;
  readonly requisitionId?: EntityId | null;
}

export interface TransferInput {
  readonly materialId: EntityId;
  readonly from: Pick<StockLocation, 'warehouseId' | 'shelfId'>;
  readonly to: Pick<StockLocation, 'warehouseId' | 'shelfId'>;
  readonly quantity: number;
  readonly date: IsoDate;
  readonly reference: string;
}

const EMPTY_MOVEMENT: Omit<StockMovement, 'id' | 'materialId' | 'type' | 'quantity' | 'reference' | 'at'> = {
  date: '',
  warehouseId: null,
  shelfId: null,
  unitCost: null,
  sellPrice: null,
  source: null,
  documentNo: '',
  supplierId: null,
  purchaseId: null,
  requisitionId: null,
  expiryDate: null,
  transferId: null,
  attachments: [],
};

/** Product cards, their stock per warehouse/shelf, and the movement history. */
@Injectable({ providedIn: 'root' })
export class InventoryStore extends EntityStore<Material> {
  protected readonly repository = inject(MaterialRepository);
  private readonly movementRepository = inject(StockMovementRepository);

  private readonly movementState = signal<readonly StockMovement[]>([]);

  /** Newest first. */
  readonly movements = computed(() => [...this.movementState()].sort((a, b) => compareMovements(b, a)));
  readonly movementsByMaterial = computed(() => {
    const map = new Map<EntityId, StockMovement[]>();
    for (const movement of this.movementState()) {
      const list = map.get(movement.materialId) ?? [];
      list.push(movement);
      map.set(movement.materialId, list);
    }
    return map;
  });
  readonly lowStock = computed(() => this.all().filter((m) => m.minStock > 0 && m.stock < m.minStock));
  readonly overStock = computed(() => this.all().filter((m) => m.maxStock > 0 && m.stock > m.maxStock));
  readonly consumables = computed(() => this.all().filter((m) => m.kind === 'consumable'));
  readonly rawMaterials = computed(() => this.all().filter((m) => m.kind === 'raw'));
  readonly sorted = computed(() => [...this.all()].sort((a, b) => a.code.localeCompare(b.code)));

  /** Valuation ledger of every item, recomputed when movements change. */
  readonly ledgers = computed(() => {
    const map = new Map<EntityId, Ledger>();
    const byMaterial = this.movementsByMaterial();
    for (const material of this.all()) {
      map.set(material.id, buildLedger(byMaterial.get(material.id) ?? [], material.costMethod, material.unitCost));
    }
    return map;
  });

  override async load(): Promise<void> {
    await super.load();
    const movements = await this.movementRepository.getAll();
    this.movementState.set(movements.map((m) => ({ ...EMPTY_MOVEMENT, ...m, date: m.date || m.at.slice(0, 10) })));
  }

  protected override normalize(material: Material): Material {
    const legacy = material as Material & { warehouse?: string };
    const locations =
      material.locations ??
      (legacy.warehouse !== undefined
        ? [{ warehouseId: LEGACY_WAREHOUSES[legacy.warehouse] ?? DEFAULT_PURCHASED_WAREHOUSE, shelfId: null, quantity: material.stock }]
        : []);
    const { warehouse: _legacy, ...rest } = legacy;
    return {
      ...rest,
      maxStock: material.maxStock ?? 0,
      categoryId: material.categoryId ?? null,
      natureId: material.natureId ?? null,
      costMethod: material.costMethod ?? 'average',
      margin: material.margin ?? { type: 'percent', value: 0 },
      locations,
      specFiles: material.specFiles ?? [],
      notes: material.notes ?? '',
      createdAt: material.createdAt ?? todayIso(),
    };
  }

  findByCode(code: string): Material | undefined {
    const wanted = code.trim().toUpperCase();
    return this.all().find((m) => m.code.toUpperCase() === wanted);
  }

  ledger(id: EntityId | null | undefined): Ledger | undefined {
    return id ? this.ledgers().get(id) : undefined;
  }

  create(data: NewMaterial): Material {
    const { opening = [], storage = [], ...card } = data;
    const date = todayIso();
    const locations: StockLocation[] = [];
    storage.forEach((s) => {
      if (!locations.some((l) => l.warehouseId === s.warehouseId && l.shelfId === s.shelfId)) locations.push({ ...s, quantity: 0 });
    });
    const material = this.insert({ ...card, id: newId('m'), stock: 0, locations, createdAt: date });
    opening
      .filter((o) => o.quantity > 0)
      .forEach((o) =>
        this.receive({
          materialId: material.id,
          warehouseId: o.warehouseId,
          shelfId: o.shelfId,
          quantity: o.quantity,
          unitCost: o.unitCost,
          date,
          source: 'opening',
          documentNo: '',
          reference: 'رصيد افتتاحي',
          expiryDate: o.expiryDate ?? null,
        }),
      );
    return this.find(material.id)!;
  }

  update(id: EntityId, changes: Partial<Omit<Material, 'id' | 'stock' | 'locations'>>): void {
    this.modify(id, changes);
    if (changes.costMethod) this.refreshCost(id);
  }

  addSpecFiles(id: EntityId, files: readonly Attachment[]): void {
    this.modify(id, (m) => ({ ...m, specFiles: [...m.specFiles, ...files] }));
  }

  removeSpecFile(id: EntityId, fileId: EntityId): void {
    this.modify(id, (m) => ({ ...m, specFiles: m.specFiles.filter((f) => f.id !== fileId) }));
  }

  /** Designates an empty storage place for the item. */
  addLocation(id: EntityId, warehouseId: EntityId, shelfId: EntityId | null): void {
    this.modify(id, (m) =>
      m.locations.some((l) => l.warehouseId === warehouseId && l.shelfId === shelfId)
        ? m
        : { ...m, locations: [...m.locations, { warehouseId, shelfId, quantity: 0 }] },
    );
  }

  removeEmptyLocation(id: EntityId, warehouseId: EntityId, shelfId: EntityId | null): void {
    this.modify(id, (m) => ({
      ...m,
      locations: m.locations.filter((l) => !(l.warehouseId === warehouseId && l.shelfId === shelfId && l.quantity === 0)),
    }));
  }

  /** Incoming quantity (تسجيل الوارد); refreshes the unit cost with the item's method. */
  receive(input: ReceiptInput): StockMovement {
    const movement = this.record({
      materialId: input.materialId,
      type: 'receipt',
      quantity: Math.abs(input.quantity),
      reference: input.reference || input.documentNo,
      date: input.date,
      warehouseId: input.warehouseId,
      shelfId: input.shelfId,
      unitCost: input.unitCost,
      source: input.source,
      documentNo: input.documentNo,
      supplierId: input.supplierId ?? null,
      purchaseId: input.purchaseId ?? null,
      expiryDate: input.expiryDate ?? null,
      attachments: input.attachments ?? [],
    });
    this.applyLocations(input.materialId, (l) => adjustLocations(l, input.warehouseId, input.shelfId, Math.abs(input.quantity)));
    return movement;
  }

  /** Outgoing quantity (صرف، إتلاف، استهلاك); the cost is taken from the history. */
  issue(input: IssueInput): StockMovement | undefined {
    const material = this.find(input.materialId);
    if (!material) return undefined;
    const quantity = Math.abs(input.quantity);
    const movement = this.record({
      materialId: input.materialId,
      type: input.type,
      quantity: -quantity,
      reference: input.reference,
      date: input.date,
      warehouseId: input.warehouseId,
      shelfId: input.shelfId,
      sellPrice: input.sellPrice ?? null,
      documentNo: input.documentNo ?? '',
      requisitionId: input.requisitionId ?? null,
    });
    // Store the cost actually charged so the history keeps it even if prices change later.
    const row = this.ledger(input.materialId)?.rows.find((r) => r.movement.id === movement.id);
    if (row?.issuedCost !== null && row?.issuedCost !== undefined) {
      this.patchMovement(movement.id, { unitCost: row.issuedCost / quantity });
    }
    this.applyLocations(input.materialId, (l) =>
      input.warehouseId ? adjustLocations(l, input.warehouseId, input.shelfId, -quantity) : deductAnywhere(l, quantity),
    );
    return movement;
  }

  /** Moves stock between two locations (مناقلة بين المستودعات). */
  transfer(input: TransferInput): void {
    const transferId = newId('tr');
    const quantity = Math.abs(input.quantity);
    const base = { materialId: input.materialId, type: 'transfer' as const, reference: input.reference, date: input.date, transferId };
    this.record({ ...base, quantity: -quantity, warehouseId: input.from.warehouseId, shelfId: input.from.shelfId });
    this.record({ ...base, quantity, warehouseId: input.to.warehouseId, shelfId: input.to.shelfId });
    this.applyLocations(input.materialId, (l) =>
      adjustLocations(adjustLocations(l, input.from.warehouseId, input.from.shelfId, -quantity), input.to.warehouseId, input.to.shelfId, quantity),
    );
  }

  /** Legacy entry point used by production consumption and quick adjustments. */
  move(materialId: EntityId, type: StockMovementType, quantity: number, reference: string): void {
    if (type === 'receipt' || (type === 'adjustment' && quantity > 0)) {
      const material = this.find(materialId);
      const target = material?.locations[0] ?? { warehouseId: DEFAULT_PURCHASED_WAREHOUSE, shelfId: null };
      this.receive({
        materialId,
        warehouseId: target.warehouseId,
        shelfId: target.shelfId,
        quantity,
        unitCost: material?.unitCost ?? 0,
        date: todayIso(),
        source: 'other',
        documentNo: '',
        reference,
      });
      return;
    }
    this.issue({
      materialId,
      type: type === 'writeoff' || type === 'consumption' ? type : 'issue',
      warehouseId: null,
      shelfId: null,
      quantity,
      date: todayIso(),
      reference,
    });
  }

  private applyLocations(id: EntityId, change: (locations: readonly StockLocation[]) => StockLocation[]): void {
    this.modify(id, (m) => {
      const locations = change(m.locations);
      return { ...m, locations, stock: totalQuantity(locations) };
    });
    this.refreshCost(id);
  }

  private refreshCost(id: EntityId): void {
    const ledger = this.ledger(id);
    const material = this.find(id);
    if (!ledger || !material || !ledger.rows.length) return;
    const unitCost = Math.round(ledger.unitCost * 10000) / 10000;
    if (unitCost !== material.unitCost) this.modify(id, { unitCost });
  }

  private record(data: Partial<StockMovement> & Pick<StockMovement, 'materialId' | 'type' | 'quantity' | 'reference'>): StockMovement {
    const movement: StockMovement = { ...EMPTY_MOVEMENT, date: todayIso(), ...data, id: newId('mv'), at: nowIso() };
    this.movementState.update((items) => [...items, movement]);
    void this.movementRepository.save(movement);
    return movement;
  }

  private patchMovement(id: EntityId, changes: Partial<StockMovement>): void {
    let next: StockMovement | undefined;
    this.movementState.update((items) =>
      items.map((m) => {
        if (m.id !== id) return m;
        next = { ...m, ...changes };
        return next;
      }),
    );
    if (next) void this.movementRepository.save(next);
  }
}
