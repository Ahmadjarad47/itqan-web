import { inject, Injectable } from '@angular/core';
import { EntityId } from '@domain/models';
import { taskProgress } from '@domain/rules';
import { RoutingStore } from '../state/routing.store';
import { TaskStore } from '../state/task.store';
import { ProductionUseCase } from './production.use-case';

/** Employee task lifecycle, kept in sync with the routing operation it executes. */
@Injectable({ providedIn: 'root' })
export class TaskWorkflowUseCase {
  private readonly tasks = inject(TaskStore);
  private readonly routing = inject(RoutingStore);
  private readonly production = inject(ProductionUseCase);

  accept(taskId: EntityId): boolean {
    return this.tasks.transition(taskId, 'accepted');
  }

  start(taskId: EntityId): boolean {
    return this.tasks.transition(taskId, 'active');
  }

  logProgress(taskId: EntityId, completedQuantity: number, qualityOk: boolean, note: string): void {
    const task = this.tasks.addProgress(taskId, { completedQuantity, qualityOk, note });
    if (!task) return;
    const op = this.routing.find(task.operationId);
    if (op && !op.completed) {
      this.routing.update(op.id, {
        progressPercent: Math.max(op.progressPercent, Math.round(taskProgress(task))),
        qcStatus: qualityOk ? op.qcStatus : 'rejected',
        qcNote: qualityOk ? op.qcNote : note,
      });
    }
  }

  complete(taskId: EntityId): boolean {
    const task = this.tasks.find(taskId);
    if (!task || !this.tasks.transition(taskId, 'completed')) return false;
    if (task.operationId) this.production.setCompleted(task.operationId, true);
    return true;
  }
}
