import { inject, Injectable } from '@angular/core';
import { EntityId, PurchaseStageKey, QualityResult } from '@domain/models';
import { canToggleStage, findStage, Guard, todayIso } from '@domain/rules';
import { BomStore } from '../state/bom.store';
import { DEFAULT_PURCHASED_WAREHOUSE, InventoryStore } from '../state/inventory.store';
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
    // Reopening the stage does not reverse the stock, so closing it again must not add it twice.
    if (this.inventory.hasReceiptFor(requestId)) return;
    const request = this.purchases.find(requestId)!;
    // Supply requests of a product card are received into that card and its destination warehouse.
    const linked = this.inventory.find(request.materialId);
    if (linked) {
      const location = request.warehouseId
        ? { warehouseId: request.warehouseId, shelfId: linked.locations.find((l) => l.warehouseId === request.warehouseId)?.shelfId ?? null }
        : (linked.locations[0] ?? { warehouseId: DEFAULT_PURCHASED_WAREHOUSE, shelfId: null });
      this.inventory.receive({
        materialId: linked.id,
        ...location,
        quantity: request.quantity,
        unitCost: request.unitPrice ?? linked.unitCost,
        date: todayIso(),
        source: 'supply',
        documentNo: request.number,
        supplierId: request.supplierId,
        purchaseId: request.id,
      });
      return;
    }

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
        minStock: 0,
        maxStock: 0,
        categoryId: 'opt-cat-purchased',
        natureId: null,
        costMethod: 'average',
        margin: { type: 'percent', value: 0 },
        specFiles: [],
        notes: '',
        storage: [{ warehouseId: DEFAULT_PURCHASED_WAREHOUSE, shelfId: null }],
      });
    const location = material.locations[0] ?? { warehouseId: DEFAULT_PURCHASED_WAREHOUSE, shelfId: null };
    this.inventory.receive({
      materialId: material.id,
      warehouseId: location.warehouseId,
      shelfId: location.shelfId,
      quantity: request.quantity,
      unitCost: request.unitPrice ?? material.unitCost,
      date: todayIso(),
      source: 'supply',
      documentNo: request.number,
      supplierId: request.supplierId,
      purchaseId: request.id,
    });

    if (node && request.unitPrice !== null) {
      this.bom.update(node.id, { purchaseUnitPrice: request.unitPrice });
    }
  }
}
