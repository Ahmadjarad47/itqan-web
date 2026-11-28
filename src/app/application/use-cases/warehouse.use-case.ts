import { inject, Injectable } from '@angular/core';
import { EntityId, IsoDate, StockLocation } from '@domain/models';
import { adjustLocations, canWithdraw, deductAnywhere, Guard, isStageDone, todayIso } from '@domain/rules';
import { IssueInput, InventoryStore, ReceiptInput } from '../state/inventory.store';
import { PurchaseStore } from '../state/purchase.store';
import { RequisitionStore } from '../state/warehouse.store';

export interface RequisitionIssueLine {
  readonly lineId: EntityId;
  readonly materialId: EntityId;
  readonly warehouseId: EntityId | null;
  readonly shelfId: EntityId | null;
  readonly quantity: number;
  readonly sellPrice: number | null;
}

/** Warehouse flows that span several stores. */
@Injectable({ providedIn: 'root' })
export class WarehouseUseCase {
  private readonly inventory = inject(InventoryStore);
  private readonly purchases = inject(PurchaseStore);
  private readonly requisitions = inject(RequisitionStore);

  /** Supply requests that passed quality control and wait to be received (screen 3 → screen 4). */
  awaitingReceipt() {
    return this.purchases
      .sorted()
      .filter((r) => r.qualityResult === 'passed' && isStageDone(r, 'qualityControl') && !isStageDone(r, 'warehouseReceipt'));
  }

  /**
   * Records an incoming quantity. When it comes from a supply request, that request's
   * final stage («الاستلام في المستودع») is closed at the same time.
   */
  receive(input: ReceiptInput): void {
    this.inventory.receive(input);
    const request = this.purchases.find(input.purchaseId);
    if (request && !isStageDone(request, 'warehouseReceipt')) {
      this.purchases.updateStage(request.id, 'warehouseReceipt', { done: true, date: input.date });
    }
  }

  /** Issues the prepared lines of a requisition and closes it. */
  issueRequisition(requisitionId: EntityId, lines: readonly RequisitionIssueLine[], date: IsoDate = todayIso()): Guard {
    const requisition = this.requisitions.find(requisitionId);
    if (!requisition) return { allowed: false, reason: 'طلب الاحتياج غير موجود' };
    const issued = lines.filter((line) => line.quantity > 0);
    const guard = this.checkStock(issued);
    if (!guard.allowed) return guard;
    issued.forEach((line) => {
        const input: IssueInput = {
          materialId: line.materialId,
          type: 'issue',
          warehouseId: line.warehouseId,
          shelfId: line.shelfId,
          quantity: line.quantity,
          date,
          reference: `طلب احتياج ${requisition.number}`,
          documentNo: requisition.number,
          sellPrice: line.sellPrice,
          requisitionId,
        };
      this.inventory.issue(input);
    });
    this.requisitions.setStatus(requisitionId, 'delivered');
    return guard;
  }

  /** Checks the lines together, so two lines cannot both claim the same stock. */
  private checkStock(lines: readonly RequisitionIssueLine[]): Guard {
    const remaining = new Map<EntityId, readonly StockLocation[]>();
    for (const line of lines) {
      const locations = remaining.get(line.materialId) ?? this.inventory.find(line.materialId)?.locations ?? [];
      const guard = canWithdraw(locations, line.warehouseId, line.shelfId, line.quantity);
      if (!guard.allowed) return guard;
      remaining.set(
        line.materialId,
        line.warehouseId
          ? adjustLocations(locations, line.warehouseId, line.shelfId, -line.quantity)
          : deductAnywhere(locations, line.quantity),
      );
    }
    return { allowed: true };
  }
}
