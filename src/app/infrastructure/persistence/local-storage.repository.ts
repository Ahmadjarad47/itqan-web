import { signal } from '@angular/core';
import { Entity, EntityId } from '@domain/models';
import { Repository } from '@domain/ports/repositories';

export const STORAGE_NAMESPACE = 'erp101.v2.';

export interface StorageIssue {
  /** 'write': changes are only in memory. 'corrupt': stored data was unreadable. */
  readonly kind: 'write' | 'corrupt';
  readonly collection: string;
}

/** Persistence problems the user has to know about. */
export const storageIssues = signal<readonly StorageIssue[]>([]);

function reportIssue(kind: StorageIssue['kind'], collection: string): void {
  storageIssues.update((issues) =>
    issues.some((i) => i.kind === kind && i.collection === collection) ? issues : [...issues, { kind, collection }],
  );
}

function resolveWriteIssue(collection: string): void {
  storageIssues.update((issues) => issues.filter((i) => !(i.kind === 'write' && i.collection === collection)));
}

function parseCollection<T>(raw: string): T[] | null {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as T[]) : null;
  } catch {
    return null;
  }
}

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
  /** Set when unreadable stored data could not be copied aside: it must not be overwritten. */
  private readOnly = false;

  constructor(
    private readonly collection: string,
    private readonly seed: () => Promise<T[]>,
  ) {}

  async getAll(): Promise<T[]> {
    return [...(await this.items())];
  }

  async save(entity: T): Promise<void> {
    await this.items();
    const items = this.current;
    const index = items.findIndex((item) => item.id === entity.id);
    this.persist(index === -1 ? [...items, entity] : items.map((item, i) => (i === index ? entity : item)));
  }

  async saveMany(entities: readonly T[]): Promise<void> {
    const incoming = new Map(entities.map((entity) => [entity.id, entity]));
    await this.items();
    const merged = this.current.map((item) => incoming.get(item.id) ?? item);
    const known = new Set(merged.map((item) => item.id));
    this.persist([...merged, ...entities.filter((entity) => !known.has(entity.id))]);
  }

  async remove(id: EntityId): Promise<void> {
    await this.items();
    this.persist(this.current.filter((item) => item.id !== id));
  }

  private get key(): string {
    return STORAGE_NAMESPACE + this.collection;
  }

  /**
   * The loaded collection as it is right now. Writers must read it synchronously after
   * awaiting `items()`: a value passed through the await is stale when several writes are
   * issued in the same tick, and only the last one would survive.
   */
  private get current(): T[] {
    return this.cache!;
  }

  private async items(): Promise<T[]> {
    if (this.cache) return this.cache;
    const raw = this.read();
    if (raw) {
      const stored = parseCollection<T>(raw);
      if (stored) {
        this.cache = stored;
        return this.cache;
      }
      this.preserve(raw);
    }
    const seeded = await this.seed();
    if (this.cache) return this.cache;
    this.persist(seeded);
    return seeded;
  }

  private read(): string | null {
    try {
      return localStorage.getItem(this.key);
    } catch {
      return null; // Storage unavailable: work from the seed data.
    }
  }

  /** Copies unreadable data aside before anything can replace it. */
  private preserve(raw: string): void {
    try {
      localStorage.setItem(`${this.key}.corrupt-${Date.now()}`, raw);
    } catch {
      this.readOnly = true;
    }
    reportIssue('corrupt', this.collection);
  }

  private persist(items: T[]): void {
    this.cache = items;
    if (this.readOnly) {
      reportIssue('write', this.collection);
      return;
    }
    scheduleFlush(this.key, () => {
      try {
        localStorage.setItem(this.key, JSON.stringify(this.cache ?? items));
        resolveWriteIssue(this.collection);
      } catch {
        // Quota exceeded or private mode: keep working from memory, and say so.
        reportIssue('write', this.collection);
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
