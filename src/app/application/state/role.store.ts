import { computed, inject, Injectable } from '@angular/core';
import { ADMIN_ROLE_ID, ALL_PERMISSIONS, EntityId, Permission, Role } from '@domain/models';
import { RoleRepository } from '@domain/ports/repositories';
import { EntityStore, newId } from './entity-store';

@Injectable({ providedIn: 'root' })
export class RoleStore extends EntityStore<Role> {
  protected readonly repository = inject(RoleRepository);

  readonly sorted = computed(() => [...this.all()].sort((a, b) => Number(b.system) - Number(a.system) || a.name.localeCompare(b.name, 'ar')));

  create(data: Pick<Role, 'name' | 'description' | 'color' | 'permissions'>): Role {
    return this.insert({ ...data, id: newId('r'), system: false });
  }

  update(id: EntityId, changes: Partial<Pick<Role, 'name' | 'description' | 'color'>>): void {
    this.modify(id, changes);
  }

  /** Permissions added in later releases are granted to the stored administrator role too. */
  protected override normalize(role: Role): Role {
    return role.id === ADMIN_ROLE_ID ? { ...role, permissions: [...ALL_PERMISSIONS] } : role;
  }

  /** The administrator role always keeps the full permission set. */
  setPermissions(id: EntityId, permissions: readonly Permission[]): void {
    if (id === ADMIN_ROLE_ID) return;
    this.modify(id, { permissions: ALL_PERMISSIONS.filter((p) => permissions.includes(p)) });
  }

  togglePermission(id: EntityId, permission: Permission): void {
    const role = this.find(id);
    if (!role) return;
    const has = role.permissions.includes(permission);
    this.setPermissions(id, has ? role.permissions.filter((p) => p !== permission) : [...role.permissions, permission]);
  }

  remove(id: EntityId): boolean {
    const role = this.find(id);
    if (!role || role.system) return false;
    this.removeWhere((r) => r.id === id);
    return true;
  }
}
