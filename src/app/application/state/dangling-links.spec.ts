import { TestBed } from '@angular/core/testing';
import { isTaskOverdue } from '@domain/rules';
import { inMemoryRepositories } from '../../testing/stores';
import { ProjectSetupUseCase } from '../use-cases/project-setup.use-case';
import { SourcingUseCase } from '../use-cases/sourcing.use-case';
import { BomStore } from './bom.store';
import { InventoryStore } from './inventory.store';
import { NewPurchase, PurchaseStore } from './purchase.store';
import { RoutingStore } from './routing.store';
import { NewTask, TaskStore } from './task.store';
import { WarehouseStore } from './warehouse.store';

function setup() {
  TestBed.configureTestingModule({ providers: inMemoryRepositories() });
  return {
    bom: TestBed.inject(BomStore),
    inventory: TestBed.inject(InventoryStore),
    purchases: TestBed.inject(PurchaseStore),
    routing: TestBed.inject(RoutingStore),
    tasks: TestBed.inject(TaskStore),
    warehouses: TestBed.inject(WarehouseStore),
    projectSetup: TestBed.inject(ProjectSetupUseCase),
    sourcing: TestBed.inject(SourcingUseCase),
  };
}

const task = (changes: Partial<NewTask>) =>
  ({ kind: 'custom', nodeId: null, operationId: null, purchaseId: null, title: 't', ...changes }) as NewTask;
const purchase = (changes: Partial<NewPurchase> = {}) =>
  ({ title: 'x', projectId: null, nodeId: null, quantity: 1, unit: 'pcs', priority: 'normal', ...changes }) as NewPurchase;
const projectDraft = {
  code: 'PRJ',
  name: 'p',
  customer: '',
  programId: null,
  productionQuantity: 1,
  dueDate: '2026-12-31',
  discipline: 'mechanical',
  description: '',
  image: null,
} as const;

describe('deletes leave no dangling links', () => {
  it('unlinks purchase tasks when the sourcing decision removes the purchase', () => {
    const { bom, sourcing, tasks } = setup();
    const node = bom.createRoot('p-1', { code: 'A', name: 'a', discipline: 'mechanical', quantity: 1, unit: 'pcs' });
    const request = sourcing.decide(node.id, 'buy').createdPurchase!;
    const { id } = tasks.create(task({ kind: 'purchase', purchaseId: request.id }));
    sourcing.decide(node.id, 'make');
    expect(tasks.find(id)!.purchaseId).toBeNull();
  });

  it('unlinks purchase tasks when the purchase is deleted from the store', () => {
    const { purchases, tasks } = setup();
    const request = purchases.create(purchase());
    const { id } = tasks.create(task({ kind: 'purchase', purchaseId: request.id }));
    purchases.remove(request.id);
    expect(tasks.find(id)!.purchaseId).toBeNull();
  });

  it('cancels an unfinished task of a deleted purchase and notes why', () => {
    const { purchases, tasks } = setup();
    const request = purchases.create(purchase());
    const { id } = tasks.create(task({ kind: 'purchase', purchaseId: request.id }));
    tasks.transition(id, 'accepted');
    purchases.remove(request.id);
    expect(tasks.find(id)!.status).toBe('cancelled');
    expect(tasks.find(id)!.history.at(-1)!.note).toBe('أُلغيت لحذف طلب الشراء');
    expect(tasks.transition(id, 'active')).toBe(false);
    expect(isTaskOverdue({ ...tasks.find(id)!, end: '2000-01-01' }, '2026-01-01')).toBe(false);
  });

  it('keeps a completed task completed when its purchase is deleted', () => {
    const { purchases, tasks } = setup();
    const request = purchases.create(purchase());
    const { id } = tasks.create(task({ kind: 'purchase', purchaseId: request.id }));
    (['accepted', 'active', 'completed'] as const).forEach((status) => tasks.transition(id, status));
    purchases.remove(request.id);
    expect(tasks.find(id)!.status).toBe('completed');
  });

  it('unlinks tasks of a removed routing operation', () => {
    const { routing, tasks } = setup();
    const op = routing.createBlank('n-1');
    const { id } = tasks.create(task({ kind: 'operation', nodeId: 'n-1', operationId: op.id }));
    routing.remove(op.id);
    expect(tasks.find(id)!.operationId).toBeNull();
  });

  it('removes everything of a deleted project, also outside the root subtree', () => {
    const { bom, projectSetup, purchases, routing, tasks } = setup();
    const project = projectSetup.create(projectDraft);
    const stray = bom.createRoot(project.id, { code: 'B', name: 'b', discipline: 'mechanical', quantity: 1, unit: 'pcs' });
    routing.createBlank(stray.id);
    tasks.create(task({ projectId: project.id, nodeId: stray.id }));
    purchases.create(purchase({ projectId: project.id }));
    purchases.create(purchase({ projectId: project.id, nodeId: project.rootNodeId }));
    purchases.create(purchase({ projectId: project.id, nodeId: project.rootNodeId }));
    const started = purchases.create(purchase({ projectId: project.id }));
    purchases.updateStage(started.id, started.stages[0].key, { done: true });

    projectSetup.removeProject(project.id);

    expect([bom.all().length, routing.all().length, tasks.all().length]).toEqual([0, 0, 0]);
    expect(purchases.all().map((r) => [r.id, r.projectId, r.nodeId])).toEqual([[started.id, null, null]]);
  });

  it('drops empty locations and supply destinations of a deleted warehouse', () => {
    const { inventory, purchases, warehouses } = setup();
    const warehouse = warehouses.create({ code: 'W', name: 'w', parentId: null } as Parameters<WarehouseStore['create']>[0]);
    const material = inventory.create({
      code: 'M',
      name: 'm',
      storage: [
        { warehouseId: warehouse.id, shelfId: null },
        { warehouseId: 'wh-other', shelfId: null },
      ],
    } as unknown as Parameters<InventoryStore['create']>[0]);
    const request = purchases.create(purchase({ materialId: material.id, warehouseId: warehouse.id }));

    warehouses.remove(warehouse.id);

    expect(inventory.find(material.id)!.locations.map((l) => l.warehouseId)).toEqual(['wh-other']);
    expect(purchases.find(request.id)!.warehouseId).toBeNull();
  });
});
