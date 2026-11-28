import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EmployeeStore } from '@application/state/organization.store';
import { RoleStore } from '@application/state/role.store';
import { ConfirmService } from '@core/feedback/confirm.service';
import { ToastService } from '@core/feedback/toast.service';
import { ADMIN_ROLE_ID, ALL_PERMISSIONS, EntityId, Permission, PERMISSION_GROUPS, PermissionGroup, Role, ROLE_COLORS } from '@domain/models';
import { Avatar } from '@shared/ui/avatar/avatar';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { FormDraft } from '@shared/ui/form-draft/form-draft';

@Component({
  selector: 'app-roles-page',
  imports: [ReactiveFormsModule, FormDraft, PageHeader, Icon, Modal, Avatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './roles-page.html',
  styleUrl: './roles-page.scss',
})
export class RolesPage {
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly roles = inject(RoleStore);
  protected readonly employees = inject(EmployeeStore);

  protected readonly groups = PERMISSION_GROUPS;
  protected readonly colors = ROLE_COLORS;
  protected readonly total = ALL_PERMISSIONS.length;
  protected readonly adminRoleId = ADMIN_ROLE_ID;

  protected readonly view = signal<'editor' | 'matrix'>('editor');
  /** Keeps the user's choice across role edits; falls back to the first role only when it is gone. */
  protected readonly selectedId = linkedSignal<readonly Role[], EntityId>({
    source: () => this.roles.sorted(),
    computation: (roles, previous) => (previous && roles.some((r) => r.id === previous.value) ? previous.value : (roles[0]?.id ?? '')),
  });
  protected readonly selected = computed(() => this.roles.find(this.selectedId()));
  protected readonly locked = computed(() => this.selectedId() === ADMIN_ROLE_ID);
  protected readonly members = computed(() => this.employees.withRole(this.selectedId()));
  protected readonly creating = signal(false);

  protected readonly form = this.fb.group({
    name: ['', Validators.required],
    description: [''],
    color: [ROLE_COLORS[1] as string],
    copyFrom: [''],
  });

  protected has(role: Role, permission: Permission): boolean {
    return role.permissions.includes(permission);
  }

  protected groupState(role: Role, group: PermissionGroup): 'all' | 'some' | 'none' {
    const count = group.permissions.filter((p) => role.permissions.includes(p.key)).length;
    return count === group.permissions.length ? 'all' : count ? 'some' : 'none';
  }

  protected toggle(role: Role, permission: Permission): void {
    if (role.id === ADMIN_ROLE_ID) return;
    this.roles.togglePermission(role.id, permission);
  }

  protected toggleGroup(role: Role, group: PermissionGroup): void {
    if (role.id === ADMIN_ROLE_ID) return;
    const keys = group.permissions.map((p) => p.key);
    const next =
      this.groupState(role, group) === 'all'
        ? role.permissions.filter((p) => !keys.includes(p))
        : [...new Set([...role.permissions, ...keys])];
    this.roles.setPermissions(role.id, next);
  }

  protected rename(field: 'name' | 'description', value: string): void {
    if (field === 'name' && !value.trim()) return;
    this.roles.update(this.selectedId(), { [field]: value.trim() });
  }

  protected setColor(color: string): void {
    this.roles.update(this.selectedId(), { color });
  }

  protected openCreate(): void {
    this.form.reset({ color: ROLE_COLORS[1], copyFrom: '' });
    this.creating.set(true);
  }

  protected create(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, description, color, copyFrom } = this.form.getRawValue();
    const role = this.roles.create({ name, description, color, permissions: this.roles.find(copyFrom)?.permissions ?? ['dashboard.view'] });
    this.selectedId.set(role.id);
    this.creating.set(false);
    this.toast.success('تم إنشاء الدور', role.name);
  }

  protected async remove(role: Role): Promise<void> {
    const assigned = this.employees.withRole(role.id).length;
    if (assigned) {
      this.toast.warning('لا يمكن حذف الدور', `يوجد ${assigned} مستخدم مرتبط به — انقلهم إلى دور آخر أولاً`);
      return;
    }
    const accepted = await this.confirm.ask({ title: 'حذف الدور', message: `حذف الدور «${role.name}» نهائياً؟`, confirmLabel: 'حذف', danger: true });
    if (accepted && this.roles.remove(role.id)) this.toast.info('تم حذف الدور');
  }
}
