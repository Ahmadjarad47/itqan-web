import { EntityId, McdmCriterion, McdmMatrix, SupplierQuote } from '../models';

export const DEFAULT_CRITERIA: readonly McdmCriterion[] = [
  { id: 'price', name: 'السعر', weight: 35 },
  { id: 'quality', name: 'الجودة', weight: 30 },
  { id: 'delivery', name: 'مدة التوريد', weight: 20 },
  { id: 'reliability', name: 'موثوقية المورد', weight: 15 },
];

export interface McdmScore {
  readonly quoteId: EntityId;
  /** Weighted score normalised to 0..100. */
  readonly score: number;
  readonly rank: number;
}

/** Weighted-sum model (WSM) over criteria scored 1..10. */
export function evaluateMcdm(matrix: McdmMatrix, quotes: readonly SupplierQuote[]): McdmScore[] {
  const totalWeight = matrix.criteria.reduce((sum, criterion) => sum + criterion.weight, 0) || 1;
  const scored = quotes.map((quote) => {
    const row = matrix.scores[quote.id] ?? {};
    const weighted = matrix.criteria.reduce(
      (sum, criterion) => sum + criterion.weight * ((row[criterion.id] ?? 0) / 10),
      0,
    );
    return { quoteId: quote.id, score: (weighted / totalWeight) * 100 };
  });
  const ordered = [...scored].sort((a, b) => b.score - a.score);
  return scored.map((item) => ({ ...item, rank: ordered.findIndex((o) => o.quoteId === item.quoteId) + 1 }));
}
