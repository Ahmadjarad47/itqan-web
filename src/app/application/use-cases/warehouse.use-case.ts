import { inject, Injectable } from '@angular/core';
import { EntityId, IsoDate, RequisitionStatus, StockLocation } from '@domain/models';
import { adjustLocations, canIssueOn, canWithdraw, deductAnywhere, Guard, isStageDone, todayIso } from '@domain/rules';
import { AuthorizationService } from '../auth/authorization.service';
import { IssueInput, InventoryStore, ReceiptInput, TransferInput } from '../state/inventory.store';
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

const NOT_ALLOWED: Guard = { allowed: false, reason: 'لا تملك صلاحية صرف المخزون' };

/** Warehouse flows that span several stores. */
@Injectable({ providedIn: 'root' })
export class WarehouseUseCase {
  private readonly inventory = inject(InventoryStore);
  private readonly purchases = inject(PurchaseStore);
  private readonly requisitions = inject(RequisitionStore);
  private readonly auth = inject(AuthorizationService);

  /** Supply requests that passed quality control and wait to be received (screen 3 → screen 4). */
  awaitingReceipt() {
    return this.purchases
      .sorted()
      .filter(
        (r) =>
          r.qualityResult === 'passed' &&
          isStageDone(r, 'qualityControl') &&
          !isStageDone(r, 'warehouseReceipt') &&
          !this.inventory.hasReceiptFor(r.id),
      );
  }

  /**
   * Records an incoming quantity. When it comes from a supply request, that request's
   * final stage («الاستلام في المستودع») is closed at the same time.
   */
  receive(input: ReceiptInput): Guard {
    if (input.purchaseId) {
      const guard = this.canReceiveFor(input.purchaseId, input.materialId);
      if (!guard.allowed) return guard;
    }
    this.inventory.receive(input);
    const request = this.purchases.find(input.purchaseId);
    // A project purchase received here is linked to the chosen card.
    if (request && !request.materialId) this.purchases.update(request.id, { materialId: input.materialId });
    if (request && !isStageDone(request, 'warehouseReceipt')) {
      this.purchases.updateStage(request.id, 'warehouseReceipt', { done: true, date: input.date });
    }
    return { allowed: true };
  }

  /** A supply request is received once, for its own item, and only after passing quality control. */
  private canReceiveFor(purchaseId: EntityId, materialId: EntityId): Guard {
    const request = this.purchases.find(purchaseId);
    if (!request) return { allowed: false, reason: 'طلب التوريد غير موجود' };
    if (this.inventory.hasReceiptFor(purchaseId) || isStageDone(request, 'warehouseReceipt')) {
      return { allowed: false, reason: 'استُلم طلب التوريد هذا من قبل' };
    }
    if (request.qualityResult !== 'passed' || !isStageDone(request, 'qualityControl')) {
      return { allowed: false, reason: 'لا يُستلم إلا طلب اجتاز فحص الجودة' };
    }
    if (request.materialId !== materialId && this.inventory.find(request.materialId)) {
      return { allowed: false, reason: 'العنصر المختار لا يطابق عنصر طلب التوريد' };
    }
    return { allowed: true };
  }

  setRequisitionStatus(requisitionId: EntityId, status: RequisitionStatus): Guard {
    if (!this.auth.can('inventory.manage')) return NOT_ALLOWED;
    this.requisitions.setStatus(requisitionId, status);
    return { allowed: true };
  }

  transfer(input: TransferInput): Guard {
    return this.auth.can('inventory.manage') ? this.inventory.transfer(input) : NOT_ALLOWED;
  }

  /** Removes damaged or lost stock (شطب). */
  writeOff(input: IssueInput): Guard {
    if (!this.auth.can('inventory.manage')) return NOT_ALLOWED;
    const guard = this.inventory.canIssue(input.materialId, input.warehouseId, input.shelfId, input.quantity, input.date);
    if (guard.allowed) this.inventory.issue(input);
    return guard;
  }

  /** Issues the prepared lines of a requisition and closes it. */
  issueRequisition(requisitionId: EntityId, lines: readonly RequisitionIssueLine[], date: IsoDate = todayIso()): Guard {
    if (!this.auth.can('inventory.manage')) return NOT_ALLOWED;
    const requisition = this.requisitions.find(requisitionId);
    if (!requisition) return { allowed: false, reason: 'طلب الاحتياج غير موجود' };
    const issued = lines.filter((line) => line.quantity > 0);
    const guard = this.checkStock(issued, date);
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
  private checkStock(lines: readonly RequisitionIssueLine[], date: IsoDate): Guard {
    const claimed = new Map<EntityId, number>();
    const remaining = new Map<EntityId, readonly StockLocation[]>();
    for (const line of lines) {
      const locations = remaining.get(line.materialId) ?? this.inventory.find(line.materialId)?.locations ?? [];
      const guard = canWithdraw(locations, line.warehouseId, line.shelfId, line.quantity);
      if (!guard.allowed) return guard;
      const total = (claimed.get(line.materialId) ?? 0) + line.quantity;
      const onDate = canIssueOn(this.inventory.movementsByMaterial().get(line.materialId) ?? [], date, total);
      if (!onDate.allowed) return onDate;
      claimed.set(line.materialId, total);
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
