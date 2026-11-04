import { IsoDate, PurchaseRequest, PurchaseStage, PurchaseStageKey } from '../models';
import { diffDays } from './dates';

export interface StageDefinition {
  readonly key: PurchaseStageKey;
  readonly label: string;
  readonly hint: string;
  readonly icon: string;
}

/** Ordered status machine of the buy flow. */
export const PURCHASE_STAGES: readonly StageDefinition[] = [
  { key: 'technicalInfo', label: 'مشاركة المعلومات الفنية', hint: 'إرسال الملفات الفنية للموردين', icon: 'file' },
  { key: 'marketResearch', label: 'مرحلة البحث', hint: 'تحليل السوق وتحديد الموردين المحتملين', icon: 'search' },
  { key: 'rfqSent', label: 'طلب عروض الأسعار (RFQ)', hint: 'طلب عروض من موردين مختلفين', icon: 'send' },
  { key: 'optionsPresented', label: 'تقديم الخيارات', hint: 'قائمة مستندات العروض البديلة', icon: 'layers' },
  { key: 'mcdmDecision', label: 'قرار متعدد المعايير (MCDM)', hint: 'اختيار المورد عبر مصفوفة القرار', icon: 'scale' },
  { key: 'poCreated', label: 'فتح أمر الشراء (PO)', hint: 'إصدار أمر الشراء للمورد المعتمد', icon: 'clipboard' },
  { key: 'leadTime', label: 'وقت التسليم المقدر (ETA)', hint: 'متابعة موعد التوريد والتأخير', icon: 'clock' },
  { key: 'delivered', label: 'التسليم / قبول المستودع', hint: 'وصول الشحنة وقبولها مبدئياً', icon: 'truck' },
  { key: 'qualityControl', label: 'مراقبة الجودة', hint: 'فحص الجودة وتسجيل النتيجة', icon: 'shield' },
  { key: 'warehouseReceipt', label: 'الاستلام في المستودع', hint: 'إدخال المادة وفتح سجل المخزون', icon: 'warehouse' },
];

export function createPurchaseStages(): PurchaseStage[] {
  return PURCHASE_STAGES.map(({ key }) => ({ key, done: false, date: null, note: '', attachments: [] }));
}

export function stageDefinition(key: PurchaseStageKey): StageDefinition {
  return PURCHASE_STAGES.find((stage) => stage.key === key)!;
}

export function findStage(request: PurchaseRequest, key: PurchaseStageKey): PurchaseStage | undefined {
  return request.stages.find((stage) => stage.key === key);
}

export function isStageDone(request: PurchaseRequest, key: PurchaseStageKey): boolean {
  return findStage(request, key)?.done ?? false;
}

/** Index of the first open stage; equals the stage count when the flow is complete. */
export function currentStageIndex(request: PurchaseRequest): number {
  const index = request.stages.findIndex((stage) => !stage.done);
  return index === -1 ? request.stages.length : index;
}

export function purchaseProgress(request: PurchaseRequest): number {
  return (request.stages.filter((stage) => stage.done).length / PURCHASE_STAGES.length) * 100;
}

export function purchaseStatusLabel(request: PurchaseRequest): string {
  const index = currentStageIndex(request);
  if (index >= PURCHASE_STAGES.length) return 'مكتمل ومستلم';
  if (request.qualityResult === 'failed' && PURCHASE_STAGES[index].key === 'warehouseReceipt') {
    return 'مرفوض بالجودة';
  }
  return PURCHASE_STAGES[index].label;
}

export interface Guard {
  readonly allowed: boolean;
  readonly reason?: string;
}

/** Stages advance strictly in order and can only be reopened from the end. */
export function canToggleStage(request: PurchaseRequest, key: PurchaseStageKey): Guard {
  const index = request.stages.findIndex((stage) => stage.key === key);
  const stage = request.stages[index];
  if (!stage) return { allowed: false };

  if (stage.done) {
    const next = request.stages[index + 1];
    return next?.done ? { allowed: false, reason: 'لا يمكن التراجع قبل إلغاء المراحل اللاحقة' } : { allowed: true };
  }
  if (index > 0 && !request.stages[index - 1].done) {
    return { allowed: false, reason: 'يجب إكمال المرحلة السابقة أولاً' };
  }
  if (key === 'mcdmDecision' && !request.supplierId) {
    return { allowed: false, reason: 'اعتمد مورداً من مصفوفة القرار أولاً' };
  }
  if (key === 'leadTime' && !request.eta) {
    return { allowed: false, reason: 'حدد تاريخ التسليم المقدر' };
  }
  if (key === 'qualityControl' && !request.qualityResult) {
    return { allowed: false, reason: 'سجّل نتيجة فحص الجودة' };
  }
  if (key === 'warehouseReceipt' && request.qualityResult !== 'passed') {
    return { allowed: false, reason: 'لا يُستلم إلا المنتج ذو نتيجة الجودة الإيجابية' };
  }
  return { allowed: true };
}

/** Delay in days against the planned ETA (until delivery, or until today while still open). */
export function etaDelayDays(request: PurchaseRequest, today: IsoDate): number {
  if (!request.eta) return 0;
  const delivered = findStage(request, 'delivered');
  const reference = delivered?.done && delivered.date ? delivered.date : today;
  return Math.max(0, diffDays(request.eta, reference));
}

export function isIncoming(request: PurchaseRequest): boolean {
  return isStageDone(request, 'poCreated') && !isStageDone(request, 'delivered');
}

export function isAwaitingQuotes(request: PurchaseRequest): boolean {
  return isStageDone(request, 'rfqSent') && !isStageDone(request, 'optionsPresented');
}

export function isPurchaseCompleted(request: PurchaseRequest): boolean {
  return isStageDone(request, 'warehouseReceipt');
}
