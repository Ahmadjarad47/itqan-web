import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { EntityId } from '@domain/models';
import { EmployeeStore } from './organization.store';

export type Theme = 'light' | 'dark';

export const MANAGER_ID = 'manager';

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

/** Simulated signed-in user (no backend auth) and UI preferences. */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly employees = inject(EmployeeStore);

  readonly userId = signal<EntityId>(readPreference(USER_KEY) ?? MANAGER_ID);
  readonly theme = signal<Theme>((readPreference(THEME_KEY) as Theme | null) ?? 'light');

  readonly isManager = computed(() => this.userId() === MANAGER_ID);
  readonly employee = computed(() => this.employees.find(this.userId()));
  readonly displayName = computed(() => this.employee()?.name ?? 'م. سامر الحلبي');
  readonly displayTitle = computed(() => this.employee()?.title ?? 'مدير الإنتاج والتخطيط');

  constructor() {
    effect(() => {
      document.documentElement.dataset['theme'] = this.theme();
      writePreference(THEME_KEY, this.theme());
    });
    effect(() => writePreference(USER_KEY, this.userId()));
  }

  switchUser(id: EntityId): void {
    this.userId.set(id);
  }

  toggleTheme(): void {
    this.theme.update((theme) => (theme === 'light' ? 'dark' : 'light'));
  }
}
