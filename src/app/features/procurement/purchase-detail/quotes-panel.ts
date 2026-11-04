import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { PurchaseStore } from '@application/state/purchase.store';
import { SupplierStore } from '@application/state/supplier.store';
import { PurchaseRequest } from '@domain/models';
import { MoneyPipe, NumPipe } from '@shared/pipes/format.pipes';
import { Icon } from '@shared/ui/icon/icon';

/** Alternative offers received from different suppliers (RFQ responses). */
@Component({
  selector: 'app-quotes-panel',
  imports: [Icon, MoneyPipe, NumPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>المورد</th>
            <th>سعر الوحدة</th>
            <th>الإجمالي</th>
            <th>مدة التوريد</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (quote of request().quotes; track quote.id) {
            <tr [class.selected]="quote.supplierId === request().supplierId">
              <td>
                <div class="row">
                  <strong>{{ suppliers.find(quote.supplierId)?.name }}</strong>
                  @if (quote.supplierId === request().supplierId) {
                    <span class="badge badge--success"><app-icon name="check" [size]="12" /> معتمد</span>
                  }
                </div>
              </td>
              <td class="num">{{ quote.unitPrice | money }}</td>
              <td class="num"><strong>{{ quote.unitPrice * request().quantity | money }}</strong></td>
              <td class="num">{{ quote.leadTimeDays | num }} يوم</td>
              <td>
                <button type="button" class="btn btn--ghost btn--icon btn--sm" aria-label="حذف العرض" (click)="purchases.removeQuote(request().id, quote.id)">
                  <app-icon name="trash" [size]="15" />
                </button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="subtle">لم تُسجّل عروض أسعار بعد</td></tr>
          }
        </tbody>
      </table>
    </div>
    <div class="add">
      <select class="select input--sm" [value]="supplierId()" (change)="supplierId.set($any($event.target).value)">
        <option value="">اختر المورد...</option>
        @for (s of available(); track s.id) {
          <option [value]="s.id">{{ s.name }}</option>
        }
      </select>
      <input class="input input--sm" type="number" min="0" step="any" placeholder="سعر الوحدة" [value]="price() ?? ''" (input)="price.set(+$any($event.target).value || null)" />
      <input class="input input--sm" type="number" min="0" placeholder="مدة التوريد (يوم)" [value]="lead() ?? ''" (input)="lead.set(+$any($event.target).value || null)" />
      <button type="button" class="btn btn--primary btn--sm" [disabled]="!supplierId() || !price()" (click)="add()">
        <app-icon name="plus" [size]="15" /> إضافة عرض
      </button>
    </div>
  `,
  styles: `
    tr.selected td {
      background: var(--success-soft);
    }
    .add {
      display: grid;
      grid-template-columns: 1.6fr 1fr 1fr auto;
      gap: 8px;
      padding-top: 12px;
    }
    @media (max-width: 720px) {
      .add {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class QuotesPanel {
  protected readonly purchases = inject(PurchaseStore);
  protected readonly suppliers = inject(SupplierStore);

  readonly request = input.required<PurchaseRequest>();

  protected readonly supplierId = signal('');
  protected readonly price = signal<number | null>(null);
  protected readonly lead = signal<number | null>(null);

  protected readonly available = computed(() => {
    const used = new Set(this.request().quotes.map((q) => q.supplierId));
    return this.suppliers.sorted().filter((s) => !used.has(s.id));
  });

  protected add(): void {
    this.purchases.addQuote(this.request().id, {
      supplierId: this.supplierId(),
      unitPrice: this.price() ?? 0,
      leadTimeDays: this.lead() ?? 0,
      note: '',
    });
    this.supplierId.set('');
    this.price.set(null);
    this.lead.set(null);
  }
}
