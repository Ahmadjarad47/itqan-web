import { computed, inject, Injectable } from '@angular/core';
import { AuthorizationService } from '../auth/authorization.service';
import { etaDelayDays, isStageDone, todayIso, unreadMessages } from '@domain/rules';
import { TaskViewQuery } from './task-view.query';
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
  private readonly auth = inject(AuthorizationService);
  private readonly tasks = inject(TaskStore);
  private readonly purchases = inject(PurchaseStore);
  private readonly routing = inject(RoutingStore);
  private readonly inventory = inject(InventoryStore);
  private readonly bom = inject(BomStore);
  private readonly taskViews = inject(TaskViewQuery);

  readonly items = computed<AppNotification[]>(() => {
    const today = todayIso();

    const own: AppNotification[] = !this.auth.can('tasks.own')
      ? []
      : this.tasks
        .forAssignee(this.session.userId())
        .filter((task) => task.status === 'sent' && !task.seenByAssignee)
        .map((task) => ({
          id: `task-${task.id}`,
          icon: 'clipboard',
          tone: 'info',
          title: `مهمة جديدة ${task.number}`,
          text: `${this.taskViews.view(task).title} — ${this.taskViews.view(task).context}`,
          link: '/tasks/mine',
        }));

    // Unread chat messages, for the assignee and for the manager who follows the task.
    const userId = this.session.userId();
    const chats: AppNotification[] = this.tasks
      .active()
      .filter((task) => task.assigneeId === userId || task.createdById === userId)
      .map((task) => ({ task, unread: unreadMessages(task, userId) }))
      .filter(({ unread }) => unread > 0)
      .map(({ task, unread }) => ({
        id: `chat-${task.id}`,
        icon: 'message',
        tone: 'info',
        title: `${unread} رسائل جديدة — ${task.number}`,
        text: task.messages.at(-1)?.text ?? '',
        link: task.assigneeId === userId ? '/tasks/mine' : '/tasks/manage',
      }));

    const rejected: AppNotification[] = !this.auth.can('tasks.manage')
      ? []
      : this.tasks
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

    const canBuy = this.auth.can('procurement.view');
    const delayedPurchases: AppNotification[] = !canBuy
      ? []
      : this.purchases
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

    const qcFailed: AppNotification[] = !canBuy
      ? []
      : this.purchases
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

    const lateOps: AppNotification[] = !this.auth.can('production.view')
      ? []
      : this.routing
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

    const lowStock: AppNotification[] = !this.auth.can('inventory.view')
      ? []
      : this.inventory.lowStock().map((material) => ({
      id: `stock-${material.id}`,
      icon: 'warehouse',
      tone: 'warning',
      title: 'مخزون تحت الحد الأدنى',
      text: material.name,
      link: `/warehouse/items/${material.id}`,
    }));

    return [...own, ...chats, ...rejected, ...qcFailed, ...delayedPurchases, ...lateOps, ...lowStock];
  });
}
