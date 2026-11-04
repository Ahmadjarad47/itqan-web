import { computed, inject, Injectable } from '@angular/core';
import { Department, EntityId, Employee } from '@domain/models';
import { DepartmentRepository, EmployeeRepository } from '@domain/ports/repositories';
import { EntityStore, newId } from './entity-store';

@Injectable({ providedIn: 'root' })
export class DepartmentStore extends EntityStore<Department> {
  protected readonly repository = inject(DepartmentRepository);
}

/** Users of the system; every user is an employee carrying one role. */
@Injectable({ providedIn: 'root' })
export class EmployeeStore extends EntityStore<Employee> {
  protected readonly repository = inject(EmployeeRepository);

  readonly activeUsers = computed(() => this.all().filter((e) => e.active));

  inDepartment(departmentId: EntityId | null): readonly Employee[] {
    const active = this.activeUsers();
    return departmentId ? active.filter((e) => e.departmentId === departmentId) : active;
  }

  withRole(roleId: EntityId): readonly Employee[] {
    return this.all().filter((e) => e.roleId === roleId);
  }

  create(data: Omit<Employee, 'id'>): Employee {
    return this.insert({ ...data, id: newId('u') });
  }

  update(id: EntityId, changes: Partial<Omit<Employee, 'id'>>): void {
    this.modify(id, changes);
  }
}
