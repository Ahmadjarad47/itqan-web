import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { PurchaseStore } from '@application/state/purchase.store';
import { ToastService } from '@core/feedback/toast.service';
import { SupplierStore } from '@application/state/supplier.store';
import {
  CONTACT_CHANNEL_ICONS,
  CONTACT_CHANNEL_LABELS,
  ContactChannel,
  EntityId,
  PurchaseRequest,
  SupplierQuote,
} from '@domain/models';
import { quoteTotal, todayIso } from '@domain/rules';
import { ArDatePipe, MoneyPipe, NumPipe } from '@shared/pipes/format.pipes';
import { Icon } from '@shared/ui/icon/icon';

interface QuoteRow {
  readonly quote: SupplierQuote;
  readonly supplier: string;
  readonly total: number;
  readonly cheapest: boolean;
  readonly fastest: boolean;
  readonly expired: boolean;
}

/**
 * Received quotations, organized side by side: ranked by total landed cost with the
 * cheapest and fastest offers highlighted, and every commercial term in one place.
 */
@Component({
  selector: 'app-quotes-panel',
  imports: [Icon, MoneyPipe, NumPipe, ArDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (pending().length) {
      <div class="pending">
        <app-icon name="clock" [size]="14" />
        بانتظار عروض من:
        @for (c of pending(); track c.id) {
          <button type="button" class="chip" (click)="supplierId.set(c.supplierId)">{{ suppliers.find(c.supplierId)?.name }}</button>
        }
      </div>
    }

    <div class="quotes">
      @for (row of rows(); track row.quote.id; let i = $index) {
        <article class="quote" [class.quote--selected]="row.quote.supplierId === request().supplierId">
          <header class="quote__head">
            <span class="rank num">{{ i + 1 }}</span>
            <div class="quote__who">
              <strong>{{ row.supplier }}</strong>
              <small>
                <app-icon [name]="channelIcons[row.quote.channel]" [size]="12" /> {{ channelLabels[row.quote.channel] }}
                @if (row.quote.receivedAt) {
                  · وصل {{ row.quote.receivedAt | arDate: 'short' }}
                }
              </small>
            </div>
            <div class="tags">
              @if (row.cheapest) {
                <span class="badge badge--success"><app-icon name="coins" [size]="12" /> الأقل تكلفة</span>
              }
              @if (row.fastest) {
                <span class="badge badge--info"><app-icon name="truck" [size]="12" /> الأسرع توريداً</span>
              }
              @if (row.expired) {
                <span class="badge badge--danger">منتهي الصلاحية</span>
              }
              @if (row.quote.supplierId === request().supplierId) {
                <span class="badge badge--primary"><app-icon name="check" [size]="12" /> معتمد</span>
              }
            </div>
            <button type="button" class="btn btn--ghost btn--icon btn--sm" aria-label="حذف العرض" (click)="purchases.removeQuote(request().id, row.quote.id)">
              <app-icon name="trash" [size]="15" />
            </button>
          </header>
          <dl class="quote__grid">
            <div><dt>سعر الوحدة</dt><dd class="num">{{ row.quote.unitPrice | money }}</dd></div>
            <div><dt>الشحن / مصاريف إضافية</dt><dd class="num">{{ row.quote.shippingCost | money }}</dd></div>
            <div class="total"><dt>الإجمالي ({{ request().quantity | num }})</dt><dd class="num">{{ row.total | money }}</dd></div>
            <div><dt>مدة التوريد</dt><dd class="num">{{ row.quote.leadTimeDays | num }} يوم</dd></div>
            <div><dt>شروط الدفع</dt><dd>{{ row.quote.paymentTerms || '—' }}</dd></div>
            <div><dt>الضمان</dt><dd>{{ row.quote.warranty || '—' }}</dd></div>
            <div><dt>صلاحية العرض</dt><dd>{{ row.quote.validUntil ? (row.quote.validUntil | arDate: 'short') : '—' }}</dd></div>
          </dl>
          @if (row.quote.note) {
            <p class="quote__note"><app-icon name="clipboard" [size]="13" /> {{ row.quote.note }}</p>
          }
        </article>
      } @empty {
        <p class="subtle">لم تُسجّل عروض أسعار بعد — أدخل العروض الواردة من الموردين عبر البريد أو غيره.</p>
      }
    </div>

    <h5 class="add-title"><app-icon name="plus" [size]="14" /> إدخال عرض سعر وارد</h5>
    <div class="add">
      <label class="mini span-2">
        <span>المورد</span>
        <select class="select input--sm" [value]="supplierId()" (change)="supplierId.set($any($event.target).value)">
          <option value="">اختر المورد...</option>
          @for (s of available(); track s.id) {
            <option [value]="s.id" [selected]="s.id === supplierId()">{{ s.name }}</option>
          }
        </select>
      </label>
      <label class="mini">
        <span>سعر الوحدة *</span>
        <input class="input input--sm" type="number" min="0" step="any" [value]="price() ?? ''" (input)="price.set(+$any($event.target).value || null)" />
      </label>
      <label class="mini">
        <span>مدة التوريد (يوم)</span>
        <input class="input input--sm" type="number" min="0" [value]="lead() ?? ''" (input)="lead.set(+$any($event.target).value || null)" />
      </label>
      <label class="mini">
        <span>الشحن / مصاريف إضافية</span>
        <input class="input input--sm" type="number" min="0" step="any" [value]="shipping() ?? ''" (input)="shipping.set(+$any($event.target).value || null)" />
      </label>
      <label class="mini">
        <span>ورد عبر</span>
        <select class="select input--sm" (change)="channel.set($any($event.target).value)">
          @for (ch of channels; track ch) {
            <option [value]="ch" [selected]="ch === channel()">{{ channelLabels[ch] }}</option>
          }
        </select>
      </label>
      <label class="mini">
        <span>تاريخ الاستلام</span>
        <input class="input input--sm" type="date" [value]="receivedAt()" (change)="receivedAt.set($any($event.target).value)" />
      </label>
      <label class="mini">
        <span>صالح حتى</span>
        <input class="input input--sm" type="date" [value]="validUntil()" (change)="validUntil.set($any($event.target).value)" />
      </label>
      <label class="mini span-2">
        <span>شروط الدفع</span>
        <input class="input input--sm" [value]="terms()" (input)="terms.set($any($event.target).value)" />
      </label>
      <label class="mini">
        <span>الضمان</span>
        <input class="input input--sm" [value]="warranty()" (input)="warranty.set($any($event.target).value)" />
      </label>
      <label class="mini span-3">
        <span>ملاحظات</span>
        <input class="input input--sm" [value]="note()" (input)="note.set($any($event.target).value)" />
      </label>
      <button type="button" class="btn btn--primary btn--sm" [disabled]="!supplierId() || !price()" (click)="add()">
        <app-icon name="plus" [size]="15" /> إضافة العرض
      </button>
    </div>
  `,
  styles: `
    .pending {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin-bottom: 12px;
      font-size: 12.5px;
      color: var(--text-muted);
    }
    .quotes {
      display: grid;
      gap: 10px;
    }
    .quote {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      padding: 12px 14px;
      &--selected {
        border-color: var(--success);
        background: var(--success-soft);
      }
      &__head {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      &__who {
        display: flex;
        flex-direction: column;
        small {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11.5px;
          color: var(--text-subtle);
        }
      }
      &__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
        gap: 8px 16px;
        margin: 12px 0 0;
        dt {
          font-size: 11px;
          color: var(--text-subtle);
        }
        dd {
          margin: 2px 0 0;
          font-weight: 600;
          font-size: 13px;
        }
        .total dd {
          color: var(--primary);
        }
      }
      &__note {
        display: flex;
        gap: 6px;
        align-items: center;
        margin: 10px 0 0;
        font-size: 12.5px;
        color: var(--text-muted);
      }
    }
    .rank {
      display: grid;
      place-items: center;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      font-size: 12px;
      font-weight: 700;
      background: var(--surface-sunken);
    }
    .tags {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-inline-start: auto;
    }
    .add-title {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 18px 0 8px;
      font-size: 13px;
    }
    .add {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      align-items: end;
    }
    .mini {
      display: flex;
      flex-direction: column;
      gap: 3px;
      span {
        font-size: 11px;
        color: var(--text-subtle);
      }
    }
    .span-2 {
      grid-column: span 2;
    }
    .span-3 {
      grid-column: span 3;
    }
    @media (max-width: 820px) {
      .add {
        grid-template-columns: 1fr 1fr;
      }
      .span-3 {
        grid-column: 1 / -1;
      }
    }
  `,
})
export class QuotesPanel {
  protected readonly purchases = inject(PurchaseStore);
  protected readonly suppliers = inject(SupplierStore);
  private readonly toast = inject(ToastService);

  readonly request = input.required<PurchaseRequest>();

  private readonly today = todayIso();
  protected readonly channels = Object.keys(CONTACT_CHANNEL_LABELS) as ContactChannel[];
  protected readonly channelLabels = CONTACT_CHANNEL_LABELS;
  protected readonly channelIcons = CONTACT_CHANNEL_ICONS;

  protected readonly supplierId = signal('');
  protected readonly price = signal<number | null>(null);
  protected readonly lead = signal<number | null>(null);
  protected readonly shipping = signal<number | null>(null);
  protected readonly channel = signal<ContactChannel>('email');
  protected readonly receivedAt = signal(this.today);
  protected readonly validUntil = signal('');
  protected readonly terms = signal('');
  protected readonly warranty = signal('');
  protected readonly note = signal('');

  protected readonly available = computed(() => {
    const used = new Set(this.request().quotes.map((q) => q.supplierId));
    return this.suppliers.sorted().filter((s) => !used.has(s.id));
  });

  /** Suppliers contacted during the RFQ stage that have not sent a quotation yet. */
  protected readonly pending = computed(() => {
    const quoted = new Set(this.request().quotes.map((q) => q.supplierId));
    return this.request().contacts.filter((c) => !quoted.has(c.supplierId));
  });

  protected readonly rows = computed<QuoteRow[]>(() => {
    const request = this.request();
    const quotes = request.quotes;
    const totals = new Map(quotes.map((q) => [q.id, quoteTotal(q, request.quantity)]));
    const minTotal = Math.min(...totals.values());
    const minLead = Math.min(...quotes.map((q) => q.leadTimeDays));
    return [...quotes]
      .sort((a, b) => totals.get(a.id)! - totals.get(b.id)!)
      .map((quote) => ({
        quote,
        supplier: this.suppliers.find(quote.supplierId)?.name ?? '—',
        total: totals.get(quote.id)!,
        cheapest: quotes.length > 1 && totals.get(quote.id) === minTotal,
        fastest: quotes.length > 1 && quote.leadTimeDays === minLead,
        expired: !!quote.validUntil && quote.validUntil < this.today,
      }));
  });

  protected add(): void {
    const result = this.purchases.addQuote(this.request().id, {
      supplierId: this.supplierId(),
      unitPrice: this.price() ?? 0,
      leadTimeDays: this.lead() ?? 0,
      shippingCost: this.shipping() ?? 0,
      channel: this.channel(),
      receivedAt: this.receivedAt() || null,
      validUntil: this.validUntil() || null,
      paymentTerms: this.terms().trim(),
      warranty: this.warranty().trim(),
      note: this.note().trim(),
    });
    if (!result.allowed) {
      this.toast.warning('لم يُضف العرض', result.reason);
      return;
    }
    this.supplierId.set('');
    this.price.set(null);
    this.lead.set(null);
    this.shipping.set(null);
    this.validUntil.set('');
    this.terms.set('');
    this.warranty.set('');
    this.note.set('');
  }

  protected remove(quoteId: EntityId): void {
    this.purchases.removeQuote(this.request().id, quoteId);
  }
}
