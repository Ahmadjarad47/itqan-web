import { inject, Injectable } from '@angular/core';
import { Department, EntityId, Employee } from '@domain/models';
import { DepartmentRepository, EmployeeRepository } from '@domain/ports/repositories';
import { EntityStore } from './entity-store';

@Injectable({ providedIn: 'root' })
export class DepartmentStore extends EntityStore<Department> {
  protected readonly repository = inject(DepartmentRepository);
}

@Injectable({ providedIn: 'root' })
export class EmployeeStore extends EntityStore<Employee> {
  protected readonly repository = inject(EmployeeRepository);

  inDepartment(departmentId: EntityId | null): readonly Employee[] {
    return departmentId ? this.all().filter((e) => e.departmentId === departmentId) : this.all();
  }
}
