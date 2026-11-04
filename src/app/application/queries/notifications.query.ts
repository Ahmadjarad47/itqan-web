import { computed, inject, Injectable } from '@angular/core';
import { etaDelayDays, isStageDone, todayIso } from '@domain/rules';
import { BomStore } from '../state/bom.store';
import { InventoryStore } from '../state/inventory.store';
import { PurchaseStore } from '../state/purchase.store';
import { RoutingStore } from '../state/routing.store';
import { SessionStore } from '../state/session.store';
import { TaskStore } from '../state/task.store';

export interface AppNotification {
  readonly id: string;
  readonly icon: string;
  readonly tone: 'info' | 'warning' | 'danger' | 'success';
  readonly title: string;
  readonly text: string;
  readonly link: string;
}

/** Role-aware alerts derived from live state (no backend push required). */
@Injectable({ providedIn: 'root' })
export class NotificationsQuery {
  private readonly session = inject(SessionStore);
  private readonly tasks = inject(TaskStore);
  private readonly purchases = inject(PurchaseStore);
  private readonly routing = inject(RoutingStore);
  private readonly inventory = inject(InventoryStore);
  private readonly bom = inject(BomStore);

  readonly items = computed<AppNotification[]>(() => {
    const today = todayIso();

    if (!this.session.isManager()) {
      return this.tasks
        .forAssignee(this.session.userId())
        .filter((task) => task.status === 'sent' && !task.seenByAssignee)
        .map((task) => ({
          id: `task-${task.id}`,
          icon: 'clipboard',
          tone: 'info',
          title: `مهمة جديدة ${task.number}`,
          text: `${this.routing.find(task.operationId)?.name ?? ''} — ${this.bom.find(task.nodeId)?.name ?? ''}`,
          link: '/tasks/mine',
        }));
    }

    const rejected: AppNotification[] = this.tasks
      .active()
      .filter((task) => task.status === 'rejected')
      .map((task) => ({
        id: `rej-${task.id}`,
        icon: 'undo',
        tone: 'warning',
        title: `مهمة مُعادة ${task.number}`,
        text: task.rejectNote || 'أعاد الموظف المهمة للمراجعة',
        link: '/tasks/manage',
      }));

    const delayedPurchases: AppNotification[] = this.purchases
      .all()
      .filter((request) => etaDelayDays(request, today) > 0 && !isStageDone(request, 'delivered'))
      .map((request) => ({
        id: `eta-${request.id}`,
        icon: 'truck',
        tone: 'danger',
        title: `تأخر توريد ${request.number}`,
        text: `${request.title} — متأخر ${etaDelayDays(request, today)} يوم`,
        link: `/procurement/requests/${request.id}`,
      }));

    const qcFailed: AppNotification[] = this.purchases
      .all()
      .filter((request) => request.qualityResult === 'failed' && !isStageDone(request, 'warehouseReceipt'))
      .map((request) => ({
        id: `qc-${request.id}`,
        icon: 'shield',
        tone: 'danger',
        title: `رفض جودة ${request.number}`,
        text: request.correctiveAction || request.title,
        link: `/procurement/requests/${request.id}`,
      }));

    const lateOps: AppNotification[] = this.routing
      .all()
      .filter((op) => !op.completed && op.latestFinish < today)
      .map((op) => ({
        id: `op-${op.id}`,
        icon: 'clock',
        tone: 'warning',
        title: `عملية متأخرة: ${op.name}`,
        text: this.bom.find(op.nodeId)?.name ?? '',
        link: `/production/routing/${op.nodeId}`,
      }));

    const lowStock: AppNotification[] = this.inventory.lowStock().map((material) => ({
      id: `stock-${material.id}`,
      icon: 'warehouse',
      tone: 'warning',
      title: 'مخزون تحت الحد الأدنى',
      text: material.name,
      link: '/inventory',
    }));

    return [...rejected, ...qcFailed, ...delayedPurchases, ...lateOps, ...lowStock];
  });
}
