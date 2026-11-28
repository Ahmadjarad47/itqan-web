import { TestBed } from '@angular/core/testing';
import { createPurchaseStages } from '@domain/rules';
import { inMemoryRepositories } from '../../testing/stores';
import { PurchaseWorkflowUseCase } from '../use-cases/purchase-workflow.use-case';
import { WarehouseUseCase } from '../use-cases/warehouse.use-case';
import { InventoryStore } from './inventory.store';
import { NewPurchase, PurchaseStore } from './purchase.store';
import { RequisitionStore } from './warehouse.store';

const A = { warehouseId: 'wh-a', shelfId: null };
const B = { warehouseId: 'wh-b', shelfId: null };

function setup() {
  TestBed.configureTestingModule({ providers: inMemoryRepositories() });
  const inventory = TestBed.inject(InventoryStore);
  const material = inventory.create({
    code: 'M-1',
    name: 'صاج',
    kind: 'raw',
    unit: 'pcs',
    unitCost: 5,
    minStock: 0,
    maxStock: 0,
    categoryId: null,
    natureId: null,
    costMethod: 'fifo',
    margin: { type: 'percent', value: 0 },
    specFiles: [],
    notes: '',
    opening: [
      { ...A, quantity: 3, unitCost: 5 },
      { ...B, quantity: 10, unitCost: 5 },
    ],
  });
  const at = (warehouseId: string) => inventory.find(material.id)!.locations.find((l) => l.warehouseId === warehouseId)?.quantity ?? 0;
  const stock = () => inventory.find(material.id)!.stock;
  const ledgerQty = () => inventory.ledger(material.id)!.quantity;
  return { inventory, id: material.id, at, stock, ledgerQty };
}

const transfer = (materialId: string, quantity: number) => ({ materialId, from: A, to: B, quantity, date: '2026-01-02', reference: 't' });
const issue = (materialId: string, quantity: number, location: { warehouseId: string | null; shelfId: null } = A) => ({
  materialId,
  type: 'issue' as const,
  ...location,
  quantity,
  date: '2026-01-02',
  reference: 'i',
});

const newPurchase = (materialId: string | null = null) =>
  ({ title: 'صاج', projectId: null, nodeId: null, quantity: 5, unit: 'pcs', priority: 'normal', materialId }) as unknown as NewPurchase;

describe('stock availability', () => {
  it('refuses a transfer larger than the source location', () => {
    const { inventory, id, at, stock } = setup();
    inventory.transfer(transfer(id, 10));
    expect([at('wh-a'), at('wh-b'), stock()]).toEqual([3, 10, 13]);
  });

  it('refuses an issue larger than the chosen location', () => {
    const { inventory, id, stock, ledgerQty } = setup();
    inventory.issue(issue(id, 8));
    expect([stock(), ledgerQty()]).toEqual([13, 13]);
  });

  it('refuses an unplaced issue larger than the total stock', () => {
    const { inventory, id, stock, ledgerQty } = setup();
    inventory.issue(issue(id, 20, { warehouseId: null, shelfId: null }));
    expect([stock(), ledgerQty()]).toEqual([13, 13]);
  });

  it('still allows a transfer within the available quantity', () => {
    const { inventory, id, at } = setup();
    inventory.transfer(transfer(id, 3));
    expect([at('wh-a'), at('wh-b')]).toEqual([0, 13]);
  });

  it('consumes only what is on hand and records the shortage', () => {
    const { inventory, id, stock, ledgerQty } = setup();
    inventory.move(id, 'consumption', 20, 'عملية');
    expect([stock(), ledgerQty()]).toEqual([0, 0]);
    expect(inventory.movements().find((m) => m.type === 'consumption')!.reference).toContain('نقص 7');
  });

  it('rejects a whole requisition whose lines together exceed one location', () => {
    const { inventory, id, stock } = setup();
    const requisitions = TestBed.inject(RequisitionStore);
    const rq = requisitions.create({
      origin: 'system',
      departmentId: null,
      requester: '',
      projectId: null,
      requestDate: '2026-01-02',
      dueDate: '2026-01-05',
      warehouseId: null,
      notes: '',
      lines: [{ materialId: id, quantity: 4, note: '' }],
    });
    const line = { lineId: 'l', materialId: id, ...A, quantity: 2, sellPrice: null };
    TestBed.inject(WarehouseUseCase).issueRequisition(rq.id, [line, line]);
    expect(stock()).toBe(13);
    expect(requisitions.find(rq.id)!.status).toBe('new');
    expect(inventory.movements().filter((m) => m.type === 'issue')).toHaveLength(0);
  });
});

describe('warehouse receipt of a purchase', () => {
  it('receives the goods once even when the stage is reopened and closed again', () => {
    const { id, stock } = setup();
    const purchases = TestBed.inject(PurchaseStore);
    const created = purchases.create(newPurchase(id));
    purchases.update(created.id, { qualityResult: 'passed', unitPrice: 5 });
    createPurchaseStages()
      .filter((s) => s.key !== 'warehouseReceipt')
      .forEach((s) => purchases.updateStage(created.id, s.key, { done: true }));
    const workflow = TestBed.inject(PurchaseWorkflowUseCase);
    for (let i = 0; i < 3; i++) workflow.toggleStage(created.id, 'warehouseReceipt');
    expect(stock()).toBe(18);
  });
});

describe('document numbers after a delete', () => {
  it('never repeats a purchase number', () => {
    setup();
    const purchases = TestBed.inject(PurchaseStore);
    const first = purchases.create(newPurchase());
    const second = purchases.create(newPurchase());
    purchases.remove(first.id);
    expect(purchases.create(newPurchase()).number).not.toBe(second.number);
  });
});
