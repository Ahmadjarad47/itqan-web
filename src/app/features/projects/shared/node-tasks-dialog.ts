import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthorizationService } from '@application/auth/authorization.service';
import { TaskViewQuery } from '@application/queries/task-view.query';
import { BomStore } from '@application/state/bom.store';
import { TaskStore } from '@application/state/task.store';
import { EntityId } from '@domain/models';
import { ArDatePipe } from '@shared/pipes/format.pipes';
import { Avatar } from '@shared/ui/avatar/avatar';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';
import { ProgressBar } from '@shared/ui/progress/progress';
import { TaskStatusBadge } from '../../tasks/shared/task-status-badge';

/** Tasks assigned on a product-tree item and on the components below it. */
@Component({
  selector: 'app-node-tasks-dialog',
  imports: [RouterLink, Modal, Icon, Avatar, EmptyState, ProgressBar, TaskStatusBadge, ArDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [(open)]="open" title="المهام الموكلة داخل العنصر" [subtitle]="subtitle()" width="640px">
      <div class="list">
        @for (v of views(); track v.task.id) {
          <article class="task">
            <div class="row">
              <span class="code">{{ v.task.number }}</span>
              <strong class="title">{{ v.title }}</strong>
              <span class="spacer"></span>
              <app-task-status-badge [status]="v.task.status" />
            </div>
            <div class="meta">
              @if (v.node && v.node.id !== nodeId()) {
                <span class="subtle"><app-icon name="layers" [size]="12" /> {{ v.node.code }} — {{ v.node.name }}</span>
              }
              <span class="who">
                @if (v.assignee) {
                  <app-avatar [name]="v.assignee.name" [size]="22" />
                }
                {{ v.assignee?.name ?? '—' }}
              </span>
              <span class="num subtle">{{ v.task.start | arDate: 'short' }} ← {{ v.task.end | arDate: 'short' }}</span>
              @if (v.overdue) {
                <span class="badge badge--danger">متأخرة</span>
              }
            </div>
            <app-progress-bar [value]="v.progress" [height]="5" />
          </article>
        } @empty {
          <app-empty-state icon="clipboard" title="لا توجد مهام موكلة" text="لم تُسند أي مهمة على هذا العنصر أو مكوناته الفرعية بعد." />
        }
      </div>
      <ng-container modal-actions>
        @if (canManage()) {
          <a class="btn" routerLink="/tasks/manage" (click)="open.set(false)"><app-icon name="clipboard" [size]="16" /> إدارة المهام</a>
        }
        <button type="button" class="btn btn--primary" (click)="open.set(false)">إغلاق</button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .task {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 14px;
      font-size: 12.5px;
    }
    .who {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
  `,
})
export class NodeTasksDialog {
  private readonly bom = inject(BomStore);
  private readonly tasks = inject(TaskStore);
  private readonly viewsQuery = inject(TaskViewQuery);
  private readonly auth = inject(AuthorizationService);

  readonly open = model(false);
  readonly nodeId = input<EntityId | null>(null);

  protected readonly canManage = computed(() => this.auth.can('tasks.manage'));
  protected readonly node = computed(() => this.bom.find(this.nodeId()));
  protected readonly subtitle = computed(() => {
    const node = this.node();
    return node ? `${node.code} — ${node.name} (مع المكونات الفرعية)` : '';
  });

  protected readonly views = computed(() => {
    const id = this.nodeId();
    if (!id) return [];
    const ids = new Set([id, ...this.bom.tree().descendants(id).map((n) => n.id)]);
    return this.tasks
      .active()
      .filter((t) => t.nodeId && ids.has(t.nodeId))
      .map((t) => this.viewsQuery.view(t));
  });
}
