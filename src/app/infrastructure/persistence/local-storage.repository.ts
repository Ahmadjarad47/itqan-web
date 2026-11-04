import { Entity, EntityId } from '@domain/models';
import { Repository } from '@domain/ports/repositories';

export const STORAGE_NAMESPACE = 'erp101.v1.';

/**
 * Browser-storage adapter for the repository port. It simulates a backend for the
 * UI-only build: data is seeded on first use and survives page reloads.
 * Swapping it for an HTTP adapter requires no change outside the infrastructure layer.
 */
export class LocalStorageRepository<T extends Entity> implements Repository<T> {
  private cache: T[] | null = null;

  constructor(
    private readonly collection: string,
    private readonly seed: () => T[],
  ) {}

  async getAll(): Promise<T[]> {
    return [...this.items()];
  }

  async save(entity: T): Promise<void> {
    const items = this.items();
    const index = items.findIndex((item) => item.id === entity.id);
    this.persist(index === -1 ? [...items, entity] : items.map((item, i) => (i === index ? entity : item)));
  }

  async saveMany(entities: readonly T[]): Promise<void> {
    const incoming = new Map(entities.map((entity) => [entity.id, entity]));
    const merged = this.items().map((item) => incoming.get(item.id) ?? item);
    const known = new Set(merged.map((item) => item.id));
    this.persist([...merged, ...entities.filter((entity) => !known.has(entity.id))]);
  }

  async remove(id: EntityId): Promise<void> {
    this.persist(this.items().filter((item) => item.id !== id));
  }

  private get key(): string {
    return STORAGE_NAMESPACE + this.collection;
  }

  private items(): T[] {
    if (this.cache) return this.cache;
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) {
        this.cache = JSON.parse(raw) as T[];
        return this.cache;
      }
    } catch {
      // Storage unavailable or corrupted: fall back to seed data.
    }
    const seeded = this.seed();
    this.persist(seeded);
    return seeded;
  }

  private persist(items: T[]): void {
    this.cache = items;
    try {
      localStorage.setItem(this.key, JSON.stringify(items));
    } catch {
      // Quota exceeded or private mode: keep working from memory.
    }
  }
}

export function clearLocalStorageData(): void {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(STORAGE_NAMESPACE))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // Nothing to clear.
  }
}
