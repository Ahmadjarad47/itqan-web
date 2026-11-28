import { StockMovement } from '../models';
import { buildLedger, previewIssueCost } from './stock-costing';

const move = (id: string, day: number, quantity: number, unitCost: number | null): StockMovement => ({
  id,
  materialId: 'm',
  type: quantity > 0 ? 'receipt' : 'issue',
  quantity,
  reference: id,
  at: `2026-01-0${day}T08:00:00.000Z`,
  date: `2026-01-0${day}`,
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

describe('stock costing integrity', () => {
  const emptied = [move('in', 1, 10, 5), move('out', 2, -10, null)];

  it('prices a FIFO issue at the last known cost once the batches are used up', () => {
    const ledger = buildLedger([...emptied, move('extra', 3, -5, null)], 'fifo');
    expect(ledger.rows[2].issuedCost).toBe(25);
  });

  it('previews a FIFO issue on empty stock at the last known cost', () => {
    expect(previewIssueCost(buildLedger(emptied, 'fifo'), 'fifo', 5)).toBe(25);
  });

  it('leaves no ghost batch behind fractional quantities', () => {
    const history = [move('a', 1, 0.1, 10), move('b', 2, 0.2, 20), move('c', 3, -0.3, null)];
    const emptiedLedger = buildLedger(history, 'fifo');
    expect(emptiedLedger.quantity).toBe(0);
    expect(emptiedLedger.lots).toHaveLength(0);
    expect(buildLedger([...history, move('d', 4, 5, 30)], 'fifo').unitCost).toBe(30);
  });
});
