import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { EmployeeStore } from '@application/state/organization.store';
import { WarehouseStore } from '@application/state/warehouse.store';
import { ToastService } from '@core/feedback/toast.service';
import { EntityId, Warehouse } from '@domain/models';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';

interface Draft {
  code: string;
  name: string;
  address: string;
  managerId: string;
  phones: string;
  parentId: string;
  shelfPrefix: string;
  shelfCount: number;
}

/** Create («إنشاء مستودع») or edit the basic data of a warehouse. */
@Component({
  selector: 'app-warehouse-form-dialog',
  imports: [Modal, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [(open)]="open" [title]="editing() ? 'تعديل بيانات المستودع' : 'إنشاء مستودع'" subtitle="البيانات الأساسية: الرمز، الاسم، العنوان، المسؤول وأرقام التواصل" width="620px">
      <div class="form-grid">
        <label class="field">
          <span class="field__label">رمز المستودع *</span>
          <input class="input ltr" [value]="draft().code" (input)="patch({ code: $any($event.target).value.toUpperCase() })" placeholder="WH-XXX" />
          @if (codeTaken()) {
            <span class="field__error">الرمز مستخدم لمستودع آخر</span>
          }
        </label>
        <label class="field">
          <span class="field__label">الاسم *</span>
          <input class="input" [value]="draft().name" (input)="patch({ name: $any($event.target).value })" />
        </label>
        <label class="field span-full">
          <span class="field__label">العنوان</span>
          <input class="input" [value]="draft().address" (input)="patch({ address: $any($event.target).value })" />
        </label>
        <label class="field">
          <span class="field__label">المسؤول</span>
          <select class="select" (change)="patch({ managerId: $any($event.target).value })">
            <option value="">— بدون —</option>
            @for (e of employees.activeUsers(); track e.id) {
              <option [value]="e.id" [selected]="e.id === draft().managerId">{{ e.name }} — {{ e.title }}</option>
            }
          </select>
        </label>
        <label class="field">
          <span class="field__label">أرقام التواصل</span>
          <input class="input ltr" [value]="draft().phones" (input)="patch({ phones: $any($event.target).value })" placeholder="+963 ..." />
        </label>
        <label class="field span-full">
          <span class="field__label">تابع لمستودع (هيكلية)</span>
          <select class="select" (change)="patch({ parentId: $any($event.target).value })">
            <option value="">مستودع رئيسي (غير تابع)</option>
            @for (row of parentOptions(); track row.warehouse.id) {
              <option [value]="row.warehouse.id" [selected]="row.warehouse.id === draft().parentId">{{ indent(row.depth) }}{{ row.warehouse.code }} — {{ row.warehouse.name }}</option>
            }
          </select>
        </label>
        @if (!editing()) {
          <label class="field">
            <span class="field__label">بادئة ترميز الرفوف</span>
            <input class="input ltr" [value]="draft().shelfPrefix" (input)="patch({ shelfPrefix: $any($event.target).value.toUpperCase() })" placeholder="مثال: A" />
          </label>
          <label class="field">
            <span class="field__label">عدد الرفوف المبدئي</span>
            <input class="input" type="number" min="0" max="200" [value]="draft().shelfCount" (input)="patch({ shelfCount: +$any($event.target).value })" />
            <span class="field__hint">تُرمَّز تلقائياً: {{ (draft().shelfPrefix || 'S') + '-01' }}، {{ (draft().shelfPrefix || 'S') + '-02' }} ...</span>
          </label>
        }
      </div>
      <ng-container modal-actions>
        <button type="button" class="btn" (click)="open.set(false)">إلغاء</button>
        <button type="button" class="btn btn--primary" [disabled]="!valid()" (click)="save()"><app-icon name="check" [size]="16" /> حفظ</button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .field__error {
      color: var(--danger);
      font-size: 12px;
    }
    .field__hint {
      color: var(--text-subtle);
      font-size: 11.5px;
    }
  `,
})
export class WarehouseFormDialog {
  private readonly store = inject(WarehouseStore);
  private readonly toast = inject(ToastService);
  protected readonly employees = inject(EmployeeStore);

  readonly open = model(false);
  readonly editing = input<Warehouse | null>(null);
  readonly parentId = input<EntityId | null>(null);
  readonly saved = output<Warehouse>();

  protected readonly draft = signal<Draft>(this.empty());

  protected readonly codeTaken = computed(() => !!this.draft().code && this.store.isCodeTaken(this.draft().code, this.editing()?.id));
  protected readonly valid = computed(() => !!this.draft().code.trim() && !!this.draft().name.trim() && !this.codeTaken());
  protected readonly parentOptions = computed(() => {
    const editing = this.editing();
    const excluded = editing ? this.store.subtreeIds(editing.id) : new Set<string>();
    return this.store.tree().filter((row) => !excluded.has(row.warehouse.id));
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const w = this.editing();
      this.draft.set(
        w
          ? { code: w.code, name: w.name, address: w.address, managerId: w.managerId ?? '', phones: w.phones, parentId: w.parentId ?? '', shelfPrefix: '', shelfCount: 0 }
          : { ...this.empty(), parentId: this.parentId() ?? '' },
      );
    });
  }

  protected indent(depth: number): string {
    return depth ? '  '.repeat(depth) + '↳ ' : '';
  }

  protected patch(changes: Partial<Draft>): void {
    this.draft.update((d) => ({ ...d, ...changes }));
  }

  protected save(): void {
    if (!this.valid()) return;
    const d = this.draft();
    const data = {
      code: d.code.trim(),
      name: d.name.trim(),
      address: d.address.trim(),
      managerId: d.managerId || null,
      phones: d.phones.trim(),
      parentId: d.parentId || null,
    };
    const editing = this.editing();
    if (editing) {
      this.store.update(editing.id, data);
      this.toast.success('تم تحديث المستودع', data.name);
      this.saved.emit(this.store.find(editing.id)!);
    } else {
      const created = this.store.create(data);
      if (d.shelfCount > 0) this.store.addShelfRange(created.id, d.shelfPrefix.trim() || 'S', Math.min(200, Math.floor(d.shelfCount)));
      this.toast.success('تم إنشاء المستودع', `${created.code} — ${created.name}`);
      this.saved.emit(this.store.find(created.id)!);
    }
    this.open.set(false);
  }

  private empty(): Draft {
    return { code: '', name: '', address: '', managerId: '', phones: '', parentId: '', shelfPrefix: '', shelfCount: 0 };
  }
}
