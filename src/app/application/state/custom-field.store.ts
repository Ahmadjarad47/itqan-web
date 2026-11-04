import { computed, inject, Injectable } from '@angular/core';
import { CustomFieldDefinition, CustomFieldEntity, EntityId } from '@domain/models';
import { CustomFieldRepository } from '@domain/ports/repositories';
import { EntityStore, newId } from './entity-store';

export type CustomFieldDraft = Omit<CustomFieldDefinition, 'id' | 'order'>;

@Injectable({ providedIn: 'root' })
export class CustomFieldStore extends EntityStore<CustomFieldDefinition> {
  protected readonly repository = inject(CustomFieldRepository);

  private readonly byEntity = computed(() => {
    const map = new Map<CustomFieldEntity, CustomFieldDefinition[]>();
    for (const field of this.all()) {
      const list = map.get(field.entity) ?? [];
      list.push(field);
      map.set(field.entity, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.order - b.order);
    return map;
  });

  /** Every definition of an entity, active or not (admin view). */
  forEntity(entity: CustomFieldEntity): readonly CustomFieldDefinition[] {
    return this.byEntity().get(entity) ?? [];
  }

  /** Active definitions rendered on forms. */
  activeFor(entity: CustomFieldEntity): readonly CustomFieldDefinition[] {
    return this.forEntity(entity).filter((f) => f.active);
  }

  listColumns(entity: CustomFieldEntity): readonly CustomFieldDefinition[] {
    return this.activeFor(entity).filter((f) => f.showInList);
  }

  create(draft: CustomFieldDraft): CustomFieldDefinition {
    const order = Math.max(0, ...this.forEntity(draft.entity).map((f) => f.order)) + 1;
    return this.insert({ ...draft, id: newId('cf'), order });
  }

  update(id: EntityId, changes: Partial<CustomFieldDraft>): void {
    this.modify(id, changes);
  }

  /** Swaps the position of a field with its neighbour. */
  move(id: EntityId, direction: -1 | 1): void {
    const field = this.find(id);
    if (!field) return;
    const list = this.forEntity(field.entity);
    const neighbour = list[list.findIndex((f) => f.id === id) + direction];
    if (!neighbour) return;
    this.modify(id, { order: neighbour.order });
    this.modify(neighbour.id, { order: field.order });
  }

  remove(id: EntityId): void {
    this.removeWhere((f) => f.id === id);
  }
}
