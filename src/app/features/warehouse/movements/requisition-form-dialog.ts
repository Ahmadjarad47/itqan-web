import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { InventoryStore } from '@application/state/inventory.store';
import { DepartmentStore } from '@application/state/organization.store';
import { ProjectStore } from '@application/state/project.store';
import { RequisitionStore, WarehouseStore } from '@application/state/warehouse.store';
import { ToastService } from '@core/feedback/toast.service';
import { EntityId, IsoDate, Requisition, UNIT_LABELS } from '@domain/models';
import { addDays, todayIso } from '@domain/rules';
import { NumPipe } from '@shared/pipes/format.pipes';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';
import { ItemPicker } from '../shared/item-picker';

interface LineDraft {
  id: number;
  materialId: EntityId | null;
  quantity: number;
  note: string;
}

/** New requisition (طلب احتياج) — from the system or typed in from a paper form. */
@Component({
  selector: 'app-requisition-form-dialog',
  imports: [Modal, Icon, ItemPicker, NumPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [(open)]="open" [title]="origin() === 'paper' ? 'إدخال طلب احتياج ورقي' : 'طلب احتياج جديد'" subtitle="الجهة/القسم، تاريخ الطلب، تاريخ التسليم المطلوب والعناصر" width="760px">
      <div class="form-grid">
        @if (origin() === 'paper') {
          <label class="field">
            <span class="field__label">رقم الطلب الورقي *</span>
            <input class="input ltr" [value]="paperNumber()" (input)="paperNumber.set($any($event.target).value)" />
          </label>
        }
        <label class="field">
          <span class="field__label">الجهة / القسم</span>
          <select class="select" (change)="departmentId.set($any($event.target).value || null)">
            <option value="">— أخرى —</option>
            @for (d of departments.all(); track d.id) {
              <option [value]="d.id" [selected]="d.id === departmentId()">{{ d.name }}</option>
            }
          </select>
        </label>
        <label class="field">
          <span class="field__label">مقدم الطلب {{ departmentId() ? '' : '*' }}</span>
          <input class="input" [value]="requester()" (input)="requester.set($any($event.target).value)" />
        </label>
        <label class="field">
          <span class="field__label">المشروع</span>
          <select class="select" (change)="projectId.set($any($event.target).value || null)">
            <option value="">— بدون —</option>
            @for (p of projects.sorted(); track p.id) {
              <option [value]="p.id">{{ p.code }} — {{ p.name }}</option>
            }
          </select>
        </label>
        <label class="field">
          <span class="field__label">تاريخ الطلب *</span>
          <input class="input" type="date" [value]="requestDate()" (change)="requestDate.set($any($event.target).value)" />
        </label>
        <label class="field">
          <span class="field__label">تاريخ التسليم المطلوب *</span>
          <input class="input" type="date" [value]="dueDate()" (change)="dueDate.set($any($event.target).value)" />
        </label>
        <label class="field">
          <span class="field__label">المستودع المطلوب منه</span>
          <select class="select" (change)="warehouseId.set($any($event.target).value || null)">
            <option value="">— أي مستودع —</option>
            @for (row of warehouses.tree(); track row.warehouse.id) {
              <option [value]="row.warehouse.id">{{ row.depth ? '  ↳ ' : '' }}{{ row.warehouse.name }}</option>
            }
          </select>
        </label>
      </div>

      <h4 class="section-title lines-title">العناصر المطلوبة</h4>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>العنصر</th><th>الكمية</th><th>ملاحظات</th><th></th></tr></thead>
          <tbody>
            @for (l of lines(); track l.id) {
              <tr>
                <td style="min-width: 260px"><app-item-picker [small]="true" [value]="l.materialId" (valueChange)="patch(l.id, { materialId: $event })" /></td>
                <td style="width: 140px">
                  <input class="input input--sm" type="number" min="0" step="any" [value]="l.quantity || ''" (input)="patch(l.id, { quantity: +$any($event.target).value })" />
                  @if (inventory.find(l.materialId); as m) {
                    <small class="subtle">متوفر {{ m.stock | num }} {{ units[m.unit] }}</small>
                  }
                </td>
                <td><input class="input input--sm" [value]="l.note" (input)="patch(l.id, { note: $any($event.target).value })" /></td>
                <td><button type="button" class="btn btn--ghost btn--icon btn--sm" aria-label="حذف" (click)="remove(l.id)"><app-icon name="trash" [size]="14" /></button></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <button type="button" class="btn btn--sm add" (click)="add()"><app-icon name="plus" [size]="14" /> عنصر آخر</button>
      <label class="field notes">
        <span class="field__label">ملاحظات عامة</span>
        <input class="input" [value]="notes()" (input)="notes.set($any($event.target).value)" />
      </label>

      <ng-container modal-actions>
        @if (error(); as e) {
          <span class="blocker">{{ e }}</span>
        }
        <button type="button" class="btn" (click)="open.set(false)">إلغاء</button>
        <button type="button" class="btn btn--primary" [disabled]="!!error()" (click)="save()"><app-icon name="check" [size]="16" /> حفظ الطلب</button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .lines-title {
      margin: 18px 0 8px;
    }
    .add {
      margin-top: 8px;
    }
    .notes {
      margin-top: 14px;
    }
    .blocker {
      color: var(--warning);
      font-size: 12.5px;
      margin-inline-end: auto;
    }
  `,
})
export class RequisitionFormDialog {
  private readonly toast = inject(ToastService);
  private readonly requisitions = inject(RequisitionStore);
  protected readonly inventory = inject(InventoryStore);
  protected readonly departments = inject(DepartmentStore);
  protected readonly projects = inject(ProjectStore);
  protected readonly warehouses = inject(WarehouseStore);

  readonly open = model(false);
  readonly origin = input<'system' | 'paper'>('system');
  readonly saved = output<Requisition>();

  protected readonly units = UNIT_LABELS;
  protected readonly paperNumber = signal('');
  protected readonly departmentId = signal<EntityId | null>(null);
  protected readonly requester = signal('');
  protected readonly projectId = signal<EntityId | null>(null);
  protected readonly requestDate = signal<IsoDate>(todayIso());
  protected readonly dueDate = signal<IsoDate>(addDays(todayIso(), 3));
  protected readonly warehouseId = signal<EntityId | null>(null);
  protected readonly notes = signal('');
  protected readonly lines = signal<LineDraft[]>([]);
  private lineId = 0;

  protected readonly error = computed<string | null>(() => {
    if (this.origin() === 'paper' && !this.paperNumber().trim()) return 'أدخل رقم الطلب الورقي';
    if (!this.departmentId() && !this.requester().trim()) return 'حدد الجهة أو مقدم الطلب';
    if (!this.requestDate() || !this.dueDate()) return 'أدخل التواريخ';
    if (this.dueDate() < this.requestDate()) return 'تاريخ التسليم قبل تاريخ الطلب';
    const valid = this.lines().filter((l) => l.materialId && l.quantity > 0);
    if (!valid.length) return 'أضف عنصراً واحداً على الأقل مع الكمية';
    if (valid.length !== this.lines().filter((l) => l.materialId || l.quantity).length) return 'أكمل بيانات كل سطر';
    return null;
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      this.paperNumber.set('');
      this.departmentId.set(null);
      this.requester.set('');
      this.projectId.set(null);
      this.requestDate.set(todayIso());
      this.dueDate.set(addDays(todayIso(), 3));
      this.warehouseId.set(null);
      this.notes.set('');
      this.lines.set([{ id: ++this.lineId, materialId: null, quantity: 0, note: '' }]);
    });
  }

  protected add(): void {
    this.lines.update((ls) => [...ls, { id: ++this.lineId, materialId: null, quantity: 0, note: '' }]);
  }

  protected patch(id: number, changes: Partial<LineDraft>): void {
    this.lines.update((ls) => ls.map((l) => (l.id === id ? { ...l, ...changes } : l)));
  }

  protected remove(id: number): void {
    this.lines.update((ls) => ls.filter((l) => l.id !== id));
  }

  protected save(): void {
    if (this.error()) return;
    const requisition = this.requisitions.create(
      {
        origin: this.origin(),
        departmentId: this.departmentId(),
        requester: this.requester().trim(),
        projectId: this.projectId(),
        requestDate: this.requestDate(),
        dueDate: this.dueDate(),
        warehouseId: this.warehouseId(),
        notes: this.notes().trim(),
        lines: this.lines()
          .filter((l) => l.materialId && l.quantity > 0)
          .map((l) => ({ materialId: l.materialId!, quantity: l.quantity, note: l.note.trim() })),
      },
      this.paperNumber(),
    );
    this.toast.success('تم حفظ طلب الاحتياج', requisition.number);
    this.saved.emit(requisition);
    this.open.set(false);
  }
}
