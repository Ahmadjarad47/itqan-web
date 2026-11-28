import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { EntityId } from '@domain/models';
import { EmployeeStore } from './organization.store';

export type Theme = 'light' | 'dark';

const DEFAULT_USER_ID = 'u-admin';
const THEME_KEY = 'erp101.theme';
const USER_KEY = 'erp101.user';

function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePreference(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Preferences are a convenience only.
  }
}

/** Simulated signed-in user (no backend authentication) and UI preferences. */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly employees = inject(EmployeeStore);

  private readonly requestedUserId = signal<EntityId>(readPreference(USER_KEY) ?? DEFAULT_USER_ID);
  readonly theme = signal<Theme>((readPreference(THEME_KEY) as Theme | null) ?? 'light');

  /** Falls back to the first active user when the stored one no longer exists or was disabled. */
  readonly user = computed(() => {
    const requested = this.employees.find(this.requestedUserId());
    if (requested?.active) return requested;
    const fallback = this.employees.find(DEFAULT_USER_ID);
    return fallback?.active ? fallback : this.employees.activeUsers()[0];
  });
  readonly userId = computed(() => this.user()?.id ?? '');
  readonly displayName = computed(() => this.user()?.name ?? '—');
  readonly displayTitle = computed(() => this.user()?.title ?? '');

  constructor() {
    effect(() => {
      document.documentElement.dataset['theme'] = this.theme();
      writePreference(THEME_KEY, this.theme());
    });
  }

  switchUser(id: EntityId): void {
    this.requestedUserId.set(id);
    writePreference(USER_KEY, id);
  }

  toggleTheme(): void {
    this.theme.update((theme) => (theme === 'light' ? 'dark' : 'light'));
  }
}
