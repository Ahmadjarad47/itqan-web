import { inject, Injectable } from '@angular/core';
import {
  BomNode,
  Department,
  Employee,
  Project,
  PurchaseRequest,
  RoutingOperation,
  TASK_KIND_LABELS,
  WorkTask,
} from '@domain/models';
import { isTaskOverdue, stageDefinition, taskCompletedQuantity, taskProgress, todayIso } from '@domain/rules';
import { BomStore } from '../state/bom.store';
import { DepartmentStore, EmployeeStore } from '../state/organization.store';
import { ProjectStore } from '../state/project.store';
import { PurchaseStore } from '../state/purchase.store';
import { RoutingStore } from '../state/routing.store';

export interface TaskView {
  readonly task: WorkTask;
  readonly operation: RoutingOperation | undefined;
  readonly purchase: PurchaseRequest | undefined;
  readonly node: BomNode | undefined;
  readonly project: Project | undefined;
  readonly department: Department | undefined;
  readonly assignee: Employee | undefined;
  readonly manager: Employee | undefined;
  /** Display title, whatever the task kind. */
  readonly title: string;
  /** Context line: component and project, or "standalone task". */
  readonly context: string;
  readonly kindLabel: string;
  readonly completedQuantity: number;
  readonly progress: number;
  readonly overdue: boolean;
}

/** Resolves task references into a display-ready view model. */
@Injectable({ providedIn: 'root' })
export class TaskViewQuery {
  private readonly routing = inject(RoutingStore);
  private readonly purchases = inject(PurchaseStore);
  private readonly bom = inject(BomStore);
  private readonly projects = inject(ProjectStore);
  private readonly departments = inject(DepartmentStore);
  private readonly employees = inject(EmployeeStore);

  view(task: WorkTask): TaskView {
    const operation = this.routing.find(task.operationId);
    const purchase = this.purchases.find(task.purchaseId);
    const node = this.bom.find(task.nodeId);
    const project = this.projects.find(task.projectId);
    return {
      task,
      operation,
      purchase,
      node,
      project,
      department: this.departments.find(task.departmentId),
      assignee: this.employees.find(task.assigneeId),
      manager: this.employees.find(task.createdById),
      title: this.title(task, operation),
      context: node ? `${node.name}${project ? ' · ' + project.code : ''}` : project ? project.code : 'مهمة مستقلة — غير تابعة لمشروع',
      kindLabel: TASK_KIND_LABELS[task.kind],
      completedQuantity: taskCompletedQuantity(task),
      progress: taskProgress(task),
      overdue: isTaskOverdue(task, todayIso()),
    };
  }

  private title(task: WorkTask, operation: RoutingOperation | undefined): string {
    if (task.kind === 'operation' && operation) return `${operation.sequence} — ${operation.name}`;
    if (task.kind === 'purchase') {
      const stage = task.purchaseStage ? stageDefinition(task.purchaseStage).label : 'متابعة الشراء';
      return `شراء — ${stage}`;
    }
    return task.title || 'مهمة';
  }
}
