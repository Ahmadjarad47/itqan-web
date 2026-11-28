import { Provider } from '@angular/core';
import { Entity } from '@domain/models';
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
