import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthorizationService } from '@application/auth/authorization.service';
import { BomStore } from '@application/state/bom.store';
import { CustomFieldStore } from '@application/state/custom-field.store';
import { ProjectStore } from '@application/state/project.store';
import { PurchaseStore } from '@application/state/purchase.store';
import { SupplierStore } from '@application/state/supplier.store';
import { PurchaseWorkflowUseCase } from '@application/use-cases/purchase-workflow.use-case';
import { CanDirective } from '@core/auth/can.directive';
import { ConfirmService } from '@core/feedback/confirm.service';
import { ToastService } from '@core/feedback/toast.service';
import {
  Attachment,
  EntityId,
  missingRequiredFields,
  PRIORITY_LABELS,
  PurchasePriority,
  PurchaseStageKey,
  QualityResult,
  UNIT_LABELS,
} from '@domain/models';
import {
  canToggleStage,
  currentStageIndex,
  etaDelayDays,
  PURCHASE_STAGES,
  purchaseProgress,
  purchaseStatusLabel,
  researchDays,
  todayIso,
} from '@domain/rules';
import { ArDatePipe, MoneyPipe, NumPipe } from '@shared/pipes/format.pipes';
import { CustomFieldChange, CustomFieldsForm } from '@shared/ui/custom-fields/custom-fields-form';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { AttachmentList } from '@shared/ui/file-drop/attachment-list';
import { FileDrop, RejectedFile } from '@shared/ui/file-drop/file-drop';
import { Icon } from '@shared/ui/icon/icon';
import { ProgressRing } from '@shared/ui/progress/progress';
import { ContactsPanel } from './contacts-panel';
import { McdmPanel } from './mcdm-panel';
import { OptionsReport } from './options-report';
import { QuotesPanel } from './quotes-panel';

@Component({
  selector: 'app-purchase-detail-page',
  imports: [RouterLink, CanDirective, CustomFieldsForm, Icon, ProgressRing, FileDrop, AttachmentList, EmptyState, QuotesPanel, ContactsPanel, OptionsReport, McdmPanel, MoneyPipe, NumPipe, ArDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './purchase-detail-page.html',
  styleUrl: './purchase-detail-page.scss',
})
export class PurchaseDetailPage {
  private readonly router = inject(Router);
  private readonly purchases = inject(PurchaseStore);
  private readonly workflow = inject(PurchaseWorkflowUseCase);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly bom = inject(BomStore);
  private readonly projects = inject(ProjectStore);
  protected readonly suppliers = inject(SupplierStore);

  readonly requestId = input.required<EntityId>();

  protected readonly definitions = PURCHASE_STAGES;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly priorities = Object.keys(PRIORITY_LABELS) as PurchasePriority[];
  protected readonly unitLabels = UNIT_LABELS;
  protected readonly today = todayIso();

  private readonly auth = inject(AuthorizationService);
  private readonly fieldDefinitions = inject(CustomFieldStore);
  protected readonly canManage = computed(() => this.auth.can('procurement.manage'));
  protected readonly customFields = computed(() => this.fieldDefinitions.activeFor('purchase'));
  protected readonly request = computed(() => this.purchases.find(this.requestId()));
  protected readonly missing = computed(() => missingRequiredFields(this.customFields(), this.request()?.customFields));
  protected readonly node = computed(() => this.bom.find(this.request()?.nodeId));
  protected readonly project = computed(() => this.projects.find(this.request()?.projectId));
  protected readonly supplier = computed(() => this.suppliers.find(this.request()?.supplierId));
  protected readonly currentIndex = computed(() => (this.request() ? currentStageIndex(this.request()!) : 0));
  protected readonly progress = computed(() => (this.request() ? purchaseProgress(this.request()!) : 0));
  protected readonly status = computed(() => (this.request() ? purchaseStatusLabel(this.request()!) : ''));
  protected readonly research = computed(() => (this.request() ? researchDays(this.request()!, this.today) : null));
  protected readonly decisionView = signal<'report' | 'matrix'>('report');
  protected readonly delay = computed(() => (this.request() ? etaDelayDays(this.request()!, this.today) : 0));

  /** The open stage follows the flow, but the user can expand any stage. */
  protected readonly openStage = linkedSignal<PurchaseStageKey | null>(
    () => PURCHASE_STAGES[Math.min(this.currentIndex(), PURCHASE_STAGES.length - 1)].key,
  );

  protected toggleOpen(key: PurchaseStageKey): void {
    this.openStage.update((current) => (current === key ? null : key));
  }

  protected guard(key: PurchaseStageKey) {
    return canToggleStage(this.request()!, key);
  }

  protected toggleStage(key: PurchaseStageKey): void {
    const wasDone = this.request()!.stages.find((s) => s.key === key)?.done;
    const result = this.workflow.toggleStage(this.requestId(), key);
    if (!result.allowed) {
      this.toast.warning('لا يمكن تحديث المرحلة', result.reason);
      return;
    }
    if (key === 'warehouseReceipt' && !wasDone) {
      this.toast.success('تم الاستلام في المستودع', 'فُتح سجل المخزون وحُدّث سعر الشراء في شجرة المنتج');
    }
  }

  protected setCustomField(change: CustomFieldChange): void {
    this.purchases.setCustomField(this.requestId(), change.fieldId, change.value);
  }

  protected setStageDate(key: PurchaseStageKey, date: string): void {
    this.purchases.updateStage(this.requestId(), key, { date: date || null });
  }

  protected setResearchStart(date: string): void {
    this.purchases.updateStage(this.requestId(), 'marketResearch', { startDate: date || null });
  }

  protected setStageNote(key: PurchaseStageKey, note: string): void {
    this.purchases.updateStage(this.requestId(), key, { note });
  }

  protected addFiles(key: PurchaseStageKey, files: Attachment[]): void {
    this.purchases.addStageAttachments(this.requestId(), key, files);
    this.toast.success(`تم رفع ${files.length} مستند`);
  }

  protected rejectFiles(files: RejectedFile[]): void {
    this.toast.warning('ملفات غير مقبولة', files.map((f) => f.name).join('، '));
  }

  protected removeFile(key: PurchaseStageKey, id: EntityId): void {
    this.purchases.removeStageAttachment(this.requestId(), key, id);
  }

  protected setPriority(value: string): void {
    this.purchases.update(this.requestId(), { priority: value as PurchasePriority });
  }

  protected setEta(field: 'eta' | 'revisedEta', value: string): void {
    this.purchases.update(this.requestId(), { [field]: value || null });
  }

  protected setQuality(result: QualityResult): void {
    this.workflow.recordQuality(this.requestId(), result);
    if (result === 'failed') this.toast.warning('نتيجة الجودة سلبية', 'سجّل الإجراءات الإضافية المطلوبة — لن يُسمح بالاستلام في المستودع');
  }

  protected setCorrectiveAction(text: string): void {
    this.purchases.update(this.requestId(), { correctiveAction: text });
  }

  protected async remove(): Promise<void> {
    const accepted = await this.confirm.ask({
      title: 'حذف طلب الشراء',
      message: `سيتم حذف الطلب ${this.request()?.number} نهائياً.`,
      confirmLabel: 'حذف',
      danger: true,
    });
    if (!accepted) return;
    this.purchases.remove(this.requestId());
    this.toast.info('تم حذف الطلب');
    void this.router.navigate(['/procurement/requests']);
  }
}
