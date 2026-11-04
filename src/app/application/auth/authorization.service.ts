import { computed, inject, Injectable } from '@angular/core';
import { Permission } from '@domain/models';
import { RoleStore } from '../state/role.store';
import { SessionStore } from '../state/session.store';

/**
 * Role-based access control for the current user. Permissions are resolved
 * reactively, so switching user or editing a role updates the UI immediately.
 */
@Injectable({ providedIn: 'root' })
export class AuthorizationService {
  private readonly session = inject(SessionStore);
  private readonly roles = inject(RoleStore);

  readonly role = computed(() => this.roles.find(this.session.user()?.roleId));
  readonly permissions = computed(() => new Set<Permission>(this.role()?.permissions ?? []));

  can(permission: Permission): boolean {
    return this.permissions().has(permission);
  }

  canAny(permissions: readonly Permission[]): boolean {
    return permissions.some((p) => this.can(p));
  }
}
