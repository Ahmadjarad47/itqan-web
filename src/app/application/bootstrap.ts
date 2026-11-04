import { inject } from '@angular/core';
import { BomStore } from './state/bom.store';
import { InventoryStore } from './state/inventory.store';
import { DepartmentStore, EmployeeStore } from './state/organization.store';
import { ProjectStore } from './state/project.store';
import { PurchaseStore } from './state/purchase.store';
import { RoutingStore, WorkstationStore } from './state/routing.store';
import { SupplierStore } from './state/supplier.store';
import { TaskStore } from './state/task.store';

/** Hydrates every store before the first route renders. */
export function loadApplicationState(): Promise<void> {
  const stores = [
    inject(ProjectStore),
    inject(BomStore),
    inject(InventoryStore),
    inject(SupplierStore),
    inject(PurchaseStore),
    inject(WorkstationStore),
    inject(RoutingStore),
    inject(DepartmentStore),
    inject(EmployeeStore),
    inject(TaskStore),
  ];
  return Promise.all(stores.map((store) => store.load())).then(() => undefined);
}
