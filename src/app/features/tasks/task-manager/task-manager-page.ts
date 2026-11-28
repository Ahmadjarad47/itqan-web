import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ProjectInsightsQuery } from '@application/queries/project-insights.query';
import { TaskViewQuery } from '@application/queries/task-view.query';
import { BomStore } from '@application/state/bom.store';
import { DepartmentStore, EmployeeStore } from '@application/state/organization.store';
import { ProjectStore } from '@application/state/project.store';
import { RoutingStore, WorkstationStore } from '@application/state/routing.store';
import { TaskStore } from '@application/state/task.store';
import { ToastService } from '@core/feedback/toast.service';
import { PurchaseStore } from '@application/state/purchase.store';
import { SessionStore } from '@application/state/session.store';
import {
  EntityId,
  PurchaseStageKey,
  REJECT_REASON_LABELS,
  TASK_STATUS_LABELS,
  TaskKind,
  TaskStatus,
  WorkTask,
} from '@domain/models';
import { isTaskOpen, PURCHASE_STAGES, todayIso, unreadMessages } from '@domain/rules';
import { TaskChat } from '../shared/task-chat';

type TaskScope = 'project' | 'standalone';
const PROCUREMENT_DEPARTMENT = 'd-procurement';
import { ArDatePipe, NumPipe } from '@shared/pipes/format.pipes';
import { Avatar } from '@shared/ui/avatar/avatar';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { ProgressBar } from '@shared/ui/progress/progress';
import { StatCard } from '@shared/ui/stat-card/stat-card';
import { TaskStatusBadge } from '../shared/task-status-badge';

import { FormDraft } from '@shared/ui/form-draft/form-draft';

type Filter = 'all' | TaskStatus | 'archived';

@Component({
  selector: 'app-task-manager-page',
  imports: [ReactiveFormsModule, FormDraft, PageHeader, StatCard, Icon, Modal, Avatar, EmptyState, ProgressBar, TaskStatusBadge, TaskChat, ArDatePipe, NumPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './task-manager-page.html',
  styleUrl: './task-manager-page.scss',
})
export class TaskManagerPage {
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly tasks = inject(TaskStore);
  private readonly views = inject(TaskViewQuery);
  private readonly bom = inject(BomStore);
  private readonly routing = inject(RoutingStore);
  private readonly workstations = inject(WorkstationStore);
  private readonly insights = inject(ProjectInsightsQuery);
  private readonly purchases = inject(PurchaseStore);
  private readonly session = inject(SessionStore);
  protected readonly projects = inject(ProjectStore);
  protected readonly departments = inject(DepartmentStore);
  protected readonly employees = inject(EmployeeStore);

  protected readonly rejectLabels = REJECT_REASON_LABELS;
  protected readonly filter = signal<Filter>('all');
  protected readonly creating = signal(false);
  protected readonly reassigning = signal<WorkTask | null>(null);
  protected readonly reassignOpen = signal(false);
  protected readonly reassignDept = signal('');
  protected readonly reassignEmployee = signal('');

  protected readonly filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'sent', label: 'مُرسلة' },
    { key: 'accepted', label: 'مقبولة' },
    { key: 'active', label: 'نشطة' },
    { key: 'rejected', label: 'مُعادة' },
    { key: 'completed', label: 'مكتملة' },
    { key: 'cancelled', label: 'ملغاة' },
    { key: 'archived', label: 'الأرشيف' },
  ];

  protected readonly counts = computed(() => {
    const result = { all: 0, sent: 0, accepted: 0, active: 0, rejected: 0, completed: 0, cancelled: 0, archived: this.tasks.archived().length } as Record<Filter, number>;
    for (const task of this.tasks.active()) {
      result.all++;
      result[task.status]++;
    }
    return result;
  });

  protected readonly rows = computed(() => {
    const filter = this.filter();
    const source = filter === 'archived' ? this.tasks.archived() : this.tasks.active().filter((t) => filter === 'all' || t.status === filter);
    return source.map((task) => this.views.view(task));
  });

  /** Aggregated report merging data reported from employee screens. */
  protected readonly report = computed(() => {
    const all = this.tasks.all();
    const rows = this.departments.all().map((dept) => {
      const list = all.filter((t) => t.departmentId === dept.id);
      const views = list.map((t) => this.views.view(t));
      const counted = views.filter((v) => v.task.status !== 'cancelled');
      return {
        dept,
        total: list.length,
        active: list.filter((t) => t.status === 'active').length,
        completed: list.filter((t) => t.status === 'completed').length,
        quantity: views.reduce((sum, v) => sum + v.completedQuantity, 0),
        issues: list.reduce((sum, t) => sum + t.progress.filter((p) => !p.qualityOk).length, 0),
        progress: counted.length ? counted.reduce((sum, v) => sum + v.progress, 0) / counted.length : 0,
      };
    });
    return rows.filter((r) => r.total > 0);
  });

  protected readonly kpis = computed(() => {
    const views = this.tasks.active().map((t) => this.views.view(t));
    return {
      open: views.filter((v) => isTaskOpen(v.task)).length,
      active: views.filter((v) => v.task.status === 'active').length,
      overdue: views.filter((v) => v.overdue).length,
      returned: views.filter((v) => v.task.status === 'rejected').length,
    };
  });

  // ---- New task flow: scope & activity → department & person → dates & notes → send
  protected readonly form = this.fb.group({
    scope: ['project' as TaskScope],
    projectId: [''],
    nodeId: [''],
    /** 'op:<operationId>' | 'pr:<stageKey>' | 'custom' */
    activity: [''],
    title: [''],
    description: [''],
    departmentId: ['', Validators.required],
    assigneeId: ['', Validators.required],
    start: [todayIso(), Validators.required],
    end: [todayIso(), Validators.required],
    targetQuantity: [1, [Validators.required, Validators.min(1)]],
    notes: [''],
  });

  protected readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly nodeOptions = computed(() => {
    const projectId = this.formValue().projectId;
    if (!projectId) return [];
    const tree = this.bom.tree();
    return this.bom
      .all()
      .filter((n) => n.projectId === projectId)
      .sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }))
      .map((node) => ({ node, level: tree.level(node.id) }));
  });

  protected readonly selectedNode = computed(() => this.bom.find(this.formValue().nodeId));

  /** Work related to the selected component: its manufacturing route and its purchase flow. */
  protected readonly activityOptions = computed(() => {
    const nodeId = this.formValue().nodeId ?? '';
    const operations = this.routing.forNode(nodeId).filter((op) => !op.completed);
    const request = this.purchases.byNode().get(nodeId);
    const stages = request ? PURCHASE_STAGES.filter((def) => !request.stages.find((s) => s.key === def.key)?.done) : [];
    return { operations, request, stages };
  });

  protected readonly isCustom = computed(() => this.formValue().scope === 'standalone' || this.formValue().activity === 'custom');
  protected readonly employeeOptions = computed(() => this.employees.inDepartment(this.formValue().departmentId || null));

  // ---- Task details & chat
  protected readonly selectedId = signal<EntityId | null>(null);
  protected readonly detailOpen = signal(false);
  protected readonly selected = computed(() => {
    const task = this.tasks.find(this.selectedId());
    return task ? this.views.view(task) : undefined;
  });
  protected readonly statusLabels = TASK_STATUS_LABELS;

  constructor() {
    const controls = this.form.controls;
    controls.scope.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.form.patchValue({ projectId: '', nodeId: '', activity: '', targetQuantity: 1 });
    });
    controls.projectId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => controls.nodeId.setValue(''));
    controls.nodeId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => controls.activity.setValue(''));
    controls.activity.valueChanges.pipe(takeUntilDestroyed()).subscribe((activity) => this.applyActivityDefaults(activity));
    controls.departmentId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => controls.assigneeId.setValue(''));
  }

  private applyActivityDefaults(activity: string): void {
    const nodeId = this.form.controls.nodeId.value;
    if (activity.startsWith('op:')) {
      const op = this.routing.find(activity.slice(3));
      if (!op) return;
      const dept = this.workstations.find(op.workstationId)?.departmentId;
      this.form.patchValue({
        start: op.earliestStart,
        end: op.latestFinish,
        targetQuantity: this.insights.lotSize(nodeId),
        ...(dept ? { departmentId: dept } : {}),
      });
    } else if (activity.startsWith('pr:')) {
      const dept = this.departments.all().find((d) => d.id === PROCUREMENT_DEPARTMENT);
      this.form.patchValue({ targetQuantity: 1, ...(dept ? { departmentId: dept.id } : {}) });
    } else if (activity === 'custom') {
      this.form.patchValue({ targetQuantity: 1 });
    }
  }

  protected openCreate(): void {
    this.form.reset({ scope: 'project', start: todayIso(), end: todayIso(), targetQuantity: 1 });
    this.creating.set(true);
  }

  protected send(): void {
    const value = this.form.getRawValue();
    const standalone = value.scope === 'standalone';
    const missing =
      this.form.invalid ||
      (!standalone && (!value.projectId || !value.nodeId || !value.activity)) ||
      (this.isCustom() && !value.title.trim());
    if (missing) {
      this.form.markAllAsTouched();
      this.toast.warning('أكمل الحقول المطلوبة', this.isCustom() && !value.title.trim() ? 'أدخل عنوان المهمة' : undefined);
      return;
    }
    if (value.end < value.start) {
      this.toast.warning('تاريخ النهاية قبل تاريخ البداية');
      return;
    }
    const activity = standalone ? 'custom' : value.activity;
    const kind: TaskKind = activity.startsWith('op:') ? 'operation' : activity.startsWith('pr:') ? 'purchase' : 'custom';
    const task = this.tasks.create({
      kind,
      projectId: standalone ? null : value.projectId,
      nodeId: standalone ? null : value.nodeId,
      operationId: kind === 'operation' ? activity.slice(3) : null,
      purchaseId: kind === 'purchase' ? (this.activityOptions().request?.id ?? null) : null,
      purchaseStage: kind === 'purchase' ? (activity.slice(3) as PurchaseStageKey) : null,
      title: kind === 'custom' ? value.title.trim() : '',
      description: value.description.trim(),
      createdById: this.session.userId() || null,
      departmentId: value.departmentId,
      assigneeId: value.assigneeId,
      start: value.start,
      end: value.end,
      notes: value.notes,
      targetQuantity: kind === 'operation' ? value.targetQuantity : 1,
    });
    this.creating.set(false);
    this.toast.success('تم إرسال المهمة', `${task.number} إلى ${this.employees.find(task.assigneeId)?.name}`);
  }

  protected openTask(id: EntityId): void {
    this.selectedId.set(id);
    this.detailOpen.set(true);
  }

  protected unread(task: WorkTask): number {
    return unreadMessages(task, this.session.userId());
  }

  protected archive(id: EntityId, archived: boolean): void {
    this.tasks.setArchived(id, archived);
    this.toast.info(archived ? 'تمت أرشفة المهمة' : 'تمت استعادة المهمة');
  }

  protected openReassign(task: WorkTask): void {
    this.reassigning.set(task);
    this.reassignDept.set(task.departmentId);
    this.reassignEmployee.set('');
    this.reassignOpen.set(true);
  }

  protected confirmReassign(): void {
    const task = this.reassigning();
    if (!task || !this.reassignEmployee()) return;
    this.tasks.reassign(task.id, this.reassignDept(), this.reassignEmployee());
    this.reassignOpen.set(false);
    this.toast.success('أُعيد إرسال المهمة', this.employees.find(this.reassignEmployee())?.name);
  }
}
