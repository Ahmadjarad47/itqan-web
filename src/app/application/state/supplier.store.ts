import { computed, inject, Injectable } from '@angular/core';
import { EntityId, Supplier } from '@domain/models';
import { SupplierRepository } from '@domain/ports/repositories';
import { EntityStore, newId } from './entity-store';

@Injectable({ providedIn: 'root' })
export class SupplierStore extends EntityStore<Supplier> {
  protected readonly repository = inject(SupplierRepository);

  readonly sorted = computed(() => [...this.all()].sort((a, b) => a.name.localeCompare(b.name, 'ar')));

  create(data: Omit<Supplier, 'id'>): Supplier {
    return this.insert({ ...data, id: newId('s') });
  }

  update(id: EntityId, changes: Partial<Omit<Supplier, 'id'>>): void {
    this.modify(id, changes);
  }

  remove(id: EntityId): void {
    this.removeWhere((supplier) => supplier.id === id);
  }
}
