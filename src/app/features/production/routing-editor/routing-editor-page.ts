import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthorizationService } from '@application/auth/authorization.service';
import { ProjectInsightsQuery } from '@application/queries/project-insights.query';
import { BomStore } from '@application/state/bom.store';
import { InventoryStore } from '@application/state/inventory.store';
import { ProjectStore } from '@application/state/project.store';
import { RoutingStore, WorkstationStore } from '@application/state/routing.store';
import { ProductionUseCase } from '@application/use-cases/production.use-case';
import { CanDirective } from '@core/auth/can.directive';
import { ConfirmService } from '@core/feedback/confirm.service';
import { ToastService } from '@core/feedback/toast.service';
import { EntityId, RoutingOperation, UNIT_LABELS } from '@domain/models';
import { operationProgress, operationUnitCost, todayIso } from '@domain/rules';
import { ArDatePipe, MoneyPipe, NumPipe } from '@shared/pipes/format.pipes';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';
import { ProductVisual } from '@shared/ui/product-visual/product-visual';
import { ProgressBar, ProgressRing } from '@shared/ui/progress/progress';
import { OperationForm } from './operation-form';

@Component({
  selector: 'app-routing-editor-page',
  imports: [RouterLink, CanDirective, Icon, Modal, ProductVisual, ProgressBar, ProgressRing, EmptyState, OperationForm, MoneyPipe, NumPipe, ArDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './routing-editor-page.html',
  styleUrl: './routing-editor-page.scss',
})
export class RoutingEditorPage {
  private readonly routing = inject(RoutingStore);
  private readonly production = inject(ProductionUseCase);
  private readonly inventory = inject(InventoryStore);
  private readonly projects = inject(ProjectStore);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly bom = inject(BomStore);
  protected readonly workstations = inject(WorkstationStore);
  protected readonly insights = inject(ProjectInsightsQuery);

  readonly nodeId = input.required<EntityId>();

  private readonly auth = inject(AuthorizationService);
  protected readonly canEdit = computed(() => this.auth.can('routing.edit'));
  protected readonly unitLabels = UNIT_LABELS;
  protected readonly today = todayIso();
  protected readonly editingId = signal<EntityId | null>(null);
  protected readonly drawerOpen = signal(false);

  protected readonly node = computed(() => this.bom.find(this.nodeId()));
  protected readonly project = computed(() => this.projects.find(this.node()?.projectId));
  protected readonly level = computed(() => this.bom.tree().level(this.nodeId()));
  protected readonly lot = computed(() => this.insights.lotSize(this.nodeId()));
  protected readonly editing = computed(() => this.routing.find(this.editingId()));

  protected readonly rows = computed(() =>
    this.routing.forNode(this.nodeId()).map((op) => ({
      op,
      workstation: this.workstations.find(op.workstationId),
      cost: operationUnitCost(op, this.workstations.find(op.workstationId), this.inventory.byId(), this.lot()).total,
      progress: operationProgress(op, this.lot()),
      late: !op.completed && op.latestFinish < this.today,
    })),
  );

  protected readonly summary = computed(() => {
    const rows = this.rows();
    return {
      planned: rows.reduce((s, r) => s + r.op.plannedHours, 0),
      actual: rows.reduce((s, r) => s + r.op.actualHours, 0),
      cost: rows.reduce((s, r) => s + r.cost, 0),
      progress: this.insights.progressByNode().get(this.nodeId()) ?? 0,
      external: rows.filter((r) => r.op.location === 'external').length,
    };
  });

  protected edit(op: RoutingOperation): void {
    this.editingId.set(op.id);
    this.drawerOpen.set(true);
  }

  protected add(): void {
    const op = this.routing.createBlank(this.nodeId());
    this.edit(op);
  }

  protected toggleCompleted(op: RoutingOperation, done: boolean): void {
    this.production.setCompleted(op.id, done);
    if (done && op.consumables.length && !op.consumablesPosted) {
      this.toast.info('تم خصم المواد المستهلكة من المستودع', op.name);
    }
  }

  protected async remove(op: RoutingOperation): Promise<void> {
    const accepted = await this.confirm.ask({
      title: 'حذف العملية',
      message: `حذف العملية ${op.sequence} — ${op.name}؟`,
      confirmLabel: 'حذف',
      danger: true,
    });
    if (!accepted) return;
    this.routing.remove(op.id);
    this.toast.info('تم حذف العملية');
  }
}
