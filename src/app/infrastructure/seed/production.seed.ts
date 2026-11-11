import { IsoDate, OperationInput, QcStatus, RoutingOperation } from '@domain/models';
import { addDays } from '@domain/rules';
import { nodeId } from './projects.seed';

type OpState = 'done' | 'late' | 'active' | 'planned';

interface OpSpec {
  readonly name: string;
  readonly ws?: string;
  readonly setup?: number;
  readonly run?: number;
  readonly hours: number;
  /** Start offset in days relative to today. */
  readonly start: number;
  readonly days: number;
  readonly state?: OpState;
  readonly progress?: number;
  readonly external?: readonly [string, number];
  /** In-company operation: executing department and hourly rate. */
  readonly company?: readonly [string, number];
  readonly consumables?: readonly [string, number][];
  readonly inputs?: readonly OperationInput[];
  readonly description?: string;
  readonly delay?: string;
  readonly qc?: QcStatus;
}

const component = (code: string, quantity = 1): OperationInput => ({ kind: 'component', refId: nodeId(code), quantity });
const raw = (code: string, quantity: number): OperationInput => ({ kind: 'material', refId: `m-${code}`, quantity });

export const operationId = (code: string, sequence: number) => `op-${code}-${sequence}`;

const ROUTINGS: Record<string, OpSpec[]> = {
  'ATL-1.1.1': [
    { name: 'قص البروفيل على الطول', ws: 'ws-saw', setup: 15, run: 6, hours: 4, start: -22, days: 1, state: 'done', inputs: [raw('PRF-80', 2.4)], consumables: [['CUT-115', 0.1]], qc: 'passed' },
    { name: 'تشطيب الحواف وإزالة الرايش', ws: 'ws-grind', setup: 5, run: 4, hours: 3, start: -21, days: 1, state: 'done', consumables: [['FLAP-125', 0.2]], qc: 'passed' },
  ],
  'ATL-1.1.2': [
    { name: 'القص بالليزر', ws: 'ws-laser', setup: 20, run: 4, hours: 3, start: -22, days: 1, state: 'done', inputs: [raw('ST37-10', 3.2)], description: 'قص الصفائح وفق ملف DXF المعتمد', qc: 'passed' },
    { name: 'ثقب وتشطيب الفتحات', ws: 'ws-mill', setup: 30, run: 6, hours: 5, start: -20, days: 2, state: 'done', qc: 'passed' },
  ],
  'ATL-1.1': [
    { name: 'تجميع ولحام غازي MIG', ws: 'ws-mig', setup: 30, run: 90, hours: 24, start: -16, days: 6, state: 'done', inputs: [component('ATL-1.1.1', 4), component('ATL-1.1.2', 6)], consumables: [['WIRE-08', 0.6], ['GAS-MIX', 40]], description: 'تثبيت البروفيلات على قالب التجميع ثم لحام نقطي ولحام نهائي', qc: 'passed' },
    { name: 'تجليخ وصنفرة خطوط اللحام', ws: 'ws-grind', setup: 10, run: 45, hours: 10, start: -9, days: 6, state: 'active', progress: 60, consumables: [['SAND-80', 4], ['FLAP-125', 1]], delay: 'تأخر توريد أقراص الرفراف' },
    { name: 'دهان إلكتروستاتيكي', hours: 8, start: -2, days: 5, state: 'planned', external: ['شركة الأمل للدهانات الصناعية', 45], description: 'لون RAL 7035 مع طبقة أساس إيبوكسي' },
    { name: 'فحص الأبعاد والاستوائية', ws: 'ws-qc', setup: 10, run: 30, hours: 3, start: 4, days: 1, state: 'planned' },
  ],
  'ATL-1.2': [
    { name: 'القص بالليزر', ws: 'ws-laser', setup: 20, run: 8, hours: 4, start: -14, days: 2, state: 'done', inputs: [raw('ST37-3', 8)], qc: 'passed' },
    { name: 'ثني الصفائح (Abkant)', ws: 'ws-press', setup: 25, run: 8, hours: 6, start: -8, days: 6, state: 'late', progress: 70, delay: 'صيانة طارئة للمكبس' },
    { name: 'دهان إلكتروستاتيكي', hours: 6, start: 0, days: 4, state: 'planned', external: ['شركة الأمل للدهانات الصناعية', 18] },
  ],
  'ATL-1': [
    { name: 'تجميع الهيكل الرئيسي', ws: 'ws-assembly', setup: 20, run: 120, hours: 14, start: 6, days: 4, state: 'planned', inputs: [component('ATL-1.1'), component('ATL-1.2', 4), component('ATL-1.3')] },
  ],
  'ATL-2.1': [
    { name: 'القص بالليزر', ws: 'ws-laser', setup: 20, run: 12, hours: 4, start: -18, days: 1, state: 'done', inputs: [raw('SS304-2', 46)], qc: 'passed' },
    { name: 'درفلة وثني الجدران', ws: 'ws-press', setup: 30, run: 25, hours: 6, start: -16, days: 3, state: 'done', qc: 'passed' },
    { name: 'لحام TIG صحي', ws: 'ws-tig', setup: 45, run: 240, hours: 16, start: -10, days: 9, state: 'active', progress: 40, consumables: [['GAS-MIX', 120]], description: 'لحام بغاز أرغون نقي مع حماية خلفية' },
    { name: 'تلميع داخلي Ra≤0.8', ws: 'ws-grind', setup: 15, run: 90, hours: 8, start: 0, days: 4, state: 'planned', consumables: [['SAND-80', 6]] },
    { name: 'اختبار الضغط والتسرب', ws: 'ws-qc', setup: 20, run: 60, hours: 4, start: 5, days: 1, state: 'planned' },
  ],
  'ATL-2.2.2': [
    { name: 'تفريز CNC', ws: 'ws-mill', setup: 40, run: 55, hours: 6, start: -4, days: 6, state: 'active', progress: 50, inputs: [raw('AL6061', 4)] },
    { name: 'أنودة الألمنيوم', hours: 2, start: 3, days: 3, state: 'planned', external: ['ورشة الدقة للخراطة', 12] },
  ],
  'ATL-2.2': [
    { name: 'تجميع مجموعة الفوهات', ws: 'ws-assembly', setup: 15, run: 60, hours: 6, start: 7, days: 2, state: 'planned', inputs: [component('ATL-2.2.1', 6), component('ATL-2.2.2'), component('ATL-2.2.3', 6)] },
  ],
  'ATL-2': [
    { name: 'تجميع وحدة التعبئة', ws: 'ws-assembly', setup: 20, run: 180, hours: 16, start: 10, days: 5, state: 'planned', inputs: [component('ATL-2.1'), component('ATL-2.2'), component('ATL-2.3'), component('ATL-2.4', 2)] },
  ],
  'ATL-3.5': [
    { name: 'قص وتجهيز الكابلات', ws: 'ws-panel', setup: 10, run: 60, hours: 5, start: -3, days: 3, state: 'active', progress: 30, inputs: [raw('CBL-2.5', 60)] },
  ],
  'ATL-3': [
    { name: 'تجميع اللوحة الكهربائية', ws: 'ws-panel', setup: 20, run: 360, hours: 24, start: 3, days: 6, state: 'planned' },
    { name: 'اختبار العزل والتشغيل', ws: 'ws-qc', setup: 15, run: 60, hours: 4, start: 10, days: 1, state: 'planned' },
    { name: 'برمجة PLC وشاشة HMI', hours: 16, start: 5, days: 5, state: 'planned', company: ['d-planning', 22], description: 'تطوير برنامج التحكم وواجهة التشغيل في قسم الهندسة' },
  ],
  'ATL-4': [
    { name: 'تجميع النظام الهوائي', ws: 'ws-assembly', setup: 15, run: 120, hours: 10, start: 8, days: 3, state: 'planned' },
  ],
  'ATL-5': [
    { name: 'برمجة PLC وواجهة HMI', ws: 'ws-panel', setup: 0, run: 1800, hours: 40, start: -6, days: 14, state: 'active', progress: 35 },
    { name: 'اختبار المحاكاة', ws: 'ws-qc', setup: 0, run: 240, hours: 8, start: 9, days: 2, state: 'planned' },
  ],
  'ATL-200': [
    { name: 'التجميع النهائي للخط', ws: 'ws-assembly', setup: 60, run: 480, hours: 32, start: 16, days: 8, state: 'planned', inputs: [component('ATL-1'), component('ATL-2'), component('ATL-3'), component('ATL-4'), component('ATL-5')] },
    { name: 'اختبار القبول في المصنع FAT', ws: 'ws-qc', setup: 30, run: 240, hours: 12, start: 25, days: 3, state: 'planned' },
  ],
  'HP-1.1': [
    { name: 'القص بالليزر', ws: 'ws-laser', setup: 25, run: 30, hours: 6, start: -8, days: 2, state: 'done', inputs: [raw('ST37-10', 180)], qc: 'passed' },
    { name: 'تشغيل سطوح الارتكاز', ws: 'ws-mill', setup: 60, run: 120, hours: 14, start: -5, days: 7, state: 'active', progress: 25 },
  ],
  'HP-1.2': [
    { name: 'القص بالليزر', ws: 'ws-laser', setup: 25, run: 35, hours: 5, start: -6, days: 2, state: 'done', qc: 'rejected', description: 'رُفضت دفعة بسبب انحراف في الأبعاد' },
    { name: 'لحام الأضلاع التقوية', ws: 'ws-mig', setup: 30, run: 150, hours: 16, start: -2, days: 6, state: 'active', progress: 10, consumables: [['WIRE-08', 1.2], ['GAS-MIX', 80]] },
  ],
  'HP-1.3.1': [
    { name: 'تفريز سطح الطاولة', ws: 'ws-mill', setup: 45, run: 180, hours: 18, start: 2, days: 5, state: 'planned' },
  ],
  'HP-2.1': [
    { name: 'خراطة القميص الداخلية', hours: 12, start: -3, days: 10, state: 'active', progress: 45, external: ['ورشة الدقة للخراطة', 210], description: 'خراطة وتنعيم Honing بدقة H8' },
  ],
  'HP-3.3': [
    { name: 'قص وثني ولحام الخزان', ws: 'ws-mig', setup: 30, run: 120, hours: 10, start: 4, days: 4, state: 'planned' },
  ],
  'HP-1': [
    { name: 'تجميع هيكل المكبس', ws: 'ws-assembly', setup: 40, run: 240, hours: 20, start: 14, days: 5, state: 'planned', inputs: [component('HP-1.1', 2), component('HP-1.2'), component('HP-1.3')] },
  ],
};

export function seedOperations(today: IsoDate): RoutingOperation[] {
  return Object.entries(ROUTINGS).flatMap(([code, specs]) =>
    specs.map((spec, index): RoutingOperation => {
      const sequence = (index + 1) * 10;
      const earliestStart = addDays(today, spec.start);
      const latestFinish = addDays(earliestStart, spec.days - 1);
      const state = spec.state ?? 'planned';
      const done = state === 'done';
      return {
        id: operationId(code, sequence),
        nodeId: nodeId(code),
        sequence,
        name: spec.name,
        description: spec.description ?? '',
        location: spec.external ? 'external' : spec.company ? 'company' : 'internal',
        subcontractor: spec.external?.[0] ?? '',
        externalUnitCost: spec.external?.[1] ?? 0,
        workstationId: spec.ws ?? null,
        departmentId: spec.company?.[0] ?? null,
        companyHourlyRate: spec.company?.[1] ?? 0,
        inputs: spec.inputs ?? [],
        earliestStart,
        latestFinish,
        plannedHours: spec.hours,
        actualHours: done ? spec.hours : Math.round(spec.hours * ((spec.progress ?? 0) / 100)),
        setupMinutes: spec.setup ?? 0,
        runMinutesPerUnit: spec.run ?? 0,
        consumables: (spec.consumables ?? []).map(([materialCode, quantity]) => ({ materialId: `m-${materialCode}`, quantity })),
        instructions: '',
        completed: done,
        onTime: state !== 'late' && !spec.delay,
        actualFinish: done ? latestFinish : null,
        delayReason: spec.delay ?? '',
        progressMode: 'percent',
        progressPercent: done ? 100 : (spec.progress ?? 0),
        completedQuantity: 0,
        qcStatus: spec.qc ?? 'pending',
        qcNote: spec.qc === 'rejected' ? 'انحراف 1.5 مم عن الأبعاد الاسمية' : '',
        reworkSequence: spec.qc === 'rejected' ? sequence : null,
        consumablesPosted: done,
      };
    }),
  );
}
