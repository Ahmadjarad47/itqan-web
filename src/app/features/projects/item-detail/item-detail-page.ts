import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthorizationService } from '@application/auth/authorization.service';
import { ProjectInsightsQuery } from '@application/queries/project-insights.query';
import { CustomFieldStore } from '@application/state/custom-field.store';
import { BomStore } from '@application/state/bom.store';
import { InventoryStore } from '@application/state/inventory.store';
import { ProjectStore } from '@application/state/project.store';
import { PurchaseStore } from '@application/state/purchase.store';
import { RoutingStore } from '@application/state/routing.store';
import { EmployeeStore } from '@application/state/organization.store';
import { WarehouseStore } from '@application/state/warehouse.store';
import { ProjectSetupUseCase } from '@application/use-cases/project-setup.use-case';
import { SourcingUseCase } from '@application/use-cases/sourcing.use-case';
import { CanDirective } from '@core/auth/can.directive';
import { ConfirmService } from '@core/feedback/confirm.service';
import { ToastService } from '@core/feedback/toast.service';
import {
  Attachment,
  AttachmentKind,
  ATTACHMENT_RULES,
  BomNode,
  Discipline,
  DISCIPLINES,
  DISCIPLINE_KEYS,
  EntityId,
  levelTitle,
  Material,
  missingRequiredFields,
  SourcingDecision,
  Unit,
  UNIT_LABELS,
} from '@domain/models';
import { purchaseProgress, purchaseStatusLabel } from '@domain/rules';
import { MoneyPipe, NumPipe } from '@shared/pipes/format.pipes';
import { CustomFieldChange, CustomFieldsForm } from '@shared/ui/custom-fields/custom-fields-form';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { AttachmentList } from '@shared/ui/file-drop/attachment-list';
import { FileDrop, RejectedFile } from '@shared/ui/file-drop/file-drop';
import { Icon } from '@shared/ui/icon/icon';
import { readImageAsDataUrl } from '@shared/ui/image-picker/read-image';
import { ProductVisual } from '@shared/ui/product-visual/product-visual';
import { ProgressBar, ProgressRing } from '@shared/ui/progress/progress';
import { AddComponentDialog } from '../shared/add-component-dialog';
import { DecisionBadge } from '../shared/decision-badge';

const FILE_SECTIONS: readonly { kind: AttachmentKind; icon: string; hint: string }[] = [
  { kind: 'drawing2d', icon: 'file', hint: 'PDF, DXF, DWG' },
  { kind: 'model3d', icon: 'cube', hint: 'STEP, IGES, SLDPRT' },
  { kind: 'quality', icon: 'shield', hint: 'استمارة مراقبة الجودة' },
];

@Component({
  selector: 'app-item-detail-page',
  imports: [
    RouterLink,
    Icon,
    ProductVisual,
    ProgressRing,
    ProgressBar,
    DecisionBadge,
    FileDrop,
    AttachmentList,
    EmptyState,
    AddComponentDialog,
    CustomFieldsForm,
    CanDirective,
    MoneyPipe,
    NumPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './item-detail-page.html',
  styleUrl: './item-detail-page.scss',
})
export class ItemDetailPage {
  private readonly router = inject(Router);
  private readonly projects = inject(ProjectStore);
  private readonly bom = inject(BomStore);
  private readonly purchases = inject(PurchaseStore);
  private readonly routing = inject(RoutingStore);
  private readonly sourcing = inject(SourcingUseCase);
  private readonly setup = inject(ProjectSetupUseCase);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthorizationService);
  private readonly fieldDefinitions = inject(CustomFieldStore);
  protected readonly inventory = inject(InventoryStore);
  private readonly warehouses = inject(WarehouseStore);

  protected warehouseOf(material: Material): string {
    const names = [...new Set(material.locations.map((l) => this.warehouses.find(l.warehouseId)?.name).filter(Boolean))];
    return names.join('، ') || '—';
  }
  protected readonly employees = inject(EmployeeStore);
  protected readonly insights = inject(ProjectInsightsQuery);

  readonly projectId = input.required<EntityId>();
  readonly nodeId = input.required<EntityId>();

  protected readonly fileSections = FILE_SECTIONS;
  protected readonly attachmentRules = ATTACHMENT_RULES;
  protected readonly unitLabels = UNIT_LABELS;
  protected readonly units = Object.keys(UNIT_LABELS) as Unit[];
  protected readonly disciplines = DISCIPLINE_KEYS.map((key) => ({ key, label: DISCIPLINES[key].label }));
  protected readonly adding = signal(false);
  protected readonly newMaterialId = signal('');
  protected readonly newMaterialQty = signal(1);

  protected readonly canEdit = computed(() => this.auth.can('bom.edit'));
  protected readonly canDecide = computed(() => this.auth.can('bom.decide'));
  protected readonly customFields = computed(() => this.fieldDefinitions.activeFor('bomNode'));
  protected readonly node = computed(() => this.bom.find(this.nodeId()));
  protected readonly missing = computed(() => missingRequiredFields(this.customFields(), this.node()?.customFields));
  protected readonly project = computed(() => this.projects.find(this.projectId()));
  protected readonly path = computed(() => this.bom.tree().path(this.nodeId()));
  protected readonly level = computed(() => Math.max(0, this.path().length - 1));
  protected readonly levelTitle = computed(() => levelTitle(this.level()));
  protected readonly children = computed(() => this.bom.tree().children(this.nodeId()));
  protected readonly cost = computed(() => this.insights.costByNode().get(this.nodeId()));
  protected readonly progress = computed(() => this.insights.progressByNode().get(this.nodeId()) ?? 0);
  protected readonly lotSize = computed(() => this.insights.lotSize(this.nodeId()));
  protected readonly operations = computed(() => this.routing.forNode(this.nodeId()));
  protected readonly purchase = computed(() => this.purchases.byNode().get(this.nodeId()));
  protected readonly purchaseStatus = computed(() => {
    const request = this.purchase();
    return request ? { label: purchaseStatusLabel(request), progress: purchaseProgress(request) } : null;
  });

  protected readonly assignedMaterials = computed(() =>
    (this.node()?.materials ?? []).map((item) => {
      const material = this.inventory.find(item.materialId);
      return { item, material, total: item.quantity * (material?.unitCost ?? 0) };
    }),
  );

  protected readonly availableMaterials = computed(() => {
    const assigned = new Set(this.node()?.materials.map((m) => m.materialId));
    return this.inventory.all().filter((m) => m.kind !== 'purchased' && !assigned.has(m.id));
  });

  protected filesOf(kind: AttachmentKind): readonly Attachment[] {
    return this.node()?.attachments.filter((a) => a.kind === kind) ?? [];
  }

  protected update(changes: Partial<Omit<BomNode, 'id' | 'projectId' | 'parentId'>>): void {
    this.bom.update(this.nodeId(), changes);
  }

  protected setCustomField(change: CustomFieldChange): void {
    this.bom.setCustomField(this.nodeId(), change.fieldId, change.value);
  }

  protected updateCode(code: string): void {
    const trimmed = code.trim();
    if (!trimmed) return;
    if (this.bom.all().some((n) => n.code === trimmed && n.id !== this.nodeId())) {
      this.toast.error('رمز الجزء مستخدم مسبقاً', 'يجب أن يكون معرف الجزء فريداً');
      return;
    }
    this.update({ code: trimmed });
  }

  protected updateDiscipline(value: string): void {
    this.update({ discipline: value as Discipline });
  }

  protected updateUnit(value: string): void {
    this.update({ unit: value as Unit });
  }

  protected async onImage(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.update({ image: await readImageAsDataUrl(file) });
    this.toast.success('تم تحديث صورة المكون');
  }

  protected addFiles(files: Attachment[]): void {
    this.bom.addAttachments(this.nodeId(), files);
    this.toast.success(`تم رفع ${files.length} ملف`);
  }

  protected rejectFiles(files: RejectedFile[]): void {
    this.toast.warning('ملفات غير مقبولة', files.map((f) => f.name).join('، '));
  }

  protected removeFile(id: EntityId): void {
    this.bom.removeAttachment(this.nodeId(), id);
  }

  protected addMaterial(): void {
    const materialId = this.newMaterialId();
    const quantity = this.newMaterialQty();
    if (!materialId || quantity <= 0) return;
    this.bom.setMaterials(this.nodeId(), [...(this.node()?.materials ?? []), { materialId, quantity }]);
    this.newMaterialId.set('');
    this.newMaterialQty.set(1);
  }

  protected setMaterialQty(materialId: EntityId, quantity: number): void {
    this.bom.setMaterials(
      this.nodeId(),
      (this.node()?.materials ?? []).map((m) => (m.materialId === materialId ? { ...m, quantity: Math.max(0, quantity) } : m)),
    );
  }

  protected removeMaterial(materialId: EntityId): void {
    this.bom.setMaterials(this.nodeId(), (this.node()?.materials ?? []).filter((m) => m.materialId !== materialId));
  }

  protected decide(decision: SourcingDecision): void {
    if (this.node()?.decision === decision) return;
    const outcome = this.sourcing.decide(this.nodeId(), decision);
    if (decision === 'buy') {
      this.toast.success(
        'تم تحويل المكون إلى حوض الشراء',
        outcome.createdPurchase ? `أُنشئ طلب الشراء ${outcome.createdPurchase.number}` : 'طلب الشراء القائم ما زال فعالاً',
      );
    } else {
      this.toast.success('تم تحويل المكون إلى حوض الإنتاج', 'يمكنك الآن إعداد جدول مسار الإنتاج (Routing)');
      if (outcome.keptPurchase) this.toast.warning('طلب شراء قيد التنفيذ', `الطلب ${outcome.keptPurchase.number} بدأ مراحله ولم يُحذف`);
    }
  }

  protected async remove(): Promise<void> {
    const node = this.node();
    if (!node || !node.parentId) return;
    const descendants = this.bom.tree().descendants(node.id).length;
    const accepted = await this.confirm.ask({
      title: 'حذف المكون',
      message: descendants
        ? `سيتم حذف «${node.name}» مع ${descendants} مكون فرعي ومساراتها ومهامها.`
        : `سيتم حذف «${node.name}» ومساره ومهامه.`,
      confirmLabel: 'حذف نهائي',
      danger: true,
    });
    if (!accepted) return;
    const parentId = node.parentId;
    this.setup.removeComponent(node);
    this.toast.info('تم حذف المكون');
    void this.router.navigate(['/projects', this.projectId()], {
      queryParams: parentId === this.project()?.rootNodeId ? {} : { node: parentId },
    });
  }

  protected backToTree(): void {
    const node = this.node();
    const target = node && this.children().length ? node.id : node?.parentId;
    void this.router.navigate(['/projects', this.projectId()], {
      queryParams: !target || target === this.project()?.rootNodeId ? {} : { node: target },
    });
  }
}
