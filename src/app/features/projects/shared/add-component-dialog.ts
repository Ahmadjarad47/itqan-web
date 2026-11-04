import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BomStore } from '@application/state/bom.store';
import { ToastService } from '@core/feedback/toast.service';
import { BomNode, Discipline, DISCIPLINES, DISCIPLINE_KEYS, EntityId, levelTitle, Unit, UNIT_LABELS } from '@domain/models';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';

@Component({
  selector: 'app-add-component-dialog',
  imports: [ReactiveFormsModule, Modal, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [(open)]="open" title="إضافة مكون فرعي" [subtitle]="subtitle()" width="600px">
      <form class="form-grid" [formGroup]="form" (ngSubmit)="submit()" id="add-component-form">
        <label class="field span-full">
          <span class="field__label">اسم المكون *</span>
          <input class="input" formControlName="name" placeholder="مثال: صفيحة تثبيت المحرك" />
        </label>
        <label class="field">
          <span class="field__label">رمز الجزء (فريد)</span>
          <input class="input ltr" formControlName="code" [placeholder]="suggestedCode()" />
          <span class="field__hint">يُولَّد تلقائياً إن تُرك فارغاً</span>
        </label>
        <label class="field">
          <span class="field__label">القسم ذو الصلة</span>
          <select class="select" formControlName="discipline">
            @for (d of disciplines; track d.key) {
              <option [value]="d.key">{{ d.label }}</option>
            }
          </select>
        </label>
        <label class="field">
          <span class="field__label">كمية الاستخدام في الأصل (Multiplier) *</span>
          <input class="input" type="number" min="0.01" step="any" formControlName="quantity" />
        </label>
        <label class="field">
          <span class="field__label">الوحدة</span>
          <select class="select" formControlName="unit">
            @for (u of units; track u.key) {
              <option [value]="u.key">{{ u.label }}</option>
            }
          </select>
        </label>
        <label class="field span-full">
          <span class="field__label">الوصف الفني</span>
          <textarea class="textarea" formControlName="description"></textarea>
        </label>
      </form>
      <ng-container modal-actions>
        <button type="button" class="btn" (click)="open.set(false)">إلغاء</button>
        <button type="submit" class="btn btn--primary" form="add-component-form">
          <app-icon name="plus" [size]="16" /> إضافة المكون
        </button>
      </ng-container>
    </app-modal>
  `,
})
export class AddComponentDialog {
  private readonly bom = inject(BomStore);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly open = model(false);
  readonly parentId = input.required<EntityId>();
  readonly created = output<BomNode>();

  protected readonly disciplines = DISCIPLINE_KEYS.map((key) => ({ key, label: DISCIPLINES[key].label }));
  protected readonly units = (Object.keys(UNIT_LABELS) as Unit[]).map((key) => ({ key, label: UNIT_LABELS[key] }));

  protected readonly parent = computed(() => this.bom.find(this.parentId()));
  protected readonly suggestedCode = computed(() => (this.parent() ? this.bom.nextChildCode(this.parentId()) : ''));
  protected readonly subtitle = computed(() => {
    const level = this.bom.tree().level(this.parentId()) + 1;
    return `ضمن «${this.parent()?.name ?? ''}» — المستوى ${level}: ${levelTitle(level)}`;
  });

  protected readonly form = this.fb.group({
    name: ['', Validators.required],
    code: [''],
    discipline: ['mechanical' as Discipline],
    quantity: [1, [Validators.required, Validators.min(0.01)]],
    unit: ['pcs' as Unit],
    description: [''],
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.reset({ discipline: this.parent()?.discipline ?? 'mechanical', quantity: 1, unit: 'pcs' });
      }
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const code = value.code.trim();
    if (code && this.bom.all().some((node) => node.code === code)) {
      this.toast.error('رمز الجزء مستخدم مسبقاً', 'يجب أن يكون معرف الجزء فريداً');
      return;
    }
    const node = this.bom.addChild(this.parentId(), { ...value, code });
    this.toast.success('تمت إضافة المكون', `${node.code} — ${node.name}`);
    this.open.set(false);
    this.created.emit(node);
  }
}
