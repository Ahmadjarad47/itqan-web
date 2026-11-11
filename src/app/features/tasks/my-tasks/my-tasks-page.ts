import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TaskView, TaskViewQuery } from '@application/queries/task-view.query';
import { EmployeeStore } from '@application/state/organization.store';
import { SessionStore } from '@application/state/session.store';
import { TaskStore } from '@application/state/task.store';
import { TaskWorkflowUseCase } from '@application/use-cases/task-workflow.use-case';
import { ToastService } from '@core/feedback/toast.service';
import { EntityId, REJECT_REASON_LABELS, RejectReason, TaskStatus, WorkTask } from '@domain/models';
import { unreadMessages } from '@domain/rules';
import { TaskChat } from '../shared/task-chat';
import { ArDatePipe, NumPipe, RelativeDaysPipe } from '@shared/pipes/format.pipes';
import { Avatar } from '@shared/ui/avatar/avatar';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { ProgressBar } from '@shared/ui/progress/progress';

interface Column {
  readonly status: TaskStatus;
  readonly title: string;
  readonly icon: string;
}

const COLUMNS: readonly Column[] = [
  { status: 'sent', title: 'بانتظار المراجعة والقبول', icon: 'inbox' },
  { status: 'accepted', title: 'مقبولة — جاهزة للبدء', icon: 'check-circle' },
  { status: 'active', title: 'نشطة — قيد التنفيذ', icon: 'play' },
  { status: 'completed', title: 'مكتملة', icon: 'archive' },
];

@Component({
  selector: 'app-my-tasks-page',
  imports: [PageHeader, Icon, Avatar, Modal, EmptyState, ProgressBar, TaskChat, ArDatePipe, NumPipe, RelativeDaysPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './my-tasks-page.html',
  styleUrl: './my-tasks-page.scss',
})
export class MyTasksPage {
  private readonly tasks = inject(TaskStore);
  private readonly views = inject(TaskViewQuery);
  private readonly workflow = inject(TaskWorkflowUseCase);
  private readonly toast = inject(ToastService);
  protected readonly session = inject(SessionStore);
  protected readonly employees = inject(EmployeeStore);

  protected readonly columns = COLUMNS;
  protected readonly rejectReasons = Object.keys(REJECT_REASON_LABELS) as RejectReason[];
  protected readonly rejectLabels = REJECT_REASON_LABELS;

  protected readonly rejectingId = signal<EntityId | null>(null);
  protected readonly rejectOpen = signal(false);
  protected readonly rejectReason = signal<RejectReason>('time');
  protected readonly rejectNote = signal('');

  protected readonly progressId = signal<EntityId | null>(null);
  protected readonly progressOpen = signal(false);
  protected readonly progressQty = signal(1);
  protected readonly progressOk = signal(true);
  protected readonly progressNote = signal('');

  protected readonly mine = computed(() => this.tasks.forAssignee(this.session.userId()).map((t) => this.views.view(t)));
  protected readonly unseen = computed(() => this.mine().filter((v) => v.task.status === 'sent' && !v.task.seenByAssignee));
  protected readonly returned = computed(() => this.mine().filter((v) => v.task.status === 'rejected'));
  protected readonly byStatus = computed(() => {
    const map = new Map<TaskStatus, TaskView[]>();
    for (const view of this.mine()) {
      const list = map.get(view.task.status) ?? [];
      list.push(view);
      map.set(view.task.status, list);
    }
    return map;
  });
  protected readonly progressTask = computed(() => this.views.view(this.tasks.find(this.progressId())!));

  protected readonly chatId = signal<EntityId | null>(null);
  protected readonly chatOpen = signal(false);
  protected readonly chatView = computed(() => {
    const task = this.tasks.find(this.chatId());
    return task ? this.views.view(task) : undefined;
  });

  protected openChat(id: EntityId): void {
    this.markSeen(id);
    this.chatId.set(id);
    this.chatOpen.set(true);
  }

  protected unread(task: WorkTask): number {
    return unreadMessages(task, this.session.userId());
  }

  protected markSeen(id: EntityId): void {
    this.tasks.markSeen(id);
  }

  protected accept(id: EntityId): void {
    this.markSeen(id);
    if (this.workflow.accept(id)) this.toast.success('تم قبول المهمة');
  }

  protected openReject(id: EntityId): void {
    this.markSeen(id);
    this.rejectingId.set(id);
    this.rejectReason.set('time');
    this.rejectNote.set('');
    this.rejectOpen.set(true);
  }

  protected confirmReject(): void {
    const id = this.rejectingId();
    if (!id) return;
    this.tasks.reject(id, this.rejectReason(), this.rejectNote());
    this.rejectOpen.set(false);
    this.toast.info('أُعيدت المهمة إلى المدير', REJECT_REASON_LABELS[this.rejectReason()]);
  }

  protected start(id: EntityId): void {
    if (this.workflow.start(id)) this.toast.success('تم تحديث حالة المهمة إلى «نشط»');
  }

  protected openProgress(id: EntityId): void {
    this.progressId.set(id);
    this.progressQty.set(1);
    this.progressOk.set(true);
    this.progressNote.set('');
    this.progressOpen.set(true);
  }

  protected saveProgress(): void {
    const id = this.progressId();
    if (!id || this.progressQty() < 0) return;
    this.workflow.logProgress(id, this.progressQty(), this.progressOk(), this.progressNote());
    this.progressOpen.set(false);
    this.toast.success('تم تسجيل التقدم', 'انعكس تلقائياً على تقدم العملية والمكون');
  }

  protected complete(id: EntityId): void {
    if (this.workflow.complete(id)) this.toast.success('تم إنهاء المهمة', 'حالة المهمة: مكتمل');
  }
}
