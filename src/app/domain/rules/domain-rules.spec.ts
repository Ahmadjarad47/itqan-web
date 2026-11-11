import { BomNode, CustomFieldDefinition, formatCustomValue, Material, missingRequiredFields, PurchaseRequest, RoutingOperation, Workstation } from '../models';
import { BomTree } from './bom-tree';
import { operationUnitCost, rollUpCost } from './cost-rollup';
import { evaluateMcdm } from './mcdm';
import { rollUpProgress } from './progress';
import { canToggleStage, createPurchaseStages, currentStageIndex, etaDelayDays, isContactOverdue, researchDays } from './purchase-flow';

const node = (id: string, parentId: string | null, extra: Partial<BomNode> = {}): BomNode => ({
  id,
  projectId: 'p',
  parentId,
  code: id,
  name: id,
  description: '',
  discipline: 'mechanical',
  ownerId: null,
  quantity: 1,
  unit: 'pcs',
  image: null,
  decision: 'make',
  purchaseUnitPrice: null,
  attachments: [],
  materials: [],
  createdAt: '2026-01-01',
  ...extra,
});

const op = (nodeId: string, extra: Partial<RoutingOperation> = {}): RoutingOperation => ({
  id: `op-${nodeId}`,
  nodeId,
  sequence: 10,
  name: 'op',
  description: '',
  location: 'internal',
  subcontractor: '',
  externalUnitCost: 0,
  workstationId: 'ws',
  departmentId: null,
  companyHourlyRate: 0,
  inputs: [],
  earliestStart: '2026-01-01',
  latestFinish: '2026-01-02',
  plannedHours: 1,
  actualHours: 0,
  setupMinutes: 60,
  runMinutesPerUnit: 30,
  consumables: [],
  instructions: '',
  completed: false,
  onTime: true,
  actualFinish: null,
  delayReason: '',
  progressMode: 'percent',
  progressPercent: 0,
  completedQuantity: 0,
  qcStatus: 'pending',
  qcNote: '',
  reworkSequence: null,
  consumablesPosted: false,
  ...extra,
});

const steel: Material = {
  id: 'm',
  code: 'M',
  name: 'steel',
  kind: 'raw',
  unit: 'kg',
  unitCost: 2,
  stock: 0,
  minStock: 0,
  warehouse: 'w',
};

const workstation: Workstation = { id: 'ws', code: 'WS', name: 'ws', hourlyRate: 60, departmentId: 'd' };

describe('BomTree', () => {
  it('derives unlimited levels and cumulative quantities', () => {
    const tree = new BomTree([
      node('root', null),
      node('a', 'root', { quantity: 2 }),
      node('b', 'a', { quantity: 3 }),
      node('c', 'b', { quantity: 4 }),
    ]);
    expect(tree.level('c')).toBe(3);
    expect(tree.quantityPerEndProduct('c')).toBe(24);
    expect(tree.path('c').map((n) => n.id)).toEqual(['root', 'a', 'b', 'c']);
  });
});

describe('rollUpCost', () => {
  const nodes = [
    node('root', null),
    node('frame', 'root', { quantity: 2, materials: [{ materialId: 'm', quantity: 5 }] }),
    node('bolt', 'root', { quantity: 10, decision: 'buy', purchaseUnitPrice: 1.5 }),
  ];
  const context = (materialCost = 2) => ({
    tree: new BomTree(nodes),
    operationsByNode: new Map([['frame', [op('frame')]]]),
    materials: new Map([['m', { ...steel, unitCost: materialCost }]]),
    workstations: new Map([['ws', workstation]]),
    productionQuantity: 1,
  });

  it('aggregates material and operation costs bottom-up', () => {
    // frame: 5 kg × 2 = 10 material; op: setup 60/60×60 / lot(2) = 30 + run 30/60×60 = 30 → 60.
    const root = rollUpCost('root', context());
    const frame = root.children.find((c) => c.nodeId === 'frame')!;
    expect(frame.unitCost).toBe(70);
    expect(frame.extendedCost).toBe(140);
    expect(root.unitCost).toBe(140 + 15);
  });

  it('costs labour according to where the operation is executed', () => {
    const materials = new Map([['m', steel]]);
    // Factory floor: setup 60′ at 60/h over a lot of 2 = 30, plus run 30′ = 30.
    expect(operationUnitCost(op('x'), workstation, materials, 2).labor).toBe(60);
    // Inside the company: planned hours × hourly rate, spread over the lot.
    expect(operationUnitCost(op('x', { location: 'company', plannedHours: 4, companyHourlyRate: 20 }), workstation, materials, 2).labor).toBe(40);
    // Subcontractor: no internal labour, only the external unit cost.
    const external = operationUnitCost(op('x', { location: 'external', externalUnitCost: 12 }), workstation, materials, 2);
    expect(external.labor).toBe(0);
    expect(external.subcontract).toBe(12);
  });

  it('propagates a raw material price change up to level 0', () => {
    expect(rollUpCost('root', context(3)).unitCost - rollUpCost('root', context(2)).unitCost).toBe(10);
  });
});

describe('rollUpProgress', () => {
  it('reflects operation progress on the component and then on its parents', () => {
    const tree = new BomTree([node('root', null), node('a', 'root'), node('b', 'root', { decision: 'buy' })]);
    const progress = rollUpProgress('root', {
      tree,
      operationsByNode: new Map([['a', [op('a', { progressPercent: 80 })]]]),
      purchaseProgressByNode: new Map([['b', 40]]),
      productionQuantity: 1,
    });
    expect(progress.get('a')).toBe(80);
    expect(progress.get('root')).toBe(60);
  });
});

describe('purchase flow', () => {
  const request = (done: number, extra: Partial<PurchaseRequest> = {}): PurchaseRequest => ({
    id: 'r',
    number: 'PR-1',
    title: 't',
    projectId: null,
    nodeId: null,
    quantity: 1,
    unit: 'pcs',
    priority: 'normal',
    supplierId: null,
    unitPrice: null,
    stages: createPurchaseStages().map((s, i) => ({ ...s, done: i < done })),
    contacts: [],
    quotes: [],
    mcdm: { criteria: [], scores: {} },
    eta: null,
    revisedEta: null,
    qualityResult: null,
    correctiveAction: '',
    createdAt: '2026-01-01',
    ...extra,
  });

  it('advances strictly in order', () => {
    expect(canToggleStage(request(0), 'marketResearch').allowed).toBe(false);
    expect(currentStageIndex(request(3))).toBe(3);
  });

  it('requires a research start date and measures the search duration', () => {
    const open = request(1);
    expect(canToggleStage(open, 'marketResearch').allowed).toBe(false);
    const started = request(1, {
      stages: open.stages.map((s) => (s.key === 'marketResearch' ? { ...s, startDate: '2026-01-01' } : s)),
    });
    expect(canToggleStage(started, 'marketResearch').allowed).toBe(true);
    expect(researchDays(started, '2026-01-06')).toBe(5);
    const finished = request(2, {
      stages: started.stages.map((s) => (s.key === 'marketResearch' ? { ...s, done: true, date: '2026-01-04' } : s)),
    });
    expect(researchDays(finished, '2026-02-01')).toBe(3);
    expect(researchDays(request(0), '2026-01-06')).toBeNull();
  });

  it('requires a supplier contact before closing the RFQ stage', () => {
    expect(canToggleStage(request(2), 'rfqSent').allowed).toBe(false);
    const contact = { id: 'c', supplierId: 's', contactedAt: '2026-01-01', channel: 'email' as const, expectedReplyDate: '2026-01-03', note: '', replied: false };
    expect(canToggleStage(request(2, { contacts: [contact] }), 'rfqSent').allowed).toBe(true);
    expect(isContactOverdue(contact, '2026-01-05')).toBe(true);
    expect(isContactOverdue({ ...contact, replied: true }, '2026-01-05')).toBe(false);
  });

  it('blocks warehouse receipt when quality failed', () => {
    expect(canToggleStage(request(9, { qualityResult: 'failed' }), 'warehouseReceipt').allowed).toBe(false);
    expect(canToggleStage(request(9, { qualityResult: 'passed' }), 'warehouseReceipt').allowed).toBe(true);
  });

  it('tracks delay against the ETA', () => {
    expect(etaDelayDays(request(7, { eta: '2026-01-10' }), '2026-01-14')).toBe(4);
    expect(etaDelayDays(request(7, { eta: '2026-01-10' }), '2026-01-08')).toBe(0);
  });
});

const QUOTE = {
  unitPrice: 1,
  leadTimeDays: 1,
  note: '',
  receivedAt: null,
  channel: 'email' as const,
  shippingCost: 0,
  paymentTerms: '',
  warranty: '',
  validUntil: null,
};

describe('evaluateMcdm', () => {
  it('ranks quotes by weighted score', () => {
    const quotes = [
      { ...QUOTE, id: 'q1', supplierId: 's1' },
      { ...QUOTE, id: 'q2', supplierId: 's2' },
    ];
    const result = evaluateMcdm(
      {
        criteria: [
          { id: 'price', name: 'price', weight: 70 },
          { id: 'quality', name: 'quality', weight: 30 },
        ],
        scores: { q1: { price: 10, quality: 0 }, q2: { price: 0, quality: 10 } },
      },
      quotes,
    );
    expect(result.find((r) => r.quoteId === 'q1')).toEqual({ quoteId: 'q1', score: 70, rank: 1 });
    expect(result.find((r) => r.quoteId === 'q2')?.rank).toBe(2);
  });
});

describe('custom fields', () => {
  const definition = (extra: Partial<CustomFieldDefinition>): CustomFieldDefinition => ({
    id: 'f',
    entity: 'bomNode',
    label: 'الوزن',
    type: 'number',
    required: true,
    options: [],
    placeholder: '',
    unit: 'كغ',
    order: 1,
    active: true,
    showInList: false,
    ...extra,
  });

  it('reports only active required fields without a value', () => {
    const fields = [definition({}), definition({ id: 'g', label: 'معطّل', active: false }), definition({ id: 'h', label: 'اختياري', required: false })];
    expect(missingRequiredFields(fields, {})).toEqual(['الوزن']);
    expect(missingRequiredFields(fields, { f: 12 })).toEqual([]);
    expect(missingRequiredFields([definition({ type: 'multiselect' })], { f: [] })).toEqual(['الوزن']);
  });

  it('formats values by type', () => {
    expect(formatCustomValue(definition({}), 12)).toBe('12 كغ');
    expect(formatCustomValue(definition({ type: 'checkbox', unit: '' }), true)).toBe('نعم');
    expect(formatCustomValue(definition({ type: 'multiselect', unit: '' }), ['أ', 'ب'])).toBe('أ، ب');
    expect(formatCustomValue(definition({}), null)).toBe('—');
  });
});
