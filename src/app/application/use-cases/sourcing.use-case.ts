import { inject, Injectable } from '@angular/core';
import { EntityId, PurchaseRequest, SourcingDecision } from '@domain/models';
import { ProjectInsightsQuery } from '../queries/project-insights.query';
import { BomStore } from '../state/bom.store';
import { PurchaseStore } from '../state/purchase.store';

export interface SourcingOutcome {
  readonly decision: SourcingDecision | null;
  readonly createdPurchase?: PurchaseRequest;
  readonly keptPurchase?: PurchaseRequest;
}

/**
 * Make-or-buy decision. BUY sends the part to the procurement pool automatically;
 * MAKE sends it to the production (routing) pool.
 */
@Injectable({ providedIn: 'root' })
export class SourcingUseCase {
  private readonly bom = inject(BomStore);
  private readonly purchases = inject(PurchaseStore);
  private readonly insights = inject(ProjectInsightsQuery);

  decide(nodeId: EntityId, decision: SourcingDecision | null): SourcingOutcome {
    const node = this.bom.find(nodeId);
    if (!node) return { decision: null };

    this.bom.update(nodeId, { decision });
    const existing = this.purchases.byNode().get(nodeId);

    if (decision === 'buy') {
      if (existing) return { decision, keptPurchase: existing };
      const createdPurchase = this.purchases.create({
        title: node.name,
        projectId: node.projectId,
        nodeId,
        quantity: this.insights.lotSize(nodeId),
        unit: node.unit,
        priority: 'normal',
      });
      return { decision, createdPurchase };
    }

    if (existing) {
      const started = existing.stages.some((stage) => stage.done);
      if (!started) {
        this.purchases.remove(existing.id);
        return { decision };
      }
      return { decision, keptPurchase: existing };
    }
    return { decision };
  }
}
