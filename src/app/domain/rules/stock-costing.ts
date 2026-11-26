import { CostMethod, IsoDate, Material, ProfitMargin, StockLocation, StockMovement } from '../models';

/** A purchase batch still (partly) on hand. */
export interface CostLot {
  readonly date: IsoDate;
  readonly quantity: number;
  readonly unitCost: number;
  readonly expiryDate: IsoDate | null;
  readonly reference: string;
}

/** One line of the item history with running balances, as in the SRS table. */
export interface LedgerRow {
  readonly movement: StockMovement;
  /** Signed quantity. */
  readonly quantity: number;
  /** Purchase price (incoming), selling price or cost (outgoing). */
  readonly unitPrice: number | null;
  readonly amount: number | null;
  /** Cost charged to the outgoing quantity (cost of goods issued). */
  readonly issuedCost: number | null;
  readonly balanceQty: number;
  readonly averageCost: number;
  readonly balanceValue: number;
}

export interface Ledger {
  readonly rows: readonly LedgerRow[];
  readonly quantity: number;
  readonly value: number;
  /** Cost of the next unit according to the valuation method. */
  readonly unitCost: number;
  readonly averageCost: number;
  readonly lots: readonly CostLot[];
}

const round = (value: number, digits = 4) => Math.round(value * 10 ** digits) / 10 ** digits;

export function movementDate(movement: Pick<StockMovement, 'date' | 'at'>): IsoDate {
  return movement.date || movement.at.slice(0, 10);
}

export function compareMovements(a: StockMovement, b: StockMovement): number {
  return movementDate(a).localeCompare(movementDate(b)) || a.at.localeCompare(b.at);
}

/** Removes `quantity` from the oldest lots first and returns the cost taken out. */
export function consumeFifo(lots: readonly CostLot[], quantity: number): { cost: number; lots: CostLot[] } {
  let remaining = quantity;
  let cost = 0;
  const next: CostLot[] = [];
  for (const lot of lots) {
    if (remaining <= 0) {
      next.push(lot);
      continue;
    }
    const taken = Math.min(lot.quantity, remaining);
    cost += taken * lot.unitCost;
    remaining -= taken;
    if (lot.quantity - taken > 0) next.push({ ...lot, quantity: lot.quantity - taken });
  }
  // Issuing more than the recorded batches: price the excess at the last known cost.
  if (remaining > 0) cost += remaining * (lots.at(-1)?.unitCost ?? 0);
  return { cost, lots: next };
}

/**
 * Replays the item movements chronologically and values the stock with FIFO or the
 * weighted average cost. Transfers move quantities between locations only.
 */
export function buildLedger(movements: readonly StockMovement[], method: CostMethod, fallbackCost = 0): Ledger {
  let lots: CostLot[] = [];
  let quantity = 0;
  let value = 0;
  let lastCost = fallbackCost;
  const rows: LedgerRow[] = [];

  for (const movement of [...movements].sort(compareMovements)) {
    const date = movementDate(movement);
    const qty = movement.quantity;
    let unitPrice: number | null = null;
    let amount: number | null = null;
    let issuedCost: number | null = null;

    if (movement.type === 'transfer') {
      // Neutral for valuation; shown in the history for traceability.
    } else if (qty > 0) {
      const price = movement.unitCost ?? (quantity > 0 ? value / quantity : lastCost);
      lots.push({ date, quantity: qty, unitCost: price, expiryDate: movement.expiryDate ?? null, reference: movement.documentNo || movement.reference });
      quantity += qty;
      value += qty * price;
      lastCost = price;
      unitPrice = price;
      amount = qty * price;
    } else if (qty < 0) {
      const out = Math.abs(qty);
      const average = quantity > 0 ? value / quantity : lastCost;
      const fifo = consumeFifo(lots, out);
      lots = fifo.lots;
      const cost = method === 'fifo' ? fifo.cost : out * average;
      issuedCost = cost;
      quantity = Math.max(0, quantity - out);
      value = quantity > 0 ? Math.max(0, value - cost) : 0;
      if (method === 'average') {
        // Batches stay FIFO for expiry tracking but are revalued at the average cost.
        const avg = quantity > 0 ? value / quantity : average;
        lots = lots.map((lot) => ({ ...lot, unitCost: avg }));
      }
      unitPrice = movement.sellPrice ?? cost / out;
      amount = movement.sellPrice !== null && movement.sellPrice !== undefined ? movement.sellPrice * out : cost;
    }

    rows.push({
      movement,
      quantity: qty,
      unitPrice,
      amount,
      issuedCost,
      balanceQty: round(quantity),
      averageCost: quantity > 0 ? value / quantity : lastCost,
      balanceValue: round(value, 2),
    });
  }

  const averageCost = quantity > 0 ? value / quantity : lastCost;
  const unitCost = method === 'fifo' ? (lots[0]?.unitCost ?? lastCost) : averageCost;
  return { rows, quantity, value, unitCost, averageCost, lots };
}

/** Cost of issuing `quantity` now, without recording anything. */
export function previewIssueCost(ledger: Ledger, method: CostMethod, quantity: number): number {
  if (method === 'average') return quantity * ledger.averageCost;
  return consumeFifo(ledger.lots, quantity).cost;
}

/** Selling price = unit cost + profit margin (fixed amount or percentage). */
export function sellingPrice(unitCost: number, margin: ProfitMargin): number {
  return margin.type === 'percent' ? unitCost * (1 + margin.value / 100) : unitCost + margin.value;
}

/** Adds a signed delta to one location; empty locations are dropped unless designated (qty 0 kept on create). */
export function adjustLocations(
  locations: readonly StockLocation[],
  warehouseId: string,
  shelfId: string | null,
  delta: number,
): StockLocation[] {
  const index = locations.findIndex((l) => l.warehouseId === warehouseId && l.shelfId === shelfId);
  if (index === -1) {
    return delta > 0 ? [...locations, { warehouseId, shelfId, quantity: delta }] : [...locations];
  }
  return locations.map((l, i) => (i === index ? { ...l, quantity: Math.max(0, round(l.quantity + delta)) } : l));
}

/** Takes an outgoing quantity from the fullest locations first (when no location is given). */
export function deductAnywhere(locations: readonly StockLocation[], quantity: number): StockLocation[] {
  let remaining = quantity;
  const order = [...locations.keys()].sort((a, b) => locations[b].quantity - locations[a].quantity);
  const next = [...locations];
  for (const i of order) {
    if (remaining <= 0) break;
    const taken = Math.min(next[i].quantity, remaining);
    next[i] = { ...next[i], quantity: round(next[i].quantity - taken) };
    remaining -= taken;
  }
  return next;
}

export function totalQuantity(locations: readonly StockLocation[]): number {
  return round(locations.reduce((sum, l) => sum + l.quantity, 0));
}

export function quantityIn(material: Material, warehouseIds: ReadonlySet<string> | null): number {
  if (!warehouseIds) return material.stock;
  return totalQuantity(material.locations.filter((l) => warehouseIds.has(l.warehouseId)));
}

export type StockLevel = 'empty' | 'low' | 'ok' | 'over';

export function stockLevel(stock: number, min: number, max: number): StockLevel {
  if (stock <= 0 && min > 0) return 'empty';
  if (min > 0 && stock < min) return 'low';
  if (max > 0 && stock > max) return 'over';
  return 'ok';
}

/** Suggested supply quantity to refill up to the maximum (or the minimum when no max). */
export function suggestedSupply(material: Material): number {
  const target = material.maxStock || material.minStock;
  return Math.max(0, round(target - material.stock, 2));
}

/** Builds the next code from the category and nature codes, e.g. `RAW-MEC-0007`. */
export function generateItemCode(prefixParts: readonly string[], existingCodes: readonly string[]): string {
  const prefix = prefixParts.filter(Boolean).join('-') || 'ITM';
  const taken = new Set(existingCodes.map((c) => c.toUpperCase()));
  let sequence = existingCodes.filter((c) => c.toUpperCase().startsWith(prefix + '-')).length + 1;
  let code = `${prefix}-${String(sequence).padStart(4, '0')}`;
  while (taken.has(code)) code = `${prefix}-${String(++sequence).padStart(4, '0')}`;
  return code;
}

/** Normalises Arabic/Latin text for duplicate detection. */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Similarity in [0, 1] between two item descriptions (shared word tokens). */
export function textSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeText(a).split(' ').filter((t) => t.length > 1));
  const tb = new Set(normalizeText(b).split(' ').filter((t) => t.length > 1));
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  ta.forEach((t) => {
    if (tb.has(t)) shared++;
  });
  return shared / Math.min(ta.size, tb.size);
}
