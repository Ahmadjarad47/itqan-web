import { Entity, EntityId } from '@domain/models';
import { Repository } from '@domain/ports/repositories';

export const STORAGE_NAMESPACE = 'erp101.v2.';

/** Collections with pending writes, flushed together once the browser is idle. */
const dirty = new Map<string, () => void>();
let flushScheduled = false;

function scheduleFlush(key: string, write: () => void): void {
  dirty.set(key, write);
  if (flushScheduled) return;
  flushScheduled = true;
  const run = () => flushPendingWrites();
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 500 });
  else setTimeout(run, 50);
}

/** Writes every pending collection to storage immediately. */
export function flushPendingWrites(): void {
  flushScheduled = false;
  const writes = [...dirty.values()];
  dirty.clear();
  writes.forEach((write) => write());
}

if (typeof window !== 'undefined') {
  // Never lose a pending write when the tab is hidden or closed.
  window.addEventListener('pagehide', flushPendingWrites);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingWrites();
  });
}

/**
 * Browser-storage adapter for the repository port. It simulates a backend for the
 * UI-only build: data is seeded on first use and survives page reloads.
 * Writes are coalesced and serialized off the interaction path, and the seed
 * dataset is loaded lazily so returning visitors never download it.
 * Swapping it for an HTTP adapter requires no change outside the infrastructure layer.
 */
export class LocalStorageRepository<T extends Entity> implements Repository<T> {
  private cache: T[] | null = null;

  constructor(
    private readonly collection: string,
    private readonly seed: () => Promise<T[]>,
  ) {}

  async getAll(): Promise<T[]> {
    return [...(await this.items())];
  }

  async save(entity: T): Promise<void> {
    const items = await this.items();
    const index = items.findIndex((item) => item.id === entity.id);
    this.persist(index === -1 ? [...items, entity] : items.map((item, i) => (i === index ? entity : item)));
  }

  async saveMany(entities: readonly T[]): Promise<void> {
    const incoming = new Map(entities.map((entity) => [entity.id, entity]));
    const merged = (await this.items()).map((item) => incoming.get(item.id) ?? item);
    const known = new Set(merged.map((item) => item.id));
    this.persist([...merged, ...entities.filter((entity) => !known.has(entity.id))]);
  }

  async remove(id: EntityId): Promise<void> {
    this.persist((await this.items()).filter((item) => item.id !== id));
  }

  private get key(): string {
    return STORAGE_NAMESPACE + this.collection;
  }

  private async items(): Promise<T[]> {
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
    const seeded = await this.seed();
    if (this.cache) return this.cache;
    this.persist(seeded);
    return seeded;
  }

  private persist(items: T[]): void {
    this.cache = items;
    scheduleFlush(this.key, () => {
      try {
        localStorage.setItem(this.key, JSON.stringify(this.cache ?? items));
      } catch {
        // Quota exceeded or private mode: keep working from memory.
      }
    });
  }
}

export function clearLocalStorageData(): void {
  dirty.clear();
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(STORAGE_NAMESPACE))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // Nothing to clear.
  }
}
