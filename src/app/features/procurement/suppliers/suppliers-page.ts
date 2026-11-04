import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BomStore } from '@application/state/bom.store';
import { ProjectStore } from '@application/state/project.store';
import { PurchaseStore } from '@application/state/purchase.store';
import { SupplierStore } from '@application/state/supplier.store';
import { ConfirmService } from '@core/feedback/confirm.service';
import { ToastService } from '@core/feedback/toast.service';
import { EntityId, Supplier, SUPPLIER_CATEGORIES } from '@domain/models';
import { isStageDone } from '@domain/rules';
import { Avatar } from '@shared/ui/avatar/avatar';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';

@Component({
  selector: 'app-suppliers-page',
  imports: [ReactiveFormsModule, RouterLink, PageHeader, Icon, Modal, Avatar, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './suppliers-page.html',
  styleUrl: './suppliers-page.scss',
})
export class SuppliersPage {
  private readonly store = inject(SupplierStore);
  private readonly purchases = inject(PurchaseStore);
  private readonly bom = inject(BomStore);
  private readonly projects = inject(ProjectStore);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly categories = SUPPLIER_CATEGORIES;
  protected readonly stars = [1, 2, 3, 4, 5];
  protected readonly search = signal('');
  protected readonly category = signal('');
  protected readonly editingId = signal<EntityId | null>(null);
  protected readonly dialogOpen = signal(false);
  protected readonly expandedId = signal<EntityId | null>(null);

  /** Supply history: which component of which project each supplier has been awarded. */
  private readonly history = computed(() => {
    const map = new Map<EntityId, { id: string; component: string; code: string; project: string; delivered: boolean }[]>();
    for (const request of this.purchases.all()) {
      if (!request.supplierId) continue;
      const node = this.bom.find(request.nodeId);
      const list = map.get(request.supplierId) ?? [];
      list.push({
        id: request.id,
        component: request.title,
        code: node?.code ?? request.number,
        project: this.projects.find(request.projectId)?.code ?? 'مستقل',
        delivered: isStageDone(request, 'delivered'),
      });
      map.set(request.supplierId, list);
    }
    return map;
  });

  protected readonly rows = computed(() => {
    const term = this.search().trim();
    return this.store
      .sorted()
      .filter((s) => !this.category() || s.category === this.category())
      .filter((s) => !term || s.name.includes(term) || s.contactPerson.includes(term) || s.city.includes(term))
      .map((supplier) => ({ supplier, history: this.history().get(supplier.id) ?? [] }));
  });

  protected readonly form = this.fb.group({
    name: ['', Validators.required],
    category: [SUPPLIER_CATEGORIES[0] as string, Validators.required],
    rating: [3],
    contactPerson: [''],
    phone: [''],
    email: ['', Validators.email],
    city: [''],
  });

  protected openCreate(): void {
    this.editingId.set(null);
    this.form.reset();
    this.dialogOpen.set(true);
  }

  protected openEdit(supplier: Supplier): void {
    this.editingId.set(supplier.id);
    const { id: _id, ...values } = supplier;
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
      this.store.update(id, value);
      this.toast.success('تم تحديث بيانات المورد');
    } else {
      this.store.create(value);
      this.toast.success('تمت إضافة المورد', value.name);
    }
    this.dialogOpen.set(false);
  }

  protected async remove(supplier: Supplier): Promise<void> {
    const accepted = await this.confirm.ask({
      title: 'حذف المورد',
      message: `هل تريد حذف «${supplier.name}» من قائمة الموردين؟`,
      confirmLabel: 'حذف',
      danger: true,
    });
    if (!accepted) return;
    this.store.remove(supplier.id);
    this.toast.info('تم حذف المورد');
  }

  protected toggle(id: EntityId): void {
    this.expandedId.update((current) => (current === id ? null : id));
  }
}
