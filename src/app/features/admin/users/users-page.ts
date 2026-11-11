import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DepartmentStore, EmployeeStore } from '@application/state/organization.store';
import { RoleStore } from '@application/state/role.store';
import { SessionStore } from '@application/state/session.store';
import { ToastService } from '@core/feedback/toast.service';
import { ADMIN_ROLE_ID, Employee, EntityId } from '@domain/models';
import { Avatar } from '@shared/ui/avatar/avatar';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { FormDraft } from '@shared/ui/form-draft/form-draft';

@Component({
  selector: 'app-users-page',
  imports: [ReactiveFormsModule, FormDraft, PageHeader, Icon, Modal, Avatar, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './users-page.html',
  styleUrl: './users-page.scss',
})
export class UsersPage {
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly session = inject(SessionStore);
  protected readonly employees = inject(EmployeeStore);
  protected readonly roles = inject(RoleStore);
  protected readonly departments = inject(DepartmentStore);

  protected readonly search = signal('');
  protected readonly roleFilter = signal('');
  protected readonly dialogOpen = signal(false);
  protected readonly editingId = signal<EntityId | null>(null);

  protected readonly rows = computed(() => {
    const term = this.search().trim();
    return this.employees
      .all()
      .filter((e) => !this.roleFilter() || e.roleId === this.roleFilter())
      .filter((e) => !term || e.name.includes(term) || e.title.includes(term) || e.email.includes(term))
      .map((user) => ({ user, role: this.roles.find(user.roleId), department: this.departments.find(user.departmentId) }));
  });

  protected readonly stats = computed(() => ({
    total: this.employees.all().length,
    active: this.employees.activeUsers().length,
    roles: this.roles.all().length,
  }));

  protected readonly form = this.fb.group({
    name: ['', Validators.required],
    title: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    departmentId: ['', Validators.required],
    roleId: ['', Validators.required],
    active: [true],
  });

  protected isSelf(user: Employee): boolean {
    return user.id === this.session.userId();
  }

  /** Prevents locking the system out of its last active administrator. */
  private isLastAdmin(user: Employee): boolean {
    return user.roleId === ADMIN_ROLE_ID && this.employees.activeUsers().filter((e) => e.roleId === ADMIN_ROLE_ID).length <= 1;
  }

  protected changeRole(user: Employee, select: HTMLSelectElement): void {
    const roleId = select.value;
    if (this.isLastAdmin(user) && roleId !== ADMIN_ROLE_ID) {
      this.toast.warning('لا يمكن تغيير الدور', 'يجب أن يبقى مدير نظام واحد نشط على الأقل');
      select.value = user.roleId;
      return;
    }
    this.employees.update(user.id, { roleId });
    this.toast.success('تم تحديث الدور', `${user.name} ← ${this.roles.find(roleId)?.name}`);
  }

  protected toggleActive(user: Employee): void {
    if (user.active && (this.isSelf(user) || this.isLastAdmin(user))) {
      this.toast.warning('لا يمكن تعطيل هذا المستخدم', this.isSelf(user) ? 'لا يمكنك تعطيل حسابك الحالي' : 'آخر مدير نظام نشط');
      return;
    }
    this.employees.update(user.id, { active: !user.active });
  }

  protected openCreate(): void {
    this.editingId.set(null);
    this.form.reset({ active: true, roleId: 'r-operator', departmentId: '' });
    this.dialogOpen.set(true);
  }

  protected openEdit(user: Employee): void {
    this.editingId.set(user.id);
    const { id: _id, ...values } = user;
    this.form.setValue(values);
    this.dialogOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const id = this.editingId();
    if (id) {
      const current = this.employees.find(id)!;
      if (this.isLastAdmin(current) && (value.roleId !== ADMIN_ROLE_ID || !value.active)) {
        this.toast.warning('لا يمكن الحفظ', 'يجب أن يبقى مدير نظام واحد نشط على الأقل');
        return;
      }
      this.employees.update(id, value);
      this.toast.success('تم تحديث المستخدم');
    } else {
      this.employees.create(value);
      this.toast.success('تمت إضافة المستخدم', value.name);
    }
    this.dialogOpen.set(false);
  }
}
