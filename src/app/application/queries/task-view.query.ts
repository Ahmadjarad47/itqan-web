import { inject, Injectable } from '@angular/core';
import { BomNode, Department, Employee, Project, RoutingOperation, WorkTask } from '@domain/models';
import { isTaskOverdue, taskCompletedQuantity, taskProgress, todayIso } from '@domain/rules';
import { BomStore } from '../state/bom.store';
import { DepartmentStore, EmployeeStore } from '../state/organization.store';
import { ProjectStore } from '../state/project.store';
import { RoutingStore } from '../state/routing.store';

export interface TaskView {
  readonly task: WorkTask;
  readonly operation: RoutingOperation | undefined;
  readonly node: BomNode | undefined;
  readonly project: Project | undefined;
  readonly department: Department | undefined;
  readonly assignee: Employee | undefined;
  readonly completedQuantity: number;
  readonly progress: number;
  readonly overdue: boolean;
}

/** Resolves task references into a display-ready view model. */
@Injectable({ providedIn: 'root' })
export class TaskViewQuery {
  private readonly routing = inject(RoutingStore);
  private readonly bom = inject(BomStore);
  private readonly projects = inject(ProjectStore);
  private readonly departments = inject(DepartmentStore);
  private readonly employees = inject(EmployeeStore);

  view(task: WorkTask): TaskView {
    return {
      task,
      operation: this.routing.find(task.operationId),
      node: this.bom.find(task.nodeId),
      project: this.projects.find(task.projectId),
      department: this.departments.find(task.departmentId),
      assignee: this.employees.find(task.assigneeId),
      completedQuantity: taskCompletedQuantity(task),
      progress: taskProgress(task),
      overdue: isTaskOverdue(task, todayIso()),
    };
  }
}
