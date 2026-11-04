import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ProjectInsightsQuery } from '@application/queries/project-insights.query';
import { BomStore } from '@application/state/bom.store';
import { CustomFieldStore } from '@application/state/custom-field.store';
import { InventoryStore } from '@application/state/inventory.store';
import { RoutingStore, WorkstationStore } from '@application/state/routing.store';
import { ProductionUseCase } from '@application/use-cases/production.use-case';
import { ToastService } from '@core/feedback/toast.service';
import {
  EntityId,
  INPUT_KIND_LABELS,
  OperationInputKind,
  OperationLocation,
  ProgressMode,
  RoutingOperation,
  UNIT_LABELS,
} from '@domain/models';
import { operationUnitCost } from '@domain/rules';
import { MoneyPipe, NumPipe } from '@shared/pipes/format.pipes';
import { CustomFieldChange, CustomFieldsForm } from '@shared/ui/custom-fields/custom-fields-form';
import { Icon } from '@shared/ui/icon/icon';

type OpChanges = Partial<Omit<RoutingOperation, 'id' | 'nodeId'>>;

/** Full editor of a routing operation; every change is saved immediately. */
@Component({
  selector: 'app-operation-form',
  imports: [Icon, CustomFieldsForm, MoneyPipe, NumPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './operation-form.html',
  styleUrl: './operation-form.scss',
})
export class OperationForm {
  private readonly routing = inject(RoutingStore);
  private readonly production = inject(ProductionUseCase);
  private readonly bom = inject(BomStore);
  private readonly insights = inject(ProjectInsightsQuery);
  private readonly toast = inject(ToastService);
  protected readonly inventory = inject(InventoryStore);
  protected readonly workstations = inject(WorkstationStore);

  private readonly fieldDefinitions = inject(CustomFieldStore);

  readonly operation = input.required<RoutingOperation>();
  readonly readonly = input(false);

  protected readonly customFields = computed(() => this.fieldDefinitions.activeFor('operation'));

  protected readonly unitLabels = UNIT_LABELS;
  protected readonly inputKinds = Object.keys(INPUT_KIND_LABELS) as OperationInputKind[];
  protected readonly inputKindLabels = INPUT_KIND_LABELS;
  protected readonly newInputKind = signal<OperationInputKind>('component');
  protected readonly newInputRef = signal('');
  protected readonly newInputQty = signal(1);
  protected readonly newConsumable = signal('');
  protected readonly newConsumableQty = signal(1);
  protected readonly reworkTo = signal<number | null>(null);

  protected readonly lot = computed(() => this.insights.lotSize(this.operation().nodeId));
  protected readonly cost = computed(() =>
    operationUnitCost(this.operation(), this.workstations.find(this.operation().workstationId), this.inventory.byId(), this.lot()),
  );
  protected readonly siblings = computed(() => this.routing.forNode(this.operation().nodeId));

  /** Candidate inputs per kind: raw materials, sub-components (any level below), other operation outputs. */
  protected readonly inputOptions = computed(() => {
    const nodeId = this.operation().nodeId;
    const tree = this.bom.tree();
    const descendants = tree.descendants(nodeId);
    const ops = [...this.siblings().filter((op) => op.sequence < this.operation().sequence)];
    for (const child of tree.children(nodeId)) ops.push(...this.routing.forNode(child.id));
    return {
      material: this.inventory.rawMaterials().map((m) => ({ id: m.id, label: `${m.code} — ${m.name}` })),
      component: descendants.map((n) => ({ id: n.id, label: `${n.code} — ${n.name}` })),
      operation: ops.map((op) => ({
        id: op.id,
        label: `${this.bom.find(op.nodeId)?.code} / ${op.sequence} — ${op.name}`,
      })),
    } satisfies Record<OperationInputKind, { id: string; label: string }[]>;
  });

  protected setCustomField(change: CustomFieldChange): void {
    this.routing.setCustomField(this.operation().id, change.fieldId, change.value);
  }

  protected update(changes: OpChanges): void {
    this.routing.update(this.operation().id, changes);
  }

  protected setNumber(field: 'sequence' | 'plannedHours' | 'actualHours' | 'setupMinutes' | 'runMinutesPerUnit' | 'externalUnitCost' | 'completedQuantity', value: number): void {
    this.update({ [field]: Math.max(0, value || 0) });
  }

  protected setLocation(location: OperationLocation): void {
    this.update({ location });
  }

  protected setWorkstation(id: string): void {
    this.update({ workstationId: id || null });
  }

  protected setProgressMode(mode: ProgressMode): void {
    this.update({ progressMode: mode });
  }

  protected setProgress(value: number): void {
    this.update({ progressPercent: Math.min(100, Math.max(0, value || 0)) });
  }

  protected setCompleted(done: boolean): void {
    this.production.setCompleted(this.operation().id, done);
  }

  protected setOnTime(onTime: boolean): void {
    this.update(onTime ? { onTime, delayReason: '' } : { onTime });
  }

  protected inputLabel(kind: OperationInputKind, refId: EntityId): string {
    return this.inputOptions()[kind].find((o) => o.id === refId)?.label ?? refId;
  }

  protected addInput(): void {
    if (!this.newInputRef()) return;
    this.update({
      inputs: [...this.operation().inputs, { kind: this.newInputKind(), refId: this.newInputRef(), quantity: this.newInputQty() || 1 }],
    });
    this.newInputRef.set('');
    this.newInputQty.set(1);
  }

  protected removeInput(index: number): void {
    this.update({ inputs: this.operation().inputs.filter((_, i) => i !== index) });
  }

  protected addConsumable(): void {
    if (!this.newConsumable()) return;
    this.update({
      consumables: [...this.operation().consumables, { materialId: this.newConsumable(), quantity: this.newConsumableQty() || 1 }],
    });
    this.newConsumable.set('');
    this.newConsumableQty.set(1);
  }

  protected removeConsumable(materialId: EntityId): void {
    this.update({ consumables: this.operation().consumables.filter((c) => c.materialId !== materialId) });
  }

  protected passQc(): void {
    this.update({ qcStatus: 'passed', reworkSequence: null });
    this.toast.success('اجتازت العملية فحص الجودة');
  }

  protected rejectQc(): void {
    const target = this.reworkTo() ?? this.operation().sequence;
    this.production.rejectQuality(this.operation().id, target, this.operation().qcNote);
    this.toast.warning('رُفضت العملية في فحص الجودة', `العودة إلى العملية ${target}`);
  }
}
