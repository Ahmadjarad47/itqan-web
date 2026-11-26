import { CatalogOption, IsoDate, Material, PurchaseRequest, Requisition, StockLocation, StockMovement, Warehouse } from '@domain/models';
import { addDays, buildLedger, totalQuantity } from '@domain/rules';

const shelves = (warehouseId: string, prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `${warehouseId}-s${i + 1}`, code: `${prefix}-${String(i + 1).padStart(2, '0')}`, name: '' }));

export function seedWarehouses(today: IsoDate): Warehouse[] {
  const created = addDays(today, -150);
  const base = { managerId: 'u-store', createdAt: created };
  return [
    { ...base, id: 'wh-main', code: 'WH-MAIN', name: 'المستودع الرئيسي', address: 'المنطقة الصناعية بعدرا - البوابة 2', phones: '+963 11 555 0200', parentId: null, shelves: shelves('wh-main', 'A', 4) },
    { ...base, id: 'wh-metals', code: 'WH-MET', name: 'مستودع المعادن', address: 'المستودع الرئيسي - الجناح الشرقي', phones: '+963 11 555 0201', parentId: 'wh-main', shelves: shelves('wh-metals', 'MET', 6) },
    { ...base, id: 'wh-consumables', code: 'WH-CON', name: 'مستودع المستهلكات', address: 'المستودع الرئيسي - الجناح الغربي', phones: '+963 11 555 0202', parentId: 'wh-main', shelves: shelves('wh-consumables', 'CON', 4) },
    { ...base, id: 'wh-purchased', code: 'WH-PRC', name: 'مستودع الأجزاء المشتراة', address: 'المستودع الرئيسي - منطقة الاستلام', phones: '+963 11 555 0203', parentId: 'wh-main', shelves: shelves('wh-purchased', 'PRC', 3) },
    { ...base, id: 'wh-electrical', code: 'WH-ELC', name: 'مستودع الكهرباء', address: 'مبنى الأتمتة - الطابق الأرضي', phones: '+963 11 555 0210', parentId: null, shelves: shelves('wh-electrical', 'ELC', 3) },
    { ...base, id: 'wh-hydraulic', code: 'WH-HYD', name: 'مستودع الهيدروليك', address: 'مبنى الأتمتة - الملحق الخلفي', phones: '+963 11 555 0211', parentId: 'wh-electrical', shelves: shelves('wh-hydraulic', 'HYD', 2) },
  ];
}

export const CATALOG_OPTIONS: CatalogOption[] = [
  { id: 'opt-cat-tools', list: 'category', name: 'أدوات', code: 'TLS' },
  { id: 'opt-cat-raw', list: 'category', name: 'مواد أولية', code: 'RAW' },
  { id: 'opt-cat-semi', list: 'category', name: 'مواد نصف مصنعة', code: 'SEM' },
  { id: 'opt-cat-supplies', list: 'category', name: 'مستلزمات', code: 'SUP' },
  { id: 'opt-cat-purchased', list: 'category', name: 'قطع مشتراة', code: 'PRC' },
  { id: 'opt-nat-mech', list: 'nature', name: 'ميكانيكية', code: 'MEC' },
  { id: 'opt-nat-elec', list: 'nature', name: 'كهربائية', code: 'ELC' },
  { id: 'opt-nat-admin', list: 'nature', name: 'إدارية', code: 'ADM' },
  { id: 'opt-nat-chem', list: 'nature', name: 'كيميائية', code: 'CHM' },
  { id: 'opt-nat-hyd', list: 'nature', name: 'هيدروليكية', code: 'HYD' },
];

interface CardSpec {
  readonly category: string;
  readonly nature: string;
  readonly locations: readonly (readonly [warehouseId: string, shelf: number, quantity: number])[];
  readonly max: number;
  readonly method: Material['costMethod'];
  readonly margin: number;
  /** No outgoing movement for a long time (stagnant item). */
  readonly idle?: boolean;
  readonly expiry?: readonly [firstLot: number | null, secondLot: number | null];
}

const CARDS: Record<string, CardSpec> = {
  'ST37-10': { category: 'opt-cat-raw', nature: 'opt-nat-mech', locations: [['wh-metals', 1, 2000], ['wh-main', 1, 400]], max: 4000, method: 'fifo', margin: 15 },
  'ST37-3': { category: 'opt-cat-raw', nature: 'opt-nat-mech', locations: [['wh-metals', 2, 1350]], max: 2500, method: 'fifo', margin: 15 },
  'SS304-2': { category: 'opt-cat-raw', nature: 'opt-nat-mech', locations: [['wh-metals', 3, 320]], max: 600, method: 'fifo', margin: 20, idle: true },
  'PRF-80': { category: 'opt-cat-semi', nature: 'opt-nat-mech', locations: [['wh-metals', 4, 140]], max: 300, method: 'fifo', margin: 15 },
  'PRF-40': { category: 'opt-cat-semi', nature: 'opt-nat-mech', locations: [['wh-metals', 4, 160], ['wh-main', 2, 60]], max: 400, method: 'fifo', margin: 15 },
  'C45-50': { category: 'opt-cat-raw', nature: 'opt-nat-mech', locations: [['wh-metals', 5, 610]], max: 1000, method: 'average', margin: 12 },
  AL6061: { category: 'opt-cat-raw', nature: 'opt-nat-mech', locations: [['wh-metals', 6, 95]], max: 300, method: 'average', margin: 18 },
  'CBL-2.5': { category: 'opt-cat-raw', nature: 'opt-nat-elec', locations: [['wh-electrical', 1, 900]], max: 1500, method: 'average', margin: 20 },
  'HOSE-12': { category: 'opt-cat-raw', nature: 'opt-nat-hyd', locations: [['wh-hydraulic', 1, 45]], max: 120, method: 'average', margin: 20, idle: true },
  'SAND-80': { category: 'opt-cat-supplies', nature: 'opt-nat-mech', locations: [['wh-consumables', 1, 380]], max: 800, method: 'average', margin: 25 },
  'FLAP-125': { category: 'opt-cat-supplies', nature: 'opt-nat-mech', locations: [['wh-consumables', 1, 42]], max: 200, method: 'average', margin: 25 },
  'CUT-115': { category: 'opt-cat-tools', nature: 'opt-nat-mech', locations: [['wh-consumables', 2, 210]], max: 400, method: 'average', margin: 25 },
  'WIRE-08': { category: 'opt-cat-supplies', nature: 'opt-nat-mech', locations: [['wh-consumables', 3, 160]], max: 300, method: 'fifo', margin: 20 },
  'GAS-MIX': { category: 'opt-cat-supplies', nature: 'opt-nat-chem', locations: [['wh-consumables', 4, 12000]], max: 10000, method: 'average', margin: 10, expiry: [-4, 200] },
  'PAINT-01': { category: 'opt-cat-supplies', nature: 'opt-nat-chem', locations: [['wh-consumables', 4, 75]], max: 150, method: 'fifo', margin: 22, expiry: [18, 160] },
};

const SUPPLIER_BY_NATURE: Record<string, string> = {
  'opt-nat-mech': 's-1',
  'opt-nat-elec': 's-2',
  'opt-nat-hyd': 's-5',
  'opt-nat-chem': 's-7',
};

const movementBase = {
  shelfId: null,
  sellPrice: null,
  source: null,
  documentNo: '',
  supplierId: null,
  purchaseId: null,
  requisitionId: null,
  expiryDate: null,
  transferId: null,
  attachments: [],
} satisfies Partial<StockMovement>;

/** Turns the catalog materials into full product cards with a realistic movement history. */
export function seedInventory(
  today: IsoDate,
  materials: readonly Material[],
  received: readonly PurchaseRequest[],
  purchasedCodes: ReadonlyMap<string, string>,
): { materials: Material[]; movements: StockMovement[] } {
  const movements: StockMovement[] = [];
  const cards: Material[] = [];
  let n = 0;
  const push = (m: Omit<StockMovement, 'id' | 'at'>) => {
    n++;
    movements.push({ ...m, id: `mv-${n}`, at: `${m.date}T0${7 + (n % 3)}:00:00.000Z` });
  };

  materials.forEach((material, index) => {
    const spec = CARDS[material.code];
    if (!spec) return;
    const locations: StockLocation[] = spec.locations.map(([warehouseId, shelf, quantity]) => ({ warehouseId, shelfId: `${warehouseId}-s${shelf}`, quantity }));
    const supplierId = SUPPLIER_BY_NATURE[spec.nature] ?? 's-6';
    const issued = spec.idle ? 0 : Math.round(locations[0].quantity * 0.35);
    locations.forEach((location, li) => {
      const total = location.quantity + (li === 0 ? issued : 0);
      const first = Math.round(total * 0.6);
      const common = { ...movementBase, materialId: material.id, type: 'receipt' as const, warehouseId: location.warehouseId, shelfId: location.shelfId, supplierId };
      push({
        ...common,
        quantity: first,
        date: addDays(today, -110 + li),
        unitCost: +(material.unitCost * 0.95).toFixed(3),
        source: 'invoice',
        documentNo: `INV-${2400 + index * 2}`,
        reference: `فاتورة شراء INV-${2400 + index * 2}`,
        expiryDate: spec.expiry?.[0] != null ? addDays(today, spec.expiry[0]) : null,
      });
      push({
        ...common,
        quantity: total - first,
        date: addDays(today, spec.idle ? -105 : -48 + li),
        unitCost: +(material.unitCost * 1.05).toFixed(3),
        source: 'invoice',
        documentNo: `INV-${2401 + index * 2}`,
        reference: `فاتورة شراء INV-${2401 + index * 2}`,
        expiryDate: spec.expiry?.[1] != null ? addDays(today, spec.expiry[1]) : null,
      });
    });
    if (issued) {
      const location = locations[0];
      const firstOut = Math.round(issued * 0.6);
      [
        [firstOut, -20, 'MR-2026-001'],
        [issued - firstOut, -4, 'MR-2026-004'],
      ].forEach(([quantity, offset, doc]) =>
        push({
          ...movementBase,
          materialId: material.id,
          type: 'issue',
          quantity: -(quantity as number),
          date: addDays(today, offset as number),
          warehouseId: location.warehouseId,
          shelfId: location.shelfId,
          unitCost: null,
          documentNo: doc as string,
          reference: `طلب احتياج ${doc}`,
        }),
      );
    }
    const card: Material = {
      ...material,
      maxStock: spec.max,
      categoryId: spec.category,
      natureId: spec.nature,
      costMethod: spec.method,
      margin: { type: 'percent', value: spec.margin },
      locations,
      stock: totalQuantity(locations),
      specFiles: [],
      notes: '',
      createdAt: addDays(today, -120),
    };
    cards.push(card);
  });

  // Parts received through completed purchase requests.
  received.forEach((request) => {
    const code = purchasedCodes.get(request.id) ?? request.number;
    const location: StockLocation = { warehouseId: 'wh-purchased', shelfId: 'wh-purchased-s1', quantity: request.quantity };
    const date = request.stages.find((s) => s.key === 'warehouseReceipt')?.date ?? today;
    const id = `m-${request.id}`;
    push({
      ...movementBase,
      materialId: id,
      type: 'receipt',
      quantity: request.quantity,
      date,
      warehouseId: location.warehouseId,
      shelfId: location.shelfId,
      unitCost: request.unitPrice ?? 0,
      source: 'supply',
      documentNo: request.number,
      reference: `طلب توريد ${request.number}`,
      supplierId: request.supplierId,
      purchaseId: request.id,
    });
    cards.push({
      id,
      code,
      name: request.title,
      kind: 'purchased',
      unit: request.unit,
      unitCost: request.unitPrice ?? 0,
      stock: request.quantity,
      minStock: 0,
      maxStock: 0,
      categoryId: 'opt-cat-purchased',
      natureId: 'opt-nat-mech',
      costMethod: 'average',
      margin: { type: 'percent', value: 0 },
      locations: [location],
      specFiles: [],
      notes: '',
      createdAt: date,
    });
  });

  // Price each issue and refresh the card cost exactly as the live store does.
  const byMaterial = new Map<string, StockMovement[]>();
  movements.forEach((m) => byMaterial.set(m.materialId, [...(byMaterial.get(m.materialId) ?? []), m]));
  const priced = new Map<string, number>();
  const finalCards = cards.map((card) => {
    const ledger = buildLedger(byMaterial.get(card.id) ?? [], card.costMethod, card.unitCost);
    ledger.rows.forEach((row) => {
      if (row.issuedCost !== null) priced.set(row.movement.id, row.issuedCost / Math.abs(row.quantity));
    });
    return { ...card, unitCost: Math.round(ledger.unitCost * 10000) / 10000 };
  });
  return {
    materials: finalCards,
    movements: movements.map((m) => (priced.has(m.id) ? { ...m, unitCost: priced.get(m.id)! } : m)),
  };
}

export function seedRequisitions(today: IsoDate): Requisition[] {
  const line = (id: string, materialId: string, quantity: number, note = '') => ({ id, materialId, quantity, note });
  return [
    {
      id: 'rq-1', number: 'MR-2026-005', origin: 'system', departmentId: 'd-welding', requester: 'خالد الشامي', projectId: 'p-atl',
      requestDate: addDays(today, -1), dueDate: addDays(today, 2), warehouseId: 'wh-consumables', status: 'new', notes: 'لخط لحام الإطارات',
      lines: [line('rl-1', 'm-WIRE-08', 20), line('rl-2', 'm-FLAP-125', 15, 'حبيبات 60 إن توفرت'), line('rl-3', 'm-CUT-115', 30)], deliveredAt: null,
    },
    {
      id: 'rq-2', number: 'MR-2026-006', origin: 'system', departmentId: 'd-laser', requester: 'أحمد الخطيب', projectId: 'p-hp',
      requestDate: addDays(today, -2), dueDate: addDays(today, 1), warehouseId: 'wh-metals', status: 'preparing', notes: '',
      lines: [line('rl-4', 'm-ST37-3', 200, 'ألواح كاملة بدون قص'), line('rl-5', 'm-ST37-10', 300)], deliveredAt: null,
    },
    {
      id: 'rq-3', number: 'MR-2026-007', origin: 'system', departmentId: 'd-assembly', requester: 'عمر السيد', projectId: 'p-atl',
      requestDate: addDays(today, -5), dueDate: addDays(today, -1), warehouseId: 'wh-main', status: 'ready', notes: 'مطلوب قبل بدء التجميع',
      lines: [line('rl-6', 'm-PRF-40', 40), line('rl-7', 'm-PAINT-01', 10)], deliveredAt: null,
    },
    {
      id: 'rq-4', number: 'MR-2026-004', origin: 'system', departmentId: 'd-machining', requester: 'رامي حداد', projectId: 'p-hp',
      requestDate: addDays(today, -7), dueDate: addDays(today, -4), warehouseId: 'wh-metals', status: 'delivered', notes: '',
      lines: [line('rl-8', 'm-C45-50', 85)], deliveredAt: addDays(today, -4),
    },
  ];
}
