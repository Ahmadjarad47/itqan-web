import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BomStore } from '@application/state/bom.store';
import { CustomFieldStore } from '@application/state/custom-field.store';
import { ProjectStore } from '@application/state/project.store';
import { PurchaseStore } from '@application/state/purchase.store';
import { SupplierStore } from '@application/state/supplier.store';
import { ConfirmService } from '@core/feedback/confirm.service';
import { CanDirective } from '@core/auth/can.directive';
import { ToastService } from '@core/feedback/toast.service';
import { CustomFieldChange, CustomFieldsForm } from '@shared/ui/custom-fields/custom-fields-form';
import {
  CustomFieldDefinition,
  CustomFieldValue,
  CustomFieldValues,
  EntityId,
  formatCustomValue,
  missingRequiredFields,
  Supplier,
  SUPPLIER_CATEGORIES,
} from '@domain/models';
import { isStageDone } from '@domain/rules';
import { Avatar } from '@shared/ui/avatar/avatar';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { FormDraft } from '@shared/ui/form-draft/form-draft';

@Component({
  selector: 'app-suppliers-page',
  imports: [ReactiveFormsModule, FormDraft, RouterLink, CanDirective, CustomFieldsForm, PageHeader, Icon, Modal, Avatar, EmptyState],
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

  private readonly fieldDefinitions = inject(CustomFieldStore);
  protected readonly columns = computed(() => this.fieldDefinitions.listColumns('supplier'));
  protected readonly formFields = computed(() => this.fieldDefinitions.activeFor('supplier'));
  protected readonly customValues = signal<CustomFieldValues>({});
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
    this.customValues.set({});
    this.dialogOpen.set(true);
  }

  protected openEdit(supplier: Supplier): void {
    this.editingId.set(supplier.id);
    const { id: _id, customFields, ...values } = supplier;
    this.form.setValue(values);
    this.customValues.set(customFields ?? {});
    this.dialogOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const missing = missingRequiredFields(this.formFields(), this.customValues());
    if (missing.length) {
      this.toast.warning('حقول مخصصة إلزامية', missing.join('، '));
      return;
    }
    const value = { ...this.form.getRawValue(), customFields: this.customValues() };
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

  protected setCustomValue(change: CustomFieldChange): void {
    this.customValues.update((values) => ({ ...values, [change.fieldId]: change.value }));
  }

  protected format(field: CustomFieldDefinition, value: CustomFieldValue | undefined): string {
    return formatCustomValue(field, value);
  }

  protected toggle(id: EntityId): void {
    this.expandedId.update((current) => (current === id ? null : id));
  }
}
