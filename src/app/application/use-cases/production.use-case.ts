import { inject, Injectable } from '@angular/core';
import { EntityId } from '@domain/models';
import { todayIso } from '@domain/rules';
import { ProjectInsightsQuery } from '../queries/project-insights.query';
import { InventoryStore } from '../state/inventory.store';
import { RoutingStore } from '../state/routing.store';

@Injectable({ providedIn: 'root' })
export class ProductionUseCase {
  private readonly routing = inject(RoutingStore);
  private readonly inventory = inject(InventoryStore);
  private readonly insights = inject(ProjectInsightsQuery);

  /**
   * Marks an operation as executed. Completion date drives the on-time flag and
   * consumables are deducted from the warehouse once per operation.
   */
  setCompleted(operationId: EntityId, completed: boolean): void {
    const op = this.routing.find(operationId);
    if (!op) return;
    const today = todayIso();

    if (!completed) {
      this.routing.update(operationId, { completed: false, actualFinish: null });
      return;
    }

    const actualFinish = op.actualFinish ?? today;
    this.routing.update(operationId, {
      completed: true,
      progressPercent: 100,
      actualFinish,
      onTime: actualFinish <= op.latestFinish,
    });

    if (!op.consumablesPosted && op.consumables.length) {
      const lotSize = this.insights.lotSize(op.nodeId);
      for (const usage of op.consumables) {
        this.inventory.move(usage.materialId, 'consumption', usage.quantity * lotSize, `عملية ${op.sequence} - ${op.name}`);
      }
      this.routing.update(operationId, { consumablesPosted: true });
    }
  }

  /** QC rejection sends the work back to the selected sequence. */
  rejectQuality(operationId: EntityId, reworkSequence: number, note: string): void {
    const op = this.routing.find(operationId);
    if (!op) return;
    this.routing.update(operationId, { qcStatus: 'rejected', qcNote: note, reworkSequence, completed: false });
    for (const other of this.routing.forNode(op.nodeId)) {
      if (other.sequence >= reworkSequence && other.id !== operationId) {
        this.routing.update(other.id, { completed: false, progressPercent: Math.min(other.progressPercent, 50) });
      }
    }
  }
}
