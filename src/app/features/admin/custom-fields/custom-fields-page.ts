import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CustomFieldStore } from '@application/state/custom-field.store';
import { ConfirmService } from '@core/feedback/confirm.service';
import { ToastService } from '@core/feedback/toast.service';
import {
  CUSTOM_FIELD_ENTITIES,
  CUSTOM_FIELD_TYPES,
  CustomFieldDefinition,
  CustomFieldEntity,
  CustomFieldType,
  CustomFieldValues,
} from '@domain/models';
import { CustomFieldChange, CustomFieldsForm } from '@shared/ui/custom-fields/custom-fields-form';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';

/** Entities whose list screens can show custom columns. */
const LIST_ENTITIES: readonly CustomFieldEntity[] = ['supplier', 'material'];

@Component({
  selector: 'app-custom-fields-page',
  imports: [ReactiveFormsModule, PageHeader, Icon, Modal, EmptyState, CustomFieldsForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './custom-fields-page.html',
  styleUrl: './custom-fields-page.scss',
})
export class CustomFieldsPage {
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly store = inject(CustomFieldStore);

  protected readonly entityInfo = CUSTOM_FIELD_ENTITIES;
  protected readonly entities = Object.keys(CUSTOM_FIELD_ENTITIES) as CustomFieldEntity[];
  protected readonly typeInfo = CUSTOM_FIELD_TYPES;
  protected readonly types = Object.keys(CUSTOM_FIELD_TYPES) as CustomFieldType[];

  protected readonly entity = signal<CustomFieldEntity>('bomNode');
  protected readonly fields = computed(() => this.store.forEntity(this.entity()));
  protected readonly active = computed(() => this.store.activeFor(this.entity()));
  protected readonly supportsList = computed(() => LIST_ENTITIES.includes(this.entity()));
  protected readonly previewValues = signal<CustomFieldValues>({});

  protected readonly dialogOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);

  protected readonly form = this.fb.group({
    label: ['', Validators.required],
    type: ['text' as CustomFieldType],
    options: [''],
    required: [false],
    placeholder: [''],
    unit: [''],
    showInList: [false],
    active: [true],
  });

  private readonly formType = toSignal(this.form.controls.type.valueChanges, { initialValue: this.form.controls.type.value });
  protected readonly needsOptions = computed(() => this.formType() === 'select' || this.formType() === 'multiselect');

  protected count(entity: CustomFieldEntity): number {
    return this.store.forEntity(entity).length;
  }

  protected selectEntity(entity: CustomFieldEntity): void {
    this.entity.set(entity);
    this.previewValues.set({});
  }

  protected preview(change: CustomFieldChange): void {
    this.previewValues.update((values) => ({ ...values, [change.fieldId]: change.value }));
  }

  protected openCreate(): void {
    this.editingId.set(null);
    this.form.reset({ type: 'text', active: true, required: false, showInList: false });
    this.dialogOpen.set(true);
  }

  protected openEdit(field: CustomFieldDefinition): void {
    this.editingId.set(field.id);
    this.form.setValue({
      label: field.label,
      type: field.type,
      options: field.options.join('\n'),
      required: field.required,
      placeholder: field.placeholder,
      unit: field.unit,
      showInList: field.showInList,
      active: field.active,
    });
    this.dialogOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const options = value.options
      .split(/[\n,،]/)
      .map((o) => o.trim())
      .filter(Boolean);
    if (this.needsOptions() && !options.length) {
      this.toast.warning('أضف خيارات القائمة', 'خيار واحد على الأقل في كل سطر');
      return;
    }
    const draft = {
      ...value,
      entity: this.entity(),
      options: this.needsOptions() ? [...new Set(options)] : [],
      showInList: this.supportsList() && value.showInList,
    };
    const id = this.editingId();
    if (id) {
      this.store.update(id, draft);
      this.toast.success('تم تحديث الحقل', draft.label);
    } else {
      this.store.create(draft);
      this.toast.success('تمت إضافة الحقل', `${draft.label} — ${this.entityInfo[draft.entity].label}`);
    }
    this.dialogOpen.set(false);
  }

  protected toggle(field: CustomFieldDefinition, key: 'active' | 'required' | 'showInList'): void {
    this.store.update(field.id, { [key]: !field[key] });
  }

  protected async remove(field: CustomFieldDefinition): Promise<void> {
    const accepted = await this.confirm.ask({
      title: 'حذف الحقل',
      message: `حذف «${field.label}»؟ القيم المحفوظة ستبقى في السجلات لكن لن تُعرض. يمكنك بدلاً من ذلك تعطيل الحقل.`,
      confirmLabel: 'حذف',
      danger: true,
    });
    if (!accepted) return;
    this.store.remove(field.id);
    this.toast.info('تم حذف الحقل');
  }
}
