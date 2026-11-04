import { BomNode, Material, PurchaseRequest, RoutingOperation, Workstation } from '../models';
import { BomTree } from './bom-tree';
import { rollUpCost } from './cost-rollup';
import { evaluateMcdm } from './mcdm';
import { rollUpProgress } from './progress';
import { canToggleStage, createPurchaseStages, currentStageIndex, etaDelayDays } from './purchase-flow';

const node = (id: string, parentId: string | null, extra: Partial<BomNode> = {}): BomNode => ({
  id,
  projectId: 'p',
  parentId,
  code: id,
  name: id,
  description: '',
  discipline: 'mechanical',
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
    expect(canToggleStage(request(1), 'marketResearch').allowed).toBe(true);
    expect(currentStageIndex(request(3))).toBe(3);
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

describe('evaluateMcdm', () => {
  it('ranks quotes by weighted score', () => {
    const quotes = [
      { id: 'q1', supplierId: 's1', unitPrice: 1, leadTimeDays: 1, note: '' },
      { id: 'q2', supplierId: 's2', unitPrice: 1, leadTimeDays: 1, note: '' },
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
