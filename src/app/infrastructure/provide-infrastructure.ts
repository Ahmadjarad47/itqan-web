import { EnvironmentProviders, makeEnvironmentProviders, Provider } from '@angular/core';
import { Entity } from '@domain/models';
import {
  BomNodeRepository,
  CustomFieldRepository,
  DepartmentRepository,
  EmployeeRepository,
  MaterialRepository,
  OperationRepository,
  ProjectRepository,
  PurchaseRepository,
  Repository,
  RoleRepository,
  StockMovementRepository,
  SupplierRepository,
  TaskRepository,
  WorkstationRepository,
} from '@domain/ports/repositories';
import { LocalStorageRepository } from './persistence/local-storage.repository';
import { SeedData, seedData } from './seed/seed-data';

type RepositoryToken<T extends Entity> = abstract new () => Repository<T>;

function localRepository<T extends Entity>(
  token: RepositoryToken<T>,
  collection: keyof SeedData,
): Provider {
  return {
    provide: token,
    useFactory: () => new LocalStorageRepository<T>(collection, () => seedData()[collection] as unknown as T[]),
  };
}

/** Binds every repository port to its browser-storage adapter. */
export function provideInfrastructure(): EnvironmentProviders {
  return makeEnvironmentProviders([
    localRepository(ProjectRepository, 'projects'),
    localRepository(BomNodeRepository, 'nodes'),
    localRepository(MaterialRepository, 'materials'),
    localRepository(StockMovementRepository, 'movements'),
    localRepository(SupplierRepository, 'suppliers'),
    localRepository(PurchaseRepository, 'purchases'),
    localRepository(WorkstationRepository, 'workstations'),
    localRepository(OperationRepository, 'operations'),
    localRepository(DepartmentRepository, 'departments'),
    localRepository(EmployeeRepository, 'employees'),
    localRepository(TaskRepository, 'tasks'),
    localRepository(RoleRepository, 'roles'),
    localRepository(CustomFieldRepository, 'customFields'),
  ]);
}
