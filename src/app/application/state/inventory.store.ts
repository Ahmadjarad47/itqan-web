import { computed, inject, Injectable, signal } from '@angular/core';
import { EntityId, Material, StockMovement, StockMovementType } from '@domain/models';
import { MaterialRepository, StockMovementRepository } from '@domain/ports/repositories';
import { nowIso } from '@domain/rules';
import { EntityStore, newId } from './entity-store';

@Injectable({ providedIn: 'root' })
export class InventoryStore extends EntityStore<Material> {
  protected readonly repository = inject(MaterialRepository);
  private readonly movementRepository = inject(StockMovementRepository);

  private readonly movementState = signal<readonly StockMovement[]>([]);

  readonly movements = computed(() => [...this.movementState()].sort((a, b) => b.at.localeCompare(a.at)));
  readonly lowStock = computed(() => this.all().filter((m) => m.kind !== 'purchased' && m.stock < m.minStock));
  readonly consumables = computed(() => this.all().filter((m) => m.kind === 'consumable'));
  readonly rawMaterials = computed(() => this.all().filter((m) => m.kind === 'raw'));

  override async load(): Promise<void> {
    await super.load();
    this.movementState.set(await this.movementRepository.getAll());
  }

  create(data: Omit<Material, 'id'>): Material {
    const material = this.insert({ ...data, id: newId('m') });
    if (material.stock) this.record(material.id, 'receipt', material.stock, 'رصيد افتتاحي');
    return material;
  }

  update(id: EntityId, changes: Partial<Omit<Material, 'id' | 'stock'>>): void {
    this.modify(id, changes);
  }

  /** Applies a signed stock movement and logs it. */
  move(materialId: EntityId, type: StockMovementType, quantity: number, reference: string): void {
    const signed = type === 'receipt' ? Math.abs(quantity) : type === 'adjustment' ? quantity : -Math.abs(quantity);
    this.modify(materialId, (material) => ({ ...material, stock: Math.max(0, material.stock + signed) }));
    this.record(materialId, type, signed, reference);
  }

  private record(materialId: EntityId, type: StockMovementType, quantity: number, reference: string): void {
    const movement: StockMovement = { id: newId('mv'), materialId, type, quantity, reference, at: nowIso() };
    this.movementState.update((items) => [...items, movement]);
    void this.movementRepository.save(movement);
  }
}
