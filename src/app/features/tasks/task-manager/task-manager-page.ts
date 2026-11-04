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
import { EntityId, REJECT_REASON_LABELS, TaskStatus, WorkTask } from '@domain/models';
import { todayIso } from '@domain/rules';
import { ArDatePipe, NumPipe } from '@shared/pipes/format.pipes';
import { Avatar } from '@shared/ui/avatar/avatar';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { ProgressBar } from '@shared/ui/progress/progress';
import { StatCard } from '@shared/ui/stat-card/stat-card';
import { TaskStatusBadge } from '../shared/task-status-badge';

type Filter = 'all' | TaskStatus | 'archived';

@Component({
  selector: 'app-task-manager-page',
  imports: [ReactiveFormsModule, PageHeader, StatCard, Icon, Modal, Avatar, EmptyState, ProgressBar, TaskStatusBadge, ArDatePipe, NumPipe],
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
    { key: 'archived', label: 'الأرشيف' },
  ];

  protected readonly counts = computed(() => {
    const result = { all: 0, sent: 0, accepted: 0, active: 0, rejected: 0, completed: 0, archived: this.tasks.archived().length } as Record<Filter, number>;
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
      return {
        dept,
        total: list.length,
        active: list.filter((t) => t.status === 'active').length,
        completed: list.filter((t) => t.status === 'completed').length,
        quantity: views.reduce((sum, v) => sum + v.completedQuantity, 0),
        issues: list.reduce((sum, t) => sum + t.progress.filter((p) => !p.qualityOk).length, 0),
        progress: views.length ? views.reduce((sum, v) => sum + v.progress, 0) / views.length : 0,
      };
    });
    return rows.filter((r) => r.total > 0);
  });

  protected readonly kpis = computed(() => {
    const views = this.tasks.active().map((t) => this.views.view(t));
    return {
      open: views.filter((v) => v.task.status !== 'completed').length,
      active: views.filter((v) => v.task.status === 'active').length,
      overdue: views.filter((v) => v.overdue).length,
      returned: views.filter((v) => v.task.status === 'rejected').length,
    };
  });

  // ---- New task flow: component & operation → department & person → dates & notes → send
  protected readonly form = this.fb.group({
    projectId: ['', Validators.required],
    nodeId: ['', Validators.required],
    operationId: ['', Validators.required],
    departmentId: ['', Validators.required],
    assigneeId: ['', Validators.required],
    start: [todayIso(), Validators.required],
    end: [todayIso(), Validators.required],
    targetQuantity: [1, [Validators.required, Validators.min(1)]],
    notes: [''],
  });

  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly nodeOptions = computed(() => {
    const projectId = this.formValue().projectId;
    return this.bom
      .all()
      .filter((n) => n.projectId === projectId && this.routing.forNode(n.id).length)
      .sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
  });

  protected readonly operationOptions = computed(() => this.routing.forNode(this.formValue().nodeId ?? '').filter((op) => !op.completed));
  protected readonly employeeOptions = computed(() => this.employees.inDepartment(this.formValue().departmentId || null));

  constructor() {
    const controls = this.form.controls;
    controls.projectId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => controls.nodeId.setValue(''));
    controls.nodeId.valueChanges.pipe(takeUntilDestroyed()).subscribe((nodeId) => {
      controls.operationId.setValue('');
      if (nodeId) controls.targetQuantity.setValue(this.insights.lotSize(nodeId));
    });
    controls.operationId.valueChanges.pipe(takeUntilDestroyed()).subscribe((opId) => {
      const op = this.routing.find(opId);
      if (!op) return;
      const dept = this.workstations.find(op.workstationId)?.departmentId;
      this.form.patchValue({ start: op.earliestStart, end: op.latestFinish, ...(dept ? { departmentId: dept } : {}) });
    });
    controls.departmentId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => controls.assigneeId.setValue(''));
  }

  protected openCreate(): void {
    this.form.reset({ start: todayIso(), end: todayIso(), targetQuantity: 1 });
    this.creating.set(true);
  }

  protected send(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('أكمل الحقول المطلوبة');
      return;
    }
    const value = this.form.getRawValue();
    if (value.end < value.start) {
      this.toast.warning('تاريخ النهاية قبل تاريخ البداية');
      return;
    }
    const task = this.tasks.create(value);
    this.creating.set(false);
    this.toast.success('تم إرسال المهمة', `${task.number} إلى ${this.employees.find(task.assigneeId)?.name}`);
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
