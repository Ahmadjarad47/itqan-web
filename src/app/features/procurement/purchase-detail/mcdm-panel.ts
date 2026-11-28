import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { PurchaseStore } from '@application/state/purchase.store';
import { SupplierStore } from '@application/state/supplier.store';
import { PurchaseWorkflowUseCase } from '@application/use-cases/purchase-workflow.use-case';
import { ToastService } from '@core/feedback/toast.service';
import { EntityId, PurchaseRequest } from '@domain/models';
import { evaluateMcdm, isMcdmWinner } from '@domain/rules';
import { MoneyPipe, NumPipe } from '@shared/pipes/format.pipes';
import { Icon } from '@shared/ui/icon/icon';

/** Multi-criteria decision matrix (weighted sum) for supplier selection. */
@Component({
  selector: 'app-mcdm-panel',
  imports: [Icon, NumPipe, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mcdm-panel.html',
  styleUrl: './mcdm-panel.scss',
})
export class McdmPanel {
  private readonly purchases = inject(PurchaseStore);
  private readonly workflow = inject(PurchaseWorkflowUseCase);
  private readonly toast = inject(ToastService);
  protected readonly suppliers = inject(SupplierStore);

  readonly request = input.required<PurchaseRequest>();

  protected readonly totalWeight = computed(() => this.request().mcdm.criteria.reduce((sum, c) => sum + c.weight, 0));
  protected readonly isWinner = isMcdmWinner;

  protected readonly results = computed(() => {
    const scores = evaluateMcdm(this.request().mcdm, this.request().quotes);
    return new Map(scores.map((s) => [s.quoteId, s]));
  });

  protected score(quoteId: EntityId, criterionId: EntityId): number {
    return this.request().mcdm.scores[quoteId]?.[criterionId] ?? 0;
  }

  protected setScore(quoteId: EntityId, criterionId: EntityId, value: number): void {
    this.purchases.setScore(this.request().id, quoteId, criterionId, value);
  }

  protected setWeight(criterionId: EntityId, weight: number): void {
    this.purchases.setCriteria(
      this.request().id,
      this.request().mcdm.criteria.map((c) => (c.id === criterionId ? { ...c, weight: Math.max(0, weight || 0) } : c)),
    );
  }

  protected approve(quoteId: EntityId): void {
    this.workflow.selectQuote(this.request().id, quoteId);
    const quote = this.request().quotes.find((q) => q.id === quoteId);
    this.toast.success('تم اعتماد المورد', this.suppliers.find(quote?.supplierId)?.name);
  }
}
