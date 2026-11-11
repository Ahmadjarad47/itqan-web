import { computed, signal } from '@angular/core';
import { CustomFieldValue, Entity, EntityId, HasCustomFields } from '@domain/models';
import { Repository } from '@domain/ports/repositories';

/**
 * Signal-based in-memory state for one aggregate type. Mutations are applied
 * optimistically to the signal and then written through the repository port.
 */
export abstract class EntityStore<T extends Entity> {
  protected abstract readonly repository: Repository<T>;

  private readonly state = signal<readonly T[]>([]);

  readonly all = this.state.asReadonly();
  readonly byId = computed(() => new Map(this.state().map((entity) => [entity.id, entity] as const)));

  async load(): Promise<void> {
    this.state.set((await this.repository.getAll()).map((entity) => this.normalize(entity)));
  }

  /** Fills defaults for fields added after the entity was first stored. */
  protected normalize(entity: T): T {
    return entity;
  }

  find(id: EntityId | null | undefined): T | undefined {
    return id ? this.byId().get(id) : undefined;
  }

  /** Writes one dynamic (custom) field value on the entity. */
  setCustomField(id: EntityId, fieldId: EntityId, value: CustomFieldValue): void {
    this.modify(id, (entity) => {
      const current = (entity as HasCustomFields).customFields ?? {};
      return { ...entity, customFields: { ...current, [fieldId]: value } };
    });
  }

  protected insert(entity: T): T {
    this.state.update((items) => [...items, entity]);
    void this.repository.save(entity);
    return entity;
  }

  protected modify(id: EntityId, change: Partial<T> | ((entity: T) => T)): T | undefined {
    const current = this.find(id);
    if (!current) return undefined;
    const next = typeof change === 'function' ? change(current) : { ...current, ...change };
    this.state.update((items) => items.map((item) => (item.id === id ? next : item)));
    void this.repository.save(next);
    return next;
  }

  protected removeWhere(predicate: (entity: T) => boolean): void {
    const removed = this.state().filter(predicate);
    if (!removed.length) return;
    this.state.update((items) => items.filter((item) => !predicate(item)));
    removed.forEach((entity) => void this.repository.remove(entity.id));
  }
}

export function newId(prefix: string): EntityId {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}
