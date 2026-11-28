import { Provider } from '@angular/core';
import { Entity } from '@domain/models';
import {
  BomNodeRepository,
  MaterialRepository,
  ProjectModelRepository,
  PurchaseRepository,
  Repository,
  RequisitionRepository,
  StockMovementRepository,
  TaskRepository,
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
    MaterialRepository,
    ProjectModelRepository,
    PurchaseRepository,
    RequisitionRepository,
    StockMovementRepository,
    TaskRepository,
  ].map((provide) => ({ provide, useFactory: () => new InMemoryRepository() }));
}
