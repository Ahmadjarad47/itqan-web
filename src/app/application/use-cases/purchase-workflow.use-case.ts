import { inject, Injectable } from '@angular/core';
import { EntityId, PurchaseStageKey, QualityResult } from '@domain/models';
import { canToggleStage, findStage, Guard, todayIso } from '@domain/rules';
import { BomStore } from '../state/bom.store';
import { InventoryStore } from '../state/inventory.store';
import { PurchaseStore } from '../state/purchase.store';

@Injectable({ providedIn: 'root' })
export class PurchaseWorkflowUseCase {
  private readonly purchases = inject(PurchaseStore);
  private readonly inventory = inject(InventoryStore);
  private readonly bom = inject(BomStore);

  /** Advances or reopens a stage of the status machine, applying its side effects. */
  toggleStage(requestId: EntityId, key: PurchaseStageKey): Guard {
    const request = this.purchases.find(requestId);
    if (!request) return { allowed: false };
    const guard = canToggleStage(request, key);
    if (!guard.allowed) return guard;

    const stage = findStage(request, key)!;
    const done = !stage.done;
    this.purchases.updateStage(requestId, key, { done, date: done ? (stage.date ?? todayIso()) : stage.date });

    if (key === 'warehouseReceipt' && done) {
      this.receiveIntoWarehouse(requestId);
    }
    return guard;
  }

  /** Approves a quote as the MCDM winner: sets supplier and price. */
  selectQuote(requestId: EntityId, quoteId: EntityId): void {
    const quote = this.purchases.find(requestId)?.quotes.find((q) => q.id === quoteId);
    if (!quote) return;
    this.purchases.update(requestId, { supplierId: quote.supplierId, unitPrice: quote.unitPrice });
  }

  recordQuality(requestId: EntityId, result: QualityResult | null): void {
    this.purchases.update(requestId, {
      qualityResult: result,
      correctiveAction: result === 'failed' ? (this.purchases.find(requestId)?.correctiveAction ?? '') : '',
    });
  }

  /** Receiving a quality-approved part opens (or increases) its inventory record. */
  private receiveIntoWarehouse(requestId: EntityId): void {
    const request = this.purchases.find(requestId)!;
    const node = this.bom.find(request.nodeId);
    const code = node?.code ?? request.number;
    const material =
      this.inventory.all().find((m) => m.kind === 'purchased' && m.code === code) ??
      this.inventory.create({
        code,
        name: request.title,
        kind: 'purchased',
        unit: request.unit,
        unitCost: request.unitPrice ?? 0,
        stock: 0,
        minStock: 0,
        warehouse: 'مستودع الأجزاء المشتراة',
      });
    this.inventory.move(material.id, 'receipt', request.quantity, request.number);

    if (node && request.unitPrice !== null) {
      this.bom.update(node.id, { purchaseUnitPrice: request.unitPrice });
    }
  }
}
