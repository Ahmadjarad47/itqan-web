import { TestBed } from '@angular/core/testing';
import { Permission } from '@domain/models';
import { inMemoryRepositories, signInWith } from '../../testing/stores';
import { WarehouseUseCase } from '../use-cases/warehouse.use-case';
import { InventoryStore } from './inventory.store';
import { RequisitionStore } from './warehouse.store';

const A = { warehouseId: 'wh-a', shelfId: null };

function setup(...permissions: Permission[]) {
  TestBed.configureTestingModule({ providers: inMemoryRepositories() });
  signInWith(...permissions);
  const inventory = TestBed.inject(InventoryStore);
  const material = inventory.create({
    code: 'M-1', name: 'صاج', kind: 'raw', unit: 'pcs', unitCost: 5, minStock: 0, maxStock: 0,
    categoryId: null, natureId: null, costMethod: 'fifo', margin: { type: 'percent', value: 0 }, specFiles: [], notes: '',
    opening: [{ ...A, quantity: 10, unitCost: 5 }],
  });
  const requisitions = TestBed.inject(RequisitionStore);
  const requisition = requisitions.create({
    origin: 'system', departmentId: null, requester: '', projectId: null, requestDate: '2026-01-01',
    dueDate: '2099-01-05', warehouseId: null, notes: '', lines: [{ materialId: material.id, quantity: 4, note: '' }],
  });
  const flows = TestBed.inject(WarehouseUseCase);
  const line = { lineId: requisition.lines[0].id, materialId: material.id, ...A, quantity: 4, sellPrice: null };
  return {
    issue: () => flows.issueRequisition(requisition.id, [line], '2099-01-01'),
    setStatus: () => flows.setRequisitionStatus(requisition.id, 'preparing'),
    transfer: () =>
      flows.transfer({ materialId: material.id, from: A, to: { warehouseId: 'wh-b', shelfId: null }, quantity: 3, date: '2099-01-01', reference: 't' }),
    writeOff: () => flows.writeOff({ materialId: material.id, type: 'writeoff', ...A, quantity: 3, date: '2099-01-01', reference: 'w' }),
    places: () => inventory.find(material.id)!.locations.length,
    stock: () => inventory.find(material.id)!.stock,
    status: () => requisitions.find(requisition.id)!.status,
  };
}

describe('requisition permissions', () => {
  it('refuses issuing for a user who may only view the stock', () => {
    const { issue, stock, status } = setup('inventory.view');
    expect(issue().allowed).toBe(false);
    expect([stock(), status()]).toEqual([10, 'new']);
  });

  it('refuses a status change for a user who may only view the stock', () => {
    const { setStatus, status } = setup('inventory.view');
    expect(setStatus().allowed).toBe(false);
    expect(status()).toBe('new');
  });

  it('refuses a transfer and a write-off for a view-only user', () => {
    const { transfer, writeOff, stock, places } = setup('inventory.view');
    expect([transfer().allowed, writeOff().allowed]).toEqual([false, false]);
    expect([stock(), places()]).toEqual([10, 1]);
  });

  it('lets a stock manager transfer and write off', () => {
    const { transfer, writeOff, stock, places } = setup('inventory.manage');
    expect([transfer().allowed, writeOff().allowed]).toEqual([true, true]);
    expect([stock(), places()]).toEqual([7, 2]);
  });

  it('lets a stock manager change the status and issue', () => {
    const { setStatus, issue, stock, status } = setup('inventory.view', 'inventory.manage');
    expect(setStatus().allowed).toBe(true);
    expect(status()).toBe('preparing');
    expect(issue().allowed).toBe(true);
    expect([stock(), status()]).toEqual([6, 'delivered']);
  });
});
