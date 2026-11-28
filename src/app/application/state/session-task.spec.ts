import { TestBed } from '@angular/core/testing';
import { Employee } from '@domain/models';
import { EmployeeRepository } from '@domain/ports/repositories';
import { inMemoryRepositories } from '../../testing/stores';
import { ProductionUseCase } from '../use-cases/production.use-case';
import { TaskWorkflowUseCase } from '../use-cases/task-workflow.use-case';
import { EmployeeStore } from './organization.store';
import { RoutingStore } from './routing.store';
import { SessionStore } from './session.store';
import { NewTask, TaskStore } from './task.store';

const newTask = (changes: Partial<NewTask> = {}): NewTask => ({
  kind: 'operation',
  projectId: 'p-1',
  nodeId: 'n-1',
  operationId: null,
  purchaseId: null,
  purchaseStage: null,
  title: '',
  description: '',
  createdById: null,
  departmentId: 'd-1',
  assigneeId: 'u-1',
  start: '2026-01-01',
  end: '2026-01-05',
  notes: '',
  targetQuantity: 10,
  ...changes,
});

describe('SessionStore default user', () => {
  it('does not stay signed in as a disabled default admin', async () => {
    localStorage.removeItem('erp101.user');
    const users = [
      { id: 'u-admin', name: 'admin', active: false },
      { id: 'u-2', name: 'second', active: true },
    ] as unknown as Employee[];
    TestBed.configureTestingModule({
      providers: [...inMemoryRepositories(), { provide: EmployeeRepository, useValue: { getAll: async () => users } }],
    });
    await TestBed.inject(EmployeeStore).load();
    expect(TestBed.inject(SessionStore).userId()).toBe('u-2');
  });
});

describe('task lifecycle', () => {
  function setup() {
    TestBed.configureTestingModule({ providers: inMemoryRepositories() });
    return {
      tasks: TestBed.inject(TaskStore),
      routing: TestBed.inject(RoutingStore),
      workflow: TestBed.inject(TaskWorkflowUseCase),
      production: TestBed.inject(ProductionUseCase),
    };
  }

  it('keeps the assignee when the task cannot be sent again', () => {
    const { tasks, workflow } = setup();
    const { id } = tasks.create(newTask());
    workflow.accept(id);
    tasks.reassign(id, 'd-2', 'u-2');
    expect([tasks.find(id)!.departmentId, tasks.find(id)!.assigneeId]).toEqual(['d-1', 'u-1']);
  });

  it('still reassigns a rejected task', () => {
    const { tasks } = setup();
    const { id } = tasks.create(newTask());
    tasks.reject(id, 'time', '');
    tasks.reassign(id, 'd-2', 'u-2');
    const task = tasks.find(id)!;
    expect([task.assigneeId, task.status, task.rejectReason]).toEqual(['u-2', 'sent', null]);
  });

  it('ignores progress on a task that is not active', () => {
    const { tasks, routing, workflow } = setup();
    const op = routing.createBlank('n-1');
    const { id } = tasks.create(newTask({ operationId: op.id }));
    workflow.logProgress(id, 5, false, 'bad');
    const after = routing.find(op.id)!;
    expect([tasks.find(id)!.progress.length, after.progressPercent, after.qcStatus]).toEqual([0, 0, 'pending']);
  });

  it('still logs progress on an active task', () => {
    const { tasks, routing, workflow } = setup();
    const op = routing.createBlank('n-1');
    const { id } = tasks.create(newTask({ operationId: op.id }));
    workflow.accept(id);
    workflow.start(id);
    workflow.logProgress(id, 5, true, '');
    expect(routing.find(op.id)!.progressPercent).toBe(50);
  });

  it('clears the old finish date of every operation sent back to rework', () => {
    const { routing, production } = setup();
    const first = routing.createBlank('n-1');
    const second = routing.createBlank('n-1');
    for (const op of [first, second]) routing.update(op.id, { completed: true, actualFinish: '2020-01-01' });
    production.rejectQuality(second.id, first.sequence, 'bad');
    expect([routing.find(first.id)!.actualFinish, routing.find(second.id)!.actualFinish]).toEqual([null, null]);
  });
});
