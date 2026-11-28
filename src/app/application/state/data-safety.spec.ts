import { TestBed } from '@angular/core/testing';
import { inMemoryRepositories, signInWith } from '../../testing/stores';
import { WarehouseUseCase } from '../use-cases/warehouse.use-case';
import { InventoryStore } from './inventory.store';
import { NewPurchase, PurchaseStore } from './purchase.store';
import { RequisitionStore } from './warehouse.store';

const A = { warehouseId: 'wh-a', shelfId: null };

function setup() {
  TestBed.configureTestingModule({ providers: inMemoryRepositories() });
  signInWith('inventory.manage');
  const inventory = TestBed.inject(InventoryStore);
  const purchases = TestBed.inject(PurchaseStore);
  const flows = TestBed.inject(WarehouseUseCase);
  const requisitions = TestBed.inject(RequisitionStore);
  const card = {
    code: 'M-1',
    name: 'صاج',
    kind: 'raw' as const,
    unit: 'pcs' as const,
    unitCost: 5,
    minStock: 0,
    maxStock: 0,
    categoryId: null,
    natureId: null,
    costMethod: 'fifo' as const,
    margin: { type: 'percent' as const, value: 0 },
    specFiles: [],
    notes: '',
    storage: [A],
  };
  const material = inventory.create(card);
  const receive = (quantity: number, date: string, purchaseId: string | null = null, materialId = material.id) =>
    flows.receive({ materialId, ...A, quantity, unitCost: 5, date, source: 'other', documentNo: '', purchaseId });
  const stock = () => inventory.find(material.id)!.stock;
  const issue = (quantity: number, date: string) =>
    inventory.issue({ materialId: material.id, type: 'writeoff', ...A, quantity, date, reference: 'w' });
  const purchase = (qc: 'passed' | 'failed' | null) => {
    const request = purchases.create({
      title: 'صاج',
      projectId: null,
      nodeId: null,
      quantity: 5,
      unit: 'pcs',
      priority: 'normal',
      materialId: material.id,
    } as unknown as NewPurchase);
    purchases.update(request.id, { qualityResult: qc });
    if (qc) purchases.updateStage(request.id, 'qualityControl', { done: true, date: '2026-01-01' });
    return request.id;
  };
  return { inventory, purchases, flows, requisitions, card, id: material.id, receive, issue, stock, purchase };
}

describe('back-dated withdrawals', () => {
  it('refuses an issue dated before the stock arrived', () => {
    const { receive, issue, stock } = setup();
    receive(10, '2026-03-10');
    expect(issue(4, '2026-03-01')).toBeUndefined();
    expect(stock()).toBe(10);
  });

  it('refuses a back-dated issue that would starve a later issue', () => {
    const { receive, issue, stock } = setup();
    receive(10, '2026-03-01');
    issue(8, '2026-03-20');
    receive(10, '2026-03-25');
    expect(issue(5, '2026-03-10')).toBeUndefined();
    expect(stock()).toBe(12);
  });

  it('allows a back-dated issue the history can cover', () => {
    const { receive, issue, stock } = setup();
    receive(10, '2026-03-01');
    receive(10, '2026-03-25');
    expect(issue(4, '2026-03-10')).toBeDefined();
    expect(stock()).toBe(16);
  });

  it('refuses an issue without a date', () => {
    const { receive, issue } = setup();
    receive(10, '2026-03-01');
    expect(issue(1, '')).toBeUndefined();
  });

  it('keeps the requisition open when its date precedes the stock', () => {
    const { receive, flows, requisitions, id, stock } = setup();
    receive(10, '2026-03-10');
    const requisition = requisitions.create({
      origin: 'system',
      requesterName: 'x',
      departmentId: null,
      projectId: null,
      date: '2026-03-01',
      notes: '',
      attachments: [],
      lines: [{ materialId: id, quantity: 4, note: '' }],
    } as unknown as Parameters<RequisitionStore['create']>[0]);
    const line = { lineId: requisition.lines[0].id, materialId: id, ...A, quantity: 4, sellPrice: null };
    const result = flows.issueRequisition(requisition.id, [line], '2026-03-01');
    expect(result.reason).toBe('لا يوجد رصيد كافٍ في هذا التاريخ مقارنةً بالحركات المسجلة');
    expect([requisitions.find(requisition.id)!.status, stock()]).toEqual(['new', 10]);
  });
});

describe('receiving against a supply request', () => {
  it.each([null, 'failed'] as const)('refuses a request with quality result %s', (qc) => {
    const { receive, purchase, stock } = setup();
    expect(receive(5, '2026-03-01', purchase(qc)).allowed).toBe(false);
    expect(stock()).toBe(0);
  });

  it('refuses a different item than the one requested', () => {
    const { inventory, card, receive, purchase } = setup();
    const other = inventory.create({ ...card, code: 'M-2' });
    expect(receive(5, '2026-03-01', purchase('passed'), other.id).allowed).toBe(false);
    expect(inventory.find(other.id)!.stock).toBe(0);
  });

  it('refuses a request that does not exist', () => {
    const { receive, stock } = setup();
    expect(receive(5, '2026-03-01', 'pr-missing').allowed).toBe(false);
    expect(stock()).toBe(0);
  });

  it('accepts a quality-approved request', () => {
    const { receive, purchase, stock } = setup();
    expect(receive(5, '2026-03-01', purchase('passed')).allowed).toBe(true);
    expect(stock()).toBe(5);
  });
});

describe('supplier quotation values', () => {
  const quote = {
    supplierId: 's-1',
    unitPrice: 10,
    leadTimeDays: 3,
    shippingCost: 0,
    channel: 'email' as const,
    receivedAt: null,
    validUntil: null,
    paymentTerms: '',
    warranty: '',
    note: '',
  };

  it.each([
    { unitPrice: -5 },
    { unitPrice: 0 },
    { unitPrice: NaN },
    { shippingCost: -1 },
    { leadTimeDays: -2 },
    { leadTimeDays: 1.5 },
  ])('refuses %o', (bad) => {
    const { purchases, purchase } = setup();
    const id = purchase(null);
    expect(purchases.addQuote(id, { ...quote, ...bad }).allowed).toBe(false);
    expect(purchases.find(id)!.quotes).toHaveLength(0);
  });

  it('does not let an edit turn a valid price negative', () => {
    const { purchases, purchase } = setup();
    const id = purchase(null);
    expect(purchases.addQuote(id, quote).allowed).toBe(true);
    const quoteId = purchases.find(id)!.quotes[0].id;
    expect(purchases.updateQuote(id, quoteId, { unitPrice: -1 }).allowed).toBe(false);
    expect(purchases.find(id)!.quotes[0].unitPrice).toBe(10);
  });
});
