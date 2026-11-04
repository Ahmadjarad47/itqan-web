import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TASK_STATUS_LABELS, TaskStatus } from '@domain/models';

@Component({
  selector: 'app-task-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="badge badge--dot"
      [class.badge--info]="status() === 'sent'"
      [class.badge--accent]="status() === 'accepted'"
      [class.badge--primary]="status() === 'active'"
      [class.badge--success]="status() === 'completed'"
      [class.badge--danger]="status() === 'rejected'"
    >{{ labels[status()] }}</span>
  `,
})
export class TaskStatusBadge {
  readonly status = input.required<TaskStatus>();
  protected readonly labels = TASK_STATUS_LABELS;
}
