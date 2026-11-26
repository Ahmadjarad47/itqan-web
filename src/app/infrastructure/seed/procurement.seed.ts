import { BomNode, ContactChannel, EntityId, IsoDate, PurchasePriority, PurchaseRequest, SupplierContact, SupplierQuote } from '@domain/models';
import { addDays, createPurchaseStages, DEFAULT_CRITERIA } from '@domain/rules';
import { nodeId } from './projects.seed';

interface PurchaseSpec {
  /** Number of completed stages, in flow order. */
  readonly done: number;
  readonly quotes?: readonly (readonly [supplierId: string, price: number, leadDays: number])[];
  readonly qualityFailed?: boolean;
  readonly etaOffset?: number;
  readonly priority?: PurchasePriority;
}

const SPECS: Record<string, PurchaseSpec> = {
  'ATL-1.1.3': { done: 10, quotes: [['s-6', 14, 7], ['s-1', 16, 5]] },
  'ATL-1.3': { done: 8, quotes: [['s-6', 65, 6], ['s-1', 72, 4]], etaOffset: -2 },
  'ATL-2.2.1': { done: 6, quotes: [['s-8', 85, 18], ['s-1', 92, 12], ['s-4', 99, 20]], etaOffset: 6, priority: 'high' },
  'ATL-2.2.3': { done: 6, quotes: [['s-4', 120, 15], ['s-3', 131, 10]], etaOffset: -4, priority: 'urgent' },
  'ATL-2.3': { done: 4, quotes: [['s-5', 1450, 30], ['s-8', 1390, 45], ['s-3', 1520, 21]], priority: 'high' },
  'ATL-2.4': { done: 3, quotes: [['s-3', 210, 14]] },
  'ATL-3.1': { done: 9, quotes: [['s-2', 380, 10], ['s-9', 365, 14]], qualityFailed: true, etaOffset: -6 },
  'ATL-3.2': { done: 7, quotes: [['s-3', 1250, 21], ['s-9', 1190, 28]], etaOffset: 9, priority: 'high' },
  'ATL-3.3': { done: 2 },
  'ATL-3.4': { done: 5, quotes: [['s-2', 290, 7], ['s-9', 305, 5]] },
  'ATL-4.1': { done: 1 },
  'ATL-4.2': { done: 3, quotes: [['s-4', 160, 12]] },
  'ATL-4.3': { done: 0 },
  'HP-2.2': { done: 5, quotes: [['s-5', 680, 25], ['s-8', 640, 30]], priority: 'high' },
  'HP-2.3': { done: 3, quotes: [['s-5', 140, 10]] },
  'HP-3.1': { done: 6, quotes: [['s-5', 890, 20], ['s-3', 940, 15]], etaOffset: 12 },
  'HP-3.2': { done: 2 },
  'HP-4.1': { done: 1, priority: 'urgent' },
  'HP-4.2': { done: 0 },
  'CV-2.3': { done: 0 },
  'CV-3': { done: 0 },
};

const CHANNELS: readonly ContactChannel[] = ['email', 'phone', 'whatsapp'];
const TERMS = ['30% مقدم والباقي عند التسليم', 'نقداً عند الاستلام', 'آجل 30 يوم'];

const DEFAULT_SCORES = [
  { price: 8, quality: 8, delivery: 7, reliability: 9 },
  { price: 7, quality: 7, delivery: 8, reliability: 6 },
  { price: 6, quality: 9, delivery: 5, reliability: 7 },
];

function buildRequest(
  id: string,
  number: string,
  base: Pick<PurchaseRequest, 'title' | 'projectId' | 'nodeId' | 'quantity' | 'unit'> & Partial<Pick<PurchaseRequest, 'materialId' | 'warehouseId'>>,
  spec: PurchaseSpec,
  today: IsoDate,
): PurchaseRequest {
  const start = addDays(today, -(spec.done * 3 + 2));
  const researchDays = 2 + (spec.quotes?.length ?? 1) * 2;
  const stages = createPurchaseStages().map((stage, index) => {
    const date = addDays(start, index * 3);
    const startDate = stage.key === 'marketResearch' && index <= spec.done ? addDays(date, -researchDays) : null;
    return index < spec.done ? { ...stage, done: true, date, startDate } : { ...stage, startDate };
  });
  const contactedAt = addDays(start, 6);
  const contacts: SupplierContact[] = (spec.done >= 2 ? (spec.quotes ?? []) : []).map(([supplierId], index) => ({
    id: `${id}-c${index + 1}`,
    supplierId,
    contactedAt,
    channel: CHANNELS[index % CHANNELS.length],
    expectedReplyDate: addDays(contactedAt, 3 + index),
    note: index === 0 ? 'أُرسلت المخططات الفنية مع طلب التسعير' : '',
    replied: spec.done >= 3,
  }));
  const quotes: SupplierQuote[] = (spec.done >= 3 ? (spec.quotes ?? []) : []).map(([supplierId, unitPrice, leadTimeDays], index) => ({
    id: `${id}-q${index + 1}`,
    supplierId,
    unitPrice,
    leadTimeDays,
    note: '',
    receivedAt: addDays(contactedAt, 2 + index),
    channel: CHANNELS[index % CHANNELS.length],
    shippingCost: index * 40,
    paymentTerms: TERMS[index % TERMS.length],
    warranty: index % 2 ? '6 أشهر' : '12 شهراً',
    validUntil: addDays(today, 20 + index * 5),
  }));
  const scores: Record<EntityId, Record<EntityId, number>> = {};
  if (spec.done >= 4) {
    quotes.forEach((quote, index) => (scores[quote.id] = { ...DEFAULT_SCORES[index % DEFAULT_SCORES.length] }));
  }
  const selected = spec.done >= 5 ? quotes[0] : undefined;
  const qualityRecorded = spec.done >= 9;
  return {
    id,
    number,
    materialId: null,
    warehouseId: null,
    ...base,
    priority: spec.priority ?? 'normal',
    supplierId: selected?.supplierId ?? null,
    unitPrice: selected?.unitPrice ?? null,
    stages,
    contacts,
    quotes,
    mcdm: { criteria: [...DEFAULT_CRITERIA], scores },
    eta: spec.done >= 6 ? addDays(today, spec.etaOffset ?? 10) : null,
    revisedEta: null,
    qualityResult: qualityRecorded ? (spec.qualityFailed ? 'failed' : 'passed') : null,
    correctiveAction: spec.qualityFailed ? 'إعادة الخزانة للمورد لوجود خدوش في الطلاء وطلب بديل' : '',
    createdAt: start,
  };
}

export function seedPurchases(today: IsoDate, nodes: readonly BomNode[], productionQuantities: ReadonlyMap<EntityId, number>): PurchaseRequest[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const perEndProduct = (node: BomNode): number => {
    let total = 1;
    let current: BomNode | undefined = node;
    while (current?.parentId) {
      total *= current.quantity;
      current = byId.get(current.parentId);
    }
    return total;
  };

  const linked = Object.entries(SPECS).map(([code, spec], index) => {
    const node = byId.get(nodeId(code))!;
    const quantity = perEndProduct(node) * (productionQuantities.get(node.projectId) ?? 1);
    return buildRequest(
      `pr-${code}`,
      `PR-2026-${String(index + 1).padStart(3, '0')}`,
      { title: node.name, projectId: node.projectId, nodeId: node.id, quantity, unit: node.unit },
      spec,
      today,
    );
  });

  const standalone = buildRequest(
    'pr-standalone-1',
    `PR-2026-${String(linked.length + 1).padStart(3, '0')}`,
    { title: 'معدات وقاية شخصية لورشة اللحام', projectId: null, nodeId: null, quantity: 20, unit: 'set' },
    { done: 6, quotes: [['s-1', 38, 7], ['s-6', 35, 10]], etaOffset: 3 },
    today,
  );

  // Warehouse supply requests (طلبات توريد للمستودعات) linked to product cards.
  const supply = [
    buildRequest(
      'pr-supply-1',
      `PR-2026-${String(linked.length + 2).padStart(3, '0')}`,
      { title: 'ألمنيوم 6061 مسحوب', projectId: null, nodeId: null, quantity: 150, unit: 'kg', materialId: 'm-AL6061', warehouseId: 'wh-metals' },
      { done: 9, quotes: [['s-1', 5.8, 8], ['s-8', 6.1, 6]], etaOffset: -1, priority: 'high' },
      today,
    ),
    buildRequest(
      'pr-supply-2',
      `PR-2026-${String(linked.length + 3).padStart(3, '0')}`,
      { title: 'قرص رفراف 125 مم', projectId: null, nodeId: null, quantity: 100, unit: 'pcs', materialId: 'm-FLAP-125', warehouseId: 'wh-consumables' },
      { done: 3, quotes: [['s-6', 2.6, 5]] },
      today,
    ),
  ];

  return [...linked, standalone, ...supply];
}
