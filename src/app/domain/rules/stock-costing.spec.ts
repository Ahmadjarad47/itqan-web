import { StockMovement } from '../models';
import { buildLedger, generateItemCode, sellingPrice, stockLevel, textSimilarity } from './stock-costing';

const move = (id: string, date: string, quantity: number, unitCost: number | null, type: StockMovement['type'] = quantity > 0 ? 'receipt' : 'issue'): StockMovement => ({
  id,
  materialId: 'm',
  type,
  quantity,
  reference: id,
  at: `${date}T08:00:00.000Z`,
  date,
  warehouseId: 'w',
  shelfId: null,
  unitCost,
  sellPrice: null,
  source: null,
  documentNo: '',
  supplierId: null,
  purchaseId: null,
  requisitionId: null,
  expiryDate: null,
  transferId: null,
  attachments: [],
});

// The SRS example: 100 × 50, 50 × 60, then 120 units sold.
const srs = [move('p1', '2024-01-01', 100, 50), move('p2', '2024-02-10', 50, 60), move('s1', '2024-03-15', -120, null)];

describe('stock costing (SRS examples)', () => {
  it('FIFO charges the oldest batch first', () => {
    const ledger = buildLedger(srs, 'fifo');
    expect(ledger.rows[2].issuedCost).toBe(6200);
    expect(ledger.quantity).toBe(30);
    expect(ledger.value).toBe(1800);
    expect(ledger.unitCost).toBe(60);
  });

  it('weighted average uses one average cost', () => {
    const ledger = buildLedger(srs, 'average');
    expect(ledger.rows[1].averageCost).toBeCloseTo(53.33, 2);
    expect(ledger.rows[2].issuedCost).toBeCloseTo(6400, 0);
    expect(ledger.quantity).toBe(30);
    expect(ledger.value).toBeCloseTo(1600, 0);
  });

  it('transfers do not change valuation', () => {
    const ledger = buildLedger([...srs.slice(0, 2), move('t1', '2024-02-20', -20, null, 'transfer'), move('t2', '2024-02-20', 20, null, 'transfer')], 'average');
    expect(ledger.quantity).toBe(150);
    expect(ledger.value).toBe(8000);
  });

  it('selling price adds an amount or a percentage', () => {
    expect(sellingPrice(50, { type: 'percent', value: 20 })).toBe(60);
    expect(sellingPrice(50, { type: 'amount', value: 7 })).toBe(57);
  });

  it('classifies Min/Max levels', () => {
    expect(stockLevel(5, 10, 100)).toBe('low');
    expect(stockLevel(0, 10, 100)).toBe('empty');
    expect(stockLevel(150, 10, 100)).toBe('over');
    expect(stockLevel(50, 10, 100)).toBe('ok');
  });

  it('generates unique codes and detects similar names', () => {
    expect(generateItemCode(['RAW', 'MEC'], ['RAW-MEC-0001'])).toBe('RAW-MEC-0002');
    expect(textSimilarity('صاج فولاذي 3 مم', 'صاج فولاذي ST37 سماكة 3 مم')).toBeGreaterThan(0.6);
  });
});
