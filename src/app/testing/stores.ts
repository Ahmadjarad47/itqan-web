import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EmployeeStore } from '@application/state/organization.store';
import { RoleStore } from '@application/state/role.store';
import { SessionStore } from '@application/state/session.store';
import { Entity, Permission } from '@domain/models';
import {
  BomNodeRepository,
  CatalogOptionRepository,
  CustomFieldRepository,
  DepartmentRepository,
  EmployeeRepository,
  MaterialRepository,
  OperationRepository,
  ProgramRepository,
  ProjectModelRepository,
  ProjectRepository,
  PurchaseRepository,
  Repository,
  RequisitionRepository,
  RoleRepository,
  StockMovementRepository,
  SupplierRepository,
  TaskRepository,
  WarehouseRepository,
  WorkstationRepository,
} from '@domain/ports/repositories';

class InMemoryRepository<T extends Entity> implements Repository<T> {
  async getAll(): Promise<T[]> {
    return [];
  }
  async save(): Promise<void> {}
  async saveMany(): Promise<void> {}
  async remove(): Promise<void> {}
}

/** Empty, side-effect free persistence for store tests. */
export function inMemoryRepositories(): Provider[] {
  return [
    BomNodeRepository,
    CatalogOptionRepository,
    CustomFieldRepository,
    DepartmentRepository,
    EmployeeRepository,
    MaterialRepository,
    OperationRepository,
    ProgramRepository,
    ProjectModelRepository,
    ProjectRepository,
    PurchaseRepository,
    RequisitionRepository,
    RoleRepository,
    StockMovementRepository,
    SupplierRepository,
    TaskRepository,
    WarehouseRepository,
    WorkstationRepository,
  ].map((provide) => ({ provide, useFactory: () => new InMemoryRepository() }));
}

/** Signs in a user whose role holds exactly these permissions. */
export function signInWith(...permissions: Permission[]): void {
  const role = TestBed.inject(RoleStore).create({ name: 'test', description: '', color: '#000000', permissions });
  const user = TestBed.inject(EmployeeStore).create({ name: 'test', title: '', departmentId: 'd', roleId: role.id, email: '', active: true });
  TestBed.inject(SessionStore).switchUser(user.id);
}
