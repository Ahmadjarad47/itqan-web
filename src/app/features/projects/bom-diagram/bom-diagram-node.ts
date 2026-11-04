import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ProjectInsightsQuery } from '@application/queries/project-insights.query';
import { BomStore } from '@application/state/bom.store';
import { BomNode, DISCIPLINES, EntityId } from '@domain/models';
import { MoneyPipe, NumPipe } from '@shared/pipes/format.pipes';
import { Icon } from '@shared/ui/icon/icon';

/** One node of the BOM diagram; renders its own subtree recursively. */
@Component({
  selector: 'app-bom-diagram-node',
  imports: [Icon, MoneyPipe, NumPipe, BomDiagramNode],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bom-diagram-node.html',
  styleUrl: './bom-diagram-node.scss',
})
export class BomDiagramNode {
  private readonly bom = inject(BomStore);
  private readonly insights = inject(ProjectInsightsQuery);

  readonly node = input.required<BomNode>();
  readonly level = input(0);
  readonly root = input(false);
  readonly expandedIds = input.required<ReadonlySet<EntityId>>();

  readonly toggled = output<EntityId>();
  readonly opened = output<EntityId>();

  protected readonly children = computed(() => this.bom.tree().children(this.node().id));
  protected readonly descendants = computed(() => this.bom.tree().descendants(this.node().id).length);
  protected readonly expanded = computed(() => this.expandedIds().has(this.node().id));
  protected readonly icon = computed(() => DISCIPLINES[this.node().discipline].icon);
  protected readonly discipline = computed(() => DISCIPLINES[this.node().discipline].label);
  protected readonly cost = computed(() => this.insights.costByNode().get(this.node().id)?.unitCost ?? 0);
  protected readonly progress = computed(() => Math.round(this.insights.progressByNode().get(this.node().id) ?? 0));

  protected toggle(event: Event): void {
    event.stopPropagation();
    this.toggled.emit(this.node().id);
  }
}
