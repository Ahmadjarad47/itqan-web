import { BomNode, Discipline, IsoDate, Project, ProjectStatus, SourcingDecision, Unit } from '@domain/models';
import { addDays } from '@domain/rules';

interface NodeSpec {
  readonly name: string;
  readonly discipline?: Discipline;
  readonly quantity?: number;
  readonly unit?: Unit;
  readonly decision?: SourcingDecision | null;
  readonly price?: number;
  readonly materials?: readonly [string, number][];
  readonly description?: string;
  readonly image?: string;
  readonly children?: readonly NodeSpec[];
}

interface ProjectSpec {
  readonly id: string;
  readonly prefix: string;
  readonly code: string;
  readonly customer: string;
  readonly productionQuantity: number;
  readonly dueInDays: number;
  readonly status: ProjectStatus;
  readonly root: NodeSpec;
}

export const nodeId = (code: string) => `n-${code}`;

const SPECS: ProjectSpec[] = [
  {
    id: 'p-atl',
    prefix: 'ATL',
    code: 'ATL-200',
    customer: 'معمل الشرق للصناعات الغذائية',
    productionQuantity: 3,
    dueInDays: 75,
    status: 'active',
    root: {
      name: 'خط تعبئة آلي للسوائل ATL-200',
      description: 'خط تعبئة نصف آلي بست فوهات بطاقة 1200 عبوة في الساعة مع لوحة تحكم PLC.',
      image: 'products/filling-line.svg',
      decision: 'make',
      children: [
        {
          name: 'الهيكل الرئيسي',
          decision: 'make',
          children: [
            {
              name: 'قاعدة الهيكل الملحومة',
              decision: 'make',
              children: [
                { name: 'بروفيل القاعدة 80×80', quantity: 4, decision: 'make', materials: [['PRF-80', 2.4]] },
                { name: 'صفيحة تثبيت 10 مم', quantity: 6, decision: 'make', materials: [['ST37-10', 3.2]] },
                { name: 'رجل تسوية قابلة للتعديل M20', quantity: 6, decision: 'buy', price: 14 },
              ],
            },
            { name: 'ألواح التغطية الجانبية', quantity: 4, decision: 'make', materials: [['ST37-3', 8]] },
            { name: 'طقم عناصر الربط والتثبيت', unit: 'set', decision: 'buy', price: 65 },
          ],
        },
        {
          name: 'وحدة التعبئة',
          decision: 'make',
          children: [
            { name: 'خزان التعبئة الستانلس 200 لتر', decision: 'make', materials: [['SS304-2', 46]] },
            {
              name: 'مجموعة فوهات التعبئة',
              decision: 'make',
              children: [
                { name: 'فوهة تعبئة ستانلس', quantity: 6, decision: 'buy', price: 85 },
                { name: 'حامل الفوهات', decision: 'make', materials: [['AL6061', 4]] },
                { name: 'صمام إغلاق بالتحكم الهوائي', quantity: 6, discipline: 'pneumatic', decision: 'buy', price: 120 },
              ],
            },
            { name: 'مضخة طرد مركزي صحية', decision: 'buy', price: 1450 },
            { name: 'حساس مستوى سعوي', quantity: 2, discipline: 'electronic', decision: 'buy', price: 210 },
          ],
        },
        {
          name: 'لوحة التحكم الكهربائية',
          discipline: 'electrical',
          decision: 'make',
          children: [
            { name: 'خزانة كهربائية IP65', discipline: 'electrical', decision: 'buy', price: 380 },
            { name: 'وحدة تحكم منطقية PLC', discipline: 'electronic', decision: 'buy', price: 1250 },
            { name: 'شاشة تشغيل HMI لمسية 7 إنش', discipline: 'electronic', decision: 'buy', price: 640 },
            { name: 'طقم القواطع والمرحلات', discipline: 'electrical', unit: 'set', decision: 'buy', price: 290 },
            { name: 'كابلات التمديد الداخلي', discipline: 'electrical', decision: 'make', materials: [['CBL-2.5', 60]] },
          ],
        },
        {
          name: 'النظام الهوائي',
          discipline: 'pneumatic',
          decision: 'make',
          children: [
            { name: 'اسطوانة هوائية Ø50', quantity: 4, discipline: 'pneumatic', decision: 'buy', price: 95 },
            { name: 'وحدة معالجة الهواء FRL', discipline: 'pneumatic', decision: 'buy', price: 160 },
            { name: 'مجموعة الصمامات الكهروهوائية', discipline: 'pneumatic', unit: 'set', decision: 'buy', price: 420 },
          ],
        },
        { name: 'برنامج التحكم والتشغيل', discipline: 'software', decision: 'make' },
      ],
    },
  },
  {
    id: 'p-hp',
    prefix: 'HP',
    code: 'HP-50',
    customer: 'مجموعة الفرات للصناعات المعدنية',
    productionQuantity: 5,
    dueInDays: 100,
    status: 'active',
    root: {
      name: 'مكبس هيدروليكي 50 طن HP-50',
      description: 'مكبس هيدروليكي رباعي الأعمدة بقوة 50 طن مع ستارة أمان ضوئية.',
      image: 'products/hydraulic-press.svg',
      decision: 'make',
      children: [
        {
          name: 'هيكل المكبس',
          decision: 'make',
          children: [
            { name: 'العمود الجانبي', quantity: 2, decision: 'make', materials: [['ST37-10', 180]] },
            { name: 'الجسر العلوي', decision: 'make', materials: [['ST37-10', 220]] },
            {
              name: 'طاولة العمل',
              decision: 'make',
              children: [
                { name: 'صفيحة الطاولة المشغولة', decision: 'make', materials: [['ST37-10', 140]] },
                { name: 'مجرى تثبيت T', quantity: 4, decision: 'make', materials: [['C45-50', 6]] },
              ],
            },
          ],
        },
        {
          name: 'الاسطوانة الهيدروليكية الرئيسية',
          discipline: 'hydraulic',
          decision: 'make',
          children: [
            { name: 'قميص الاسطوانة', discipline: 'hydraulic', decision: 'make', materials: [['C45-50', 38]] },
            { name: 'ذراع المكبس المكروم', discipline: 'hydraulic', decision: 'buy', price: 680 },
            { name: 'طقم موانع التسرب', discipline: 'hydraulic', unit: 'set', decision: 'buy', price: 140 },
          ],
        },
        {
          name: 'وحدة القدرة الهيدروليكية',
          discipline: 'hydraulic',
          decision: 'make',
          children: [
            { name: 'مضخة مسننات 20 ل/د', discipline: 'hydraulic', decision: 'buy', price: 890 },
            { name: 'محرك كهربائي 7.5 كيلوواط', discipline: 'electrical', decision: 'buy', price: 720 },
            { name: 'خزان الزيت 100 لتر', decision: 'make', materials: [['ST37-3', 35]] },
            { name: 'خراطيم وتوصيلات', discipline: 'hydraulic', unit: 'set', decision: 'make', materials: [['HOSE-12', 8]] },
          ],
        },
        {
          name: 'لوحة التحكم والأمان',
          discipline: 'electrical',
          decision: 'make',
          children: [
            { name: 'ستارة ضوئية للأمان', discipline: 'electronic', decision: 'buy', price: 950 },
            { name: 'وحدة تحكم PLC مدمجة', discipline: 'electronic', decision: 'buy', price: 540 },
          ],
        },
      ],
    },
  },
  {
    id: 'p-cv',
    prefix: 'CV',
    code: 'CV-12',
    customer: 'شركة العاصي للإسمنت ومواد البناء',
    productionQuantity: 10,
    dueInDays: 140,
    status: 'planning',
    root: {
      name: 'ناقل سيور معياري CV-12',
      description: 'ناقل سيور بطول 12 متر بإطار ألمنيوم معياري وسرعة متغيرة.',
      image: 'products/conveyor.svg',
      decision: 'make',
      children: [
        {
          name: 'الإطار المعياري',
          decision: 'make',
          children: [
            { name: 'بروفيل الإطار الألمنيوم', quantity: 4, decision: 'make', materials: [['AL6061', 12]] },
            { name: 'رجل الدعم', quantity: 6, decision: 'make', materials: [['PRF-40', 1.2]] },
          ],
        },
        {
          name: 'مجموعة الدرافيل',
          decision: 'make',
          children: [
            { name: 'درفيل القيادة', decision: 'make', materials: [['C45-50', 22]] },
            { name: 'درفيل الشد', decision: null },
            { name: 'محمل كروي UCP', quantity: 8, decision: 'buy', price: 35 },
          ],
        },
        { name: 'السير الناقل PVC', decision: 'buy', price: 610 },
        {
          name: 'وحدة الإدارة',
          discipline: 'electrical',
          decision: null,
          children: [
            { name: 'محرك مع علبة تخفيض', discipline: 'electrical', decision: null },
            { name: 'مغير سرعة VFD', discipline: 'electronic', decision: null },
          ],
        },
      ],
    },
  },
];

function buildNodes(spec: ProjectSpec, createdAt: IsoDate): BomNode[] {
  const nodes: BomNode[] = [];
  const visit = (node: NodeSpec, code: string, parentId: string | null, inherited: Discipline) => {
    const id = nodeId(code);
    const discipline = node.discipline ?? inherited;
    nodes.push({
      id,
      projectId: spec.id,
      parentId,
      code,
      name: node.name,
      description: node.description ?? '',
      discipline,
      quantity: node.quantity ?? 1,
      unit: node.unit ?? 'pcs',
      image: node.image ?? null,
      decision: node.decision ?? null,
      purchaseUnitPrice: node.price ?? null,
      attachments: [],
      materials: (node.materials ?? []).map(([materialCode, quantity]) => ({ materialId: `m-${materialCode}`, quantity })),
      createdAt,
    });
    node.children?.forEach((child, index) => {
      const childCode = parentId === null ? `${spec.prefix}-${index + 1}` : `${code}.${index + 1}`;
      visit(child, childCode, id, discipline);
    });
  };
  visit(spec.root, spec.code, null, spec.root.discipline ?? 'mechanical');
  return nodes;
}

export function seedProjects(today: IsoDate): { projects: Project[]; nodes: BomNode[] } {
  const createdAt = addDays(today, -30);
  return {
    projects: SPECS.map((spec) => ({
      id: spec.id,
      code: spec.code,
      name: spec.root.name,
      customer: spec.customer,
      rootNodeId: nodeId(spec.code),
      productionQuantity: spec.productionQuantity,
      dueDate: addDays(today, spec.dueInDays),
      status: spec.status,
      createdAt,
    })),
    nodes: SPECS.flatMap((spec) => buildNodes(spec, createdAt)),
  };
}
