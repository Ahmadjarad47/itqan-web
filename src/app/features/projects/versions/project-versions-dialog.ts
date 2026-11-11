import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthorizationService } from '@application/auth/authorization.service';
import { ProjectInsightsQuery } from '@application/queries/project-insights.query';
import { InventoryStore } from '@application/state/inventory.store';
import { EmployeeStore } from '@application/state/organization.store';
import { ProjectStore } from '@application/state/project.store';
import { ProjectVersionStore } from '@application/state/project-version.store';
import { WorkstationStore } from '@application/state/routing.store';
import { ProjectVersioningUseCase } from '@application/use-cases/project-versioning.use-case';
import { ConfirmService } from '@core/feedback/confirm.service';
import { ToastService } from '@core/feedback/toast.service';
import { EntityId, ProjectVersion, RoutingOperation } from '@domain/models';
import { BomTree, rollUpCost, TREE_CHANGE_LABELS, TreeDiff } from '@domain/rules';
import { ArDatePipe, MoneyPipe } from '@shared/pipes/format.pipes';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';

interface VersionRow {
  readonly version: ProjectVersion;
  readonly components: number;
  readonly levels: number;
  readonly operations: number;
  readonly unitCost: number | null;
  readonly author: string;
}

/** Save, compare, restore and branch versions of a project's tree and routings. */
@Component({
  selector: 'app-project-versions-dialog',
  imports: [Modal, Icon, ArDatePipe, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-versions-dialog.html',
  styleUrl: './project-versions-dialog.scss',
})
export class ProjectVersionsDialog {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthorizationService);
  private readonly projects = inject(ProjectStore);
  private readonly versions = inject(ProjectVersionStore);
  private readonly versioning = inject(ProjectVersioningUseCase);
  private readonly insights = inject(ProjectInsightsQuery);
  private readonly inventory = inject(InventoryStore);
  private readonly workstations = inject(WorkstationStore);
  private readonly employees = inject(EmployeeStore);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly open = model(false);
  readonly projectId = input.required<EntityId>();

  protected readonly changeLabels = TREE_CHANGE_LABELS;
  protected readonly label = signal('');
  protected readonly note = signal('');
  protected readonly comparing = signal<EntityId | null>(null);
  protected readonly branching = signal<EntityId | null>(null);
  protected readonly branchDraft = signal({ code: '', name: '', customer: '' });

  protected readonly canSave = computed(() => this.auth.can('bom.edit') || this.auth.can('projects.manage'));
  protected readonly canManage = computed(() => this.auth.can('projects.manage'));
  protected readonly project = computed(() => this.projects.find(this.projectId()));
  protected readonly nextNumber = computed(() => this.versions.nextNumber(this.projectId()));

  protected readonly current = computed(() => {
    const state = this.versioning.current(this.projectId());
    return {
      components: state.nodes.length,
      operations: state.operations.length,
      unitCost: this.insights.costByProject().get(this.projectId())?.unitCost ?? null,
    };
  });

  protected readonly rows = computed<VersionRow[]>(() =>
    this.versions.forProject(this.projectId()).map((version) => {
      const tree = new BomTree(version.nodes);
      const root = version.nodes.find((n) => n.parentId === null);
      return {
        version,
        components: version.nodes.length,
        levels: root ? tree.depth(root.id) + 1 : 0,
        operations: version.operations.length,
        unitCost: root ? this.costOf(version, tree, root.id) : null,
        author: this.employees.find(version.createdById)?.name ?? '—',
      };
    }),
  );

  /** Changes made since the latest saved version (unsaved work). */
  protected readonly pending = computed<TreeDiff | null>(() => {
    const latest = this.versions.latest(this.projectId());
    return latest ? this.versioning.diff(latest) : null;
  });

  protected readonly comparison = computed(() => {
    const version = this.versions.find(this.comparing());
    return version ? this.versioning.diff(version) : null;
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      this.label.set('');
      this.note.set('');
      this.comparing.set(null);
      this.branching.set(null);
    });
  }

  /** Unit cost of the version's design at today's material and labour prices. */
  private costOf(version: ProjectVersion, tree: BomTree, rootId: EntityId): number | null {
    const operationsByNode = new Map<EntityId, RoutingOperation[]>();
    for (const op of version.operations) operationsByNode.set(op.nodeId, [...(operationsByNode.get(op.nodeId) ?? []), op]);
    try {
      return rollUpCost(rootId, {
        tree,
        operationsByNode,
        materials: this.inventory.byId(),
        workstations: this.workstations.byId(),
        productionQuantity: this.project()?.productionQuantity ?? 1,
      }).unitCost;
    } catch {
      return null;
    }
  }

  protected changeCount(diff: TreeDiff | null): number {
    return diff ? diff.added.length + diff.removed.length + diff.changed.length : 0;
  }

  protected save(): void {
    const version = this.versioning.save(this.projectId(), this.label(), this.note());
    this.label.set('');
    this.note.set('');
    this.toast.success('تم حفظ الإصدار', `v${version.number} — ${version.label}`);
  }

  protected toggleCompare(id: EntityId): void {
    this.branching.set(null);
    this.comparing.update((current) => (current === id ? null : id));
  }

  protected async restore(version: ProjectVersion): Promise<void> {
    const accepted = await this.confirm.ask({
      title: `استعادة v${version.number}`,
      message: `ستعود الشجرة ومسارات التصنيع إلى «${version.label}». المكونات المضافة بعده ستُحذف مع مهامها. تُحفظ الحالة الحالية تلقائياً كإصدار قبل الاستعادة، ويُحتفظ بالإنجاز المسجل للعمليات الموجودة.`,
      confirmLabel: 'استعادة',
      danger: true,
    });
    if (!accepted) return;
    const backup = this.versioning.restore(version.id);
    this.comparing.set(null);
    if (backup) this.toast.success(`تمت استعادة v${version.number}`, `الحالة السابقة محفوظة كـ v${backup.number}`);
    void this.router.navigate(['/projects', this.projectId()]);
  }

  protected startBranch(version: ProjectVersion): void {
    this.comparing.set(null);
    const project = this.project();
    this.branchDraft.set({
      code: `${project?.code ?? ''}-V${version.number}`,
      name: `${project?.name ?? ''} (من v${version.number})`,
      customer: project?.customer ?? '',
    });
    this.branching.update((current) => (current === version.id ? null : version.id));
  }

  protected patchBranch(changes: Partial<{ code: string; name: string; customer: string }>): void {
    this.branchDraft.update((draft) => ({ ...draft, ...changes }));
  }

  protected branch(version: ProjectVersion): void {
    const draft = this.branchDraft();
    const code = draft.code.trim().toUpperCase();
    if (!/^[A-Z0-9-]+$/.test(code) || !draft.name.trim() || !draft.customer.trim()) {
      this.toast.warning('أدخل رمزاً صالحاً (أحرف لاتينية وأرقام) واسماً وعميلاً');
      return;
    }
    if (this.projects.all().some((p) => p.code.toUpperCase() === code)) {
      this.toast.error('رمز المشروع مستخدم مسبقاً');
      return;
    }
    const project = this.versioning.branch(version.id, { code, name: draft.name.trim(), customer: draft.customer.trim() });
    if (!project) return;
    this.open.set(false);
    this.toast.success('تم إنشاء مشروع من الإصدار', `${project.code} — من v${version.number}`);
    void this.router.navigate(['/projects', project.id]);
  }

  protected async remove(version: ProjectVersion): Promise<void> {
    const accepted = await this.confirm.ask({
      title: 'حذف الإصدار',
      message: `سيتم حذف الإصدار v${version.number} «${version.label}» نهائياً. لا يتأثر المشروع الحالي.`,
      confirmLabel: 'حذف',
      danger: true,
    });
    if (accepted) this.versions.remove(version.id);
  }
}
