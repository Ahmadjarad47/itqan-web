import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { SupplierStore } from '@application/state/supplier.store';
import { PurchaseWorkflowUseCase } from '@application/use-cases/purchase-workflow.use-case';
import { ToastService } from '@core/feedback/toast.service';
import { CONTACT_CHANNEL_LABELS, EntityId, PurchaseRequest } from '@domain/models';
import { quoteTotal, researchDays, todayIso } from '@domain/rules';
import { ArDatePipe, MoneyPipe, NumPipe } from '@shared/pipes/format.pipes';
import { Icon } from '@shared/ui/icon/icon';

/**
 * Lightweight alternative to the MCDM matrix: a printable report of the received
 * options from which the decision maker approves one supplier directly.
 */
@Component({
  selector: 'app-options-report',
  imports: [Icon, MoneyPipe, NumPipe, ArDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (request().quotes.length) {
      <div class="report">
        <header class="report__head">
          <div>
            <strong>تقرير الخيارات — {{ request().number }}</strong>
            <small>{{ request().title }} · الكمية {{ request().quantity | num }}</small>
          </div>
          <button type="button" class="btn btn--sm btn--ghost" (click)="print()"><app-icon name="download" [size]="14" /> طباعة / PDF</button>
        </header>

        <ul class="summary">
          <li><span>عدد الموردين الذين تم التواصل معهم</span><b class="num">{{ request().contacts.length }}</b></li>
          <li><span>عدد العروض المستلمة</span><b class="num">{{ request().quotes.length }}</b></li>
          @if (research() !== null) {
            <li><span>مدة البحث في السوق</span><b class="num">{{ research() }} يوم</b></li>
          }
          <li><span>فارق السعر بين أعلى وأدنى عرض</span><b class="num">{{ spread() | money }}</b></li>
        </ul>

        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>#</th>
                <th>المورد</th>
                <th>سعر الوحدة</th>
                <th>الإجمالي</th>
                <th>التوريد</th>
                <th>الدفع / الضمان</th>
                <th>المصدر</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.id; let i = $index) {
                <tr [class.selected]="row.supplierId === request().supplierId">
                  <td class="num">{{ i + 1 }}</td>
                  <td><strong>{{ row.name }}</strong></td>
                  <td class="num">{{ row.unitPrice | money }}</td>
                  <td class="num"><strong>{{ row.total | money }}</strong></td>
                  <td class="num">{{ row.lead | num }} يوم</td>
                  <td><small>{{ row.terms || '—' }} · {{ row.warranty || '—' }}</small></td>
                  <td><small>{{ row.channel }}{{ row.receivedAt ? ' · ' : '' }}{{ row.receivedAt | arDate: 'short' }}</small></td>
                  <td>
                    @if (row.supplierId === request().supplierId) {
                      <span class="badge badge--success"><app-icon name="check" [size]="12" /> المعتمد</span>
                    } @else {
                      <button type="button" class="btn btn--sm" (click)="approve(row.id)">اعتماد</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="foot subtle">العروض مرتبة حسب التكلفة الإجمالية (السعر × الكمية + الشحن).</p>
      </div>
    } @else {
      <p class="subtle">أدخل عروض الأسعار في مرحلة «تقديم الخيارات» لإصدار التقرير.</p>
    }
  `,
  styles: `
    .report__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 10px;
      div {
        display: flex;
        flex-direction: column;
      }
      small {
        color: var(--text-subtle);
      }
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 8px;
      list-style: none;
      margin: 0 0 12px;
      padding: 0;
      li {
        display: flex;
        flex-direction: column;
        padding: 8px 12px;
        border-radius: var(--radius-sm);
        background: var(--surface-sunken);
        span {
          font-size: 11.5px;
          color: var(--text-subtle);
        }
      }
    }
    tr.selected td {
      background: var(--success-soft);
    }
    .foot {
      margin-top: 8px;
      font-size: 12px;
    }
  `,
})
export class OptionsReport {
  private readonly workflow = inject(PurchaseWorkflowUseCase);
  private readonly toast = inject(ToastService);
  private readonly suppliers = inject(SupplierStore);

  readonly request = input.required<PurchaseRequest>();

  protected readonly research = computed(() => researchDays(this.request(), todayIso()));

  protected readonly rows = computed(() =>
    this.request()
      .quotes.map((q) => ({
        id: q.id,
        supplierId: q.supplierId,
        name: this.suppliers.find(q.supplierId)?.name ?? '—',
        unitPrice: q.unitPrice,
        total: quoteTotal(q, this.request().quantity),
        lead: q.leadTimeDays,
        terms: q.paymentTerms,
        warranty: q.warranty,
        channel: CONTACT_CHANNEL_LABELS[q.channel],
        receivedAt: q.receivedAt,
      }))
      .sort((a, b) => a.total - b.total),
  );

  protected readonly spread = computed(() => {
    const totals = this.rows().map((r) => r.total);
    return totals.length ? Math.max(...totals) - Math.min(...totals) : 0;
  });

  protected approve(quoteId: EntityId): void {
    this.workflow.selectQuote(this.request().id, quoteId);
    const quote = this.request().quotes.find((q) => q.id === quoteId);
    this.toast.success('تم اعتماد المورد', this.suppliers.find(quote?.supplierId)?.name);
  }

  protected print(): void {
    window.print();
  }
}
