import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ProjectInsightsQuery } from '@application/queries/project-insights.query';
import { BomStore } from '@application/state/bom.store';
import { BomNode, DISCIPLINES, EntityId } from '@domain/models';
import { MoneyPipe, NumPipe } from '@shared/pipes/format.pipes';
import { Icon } from '@shared/ui/icon/icon';
import { ProgressBar } from '@shared/ui/progress/progress';
import { DecisionBadge } from '../shared/decision-badge';

/** One row of the recursive outline view; renders its children recursively. */
@Component({
  selector: 'app-bom-tree-row',
  imports: [Icon, ProgressBar, DecisionBadge, MoneyPipe, NumPipe, BomTreeRow],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row-line" [style.--depth]="depth()" (dblclick)="opened.emit(node().id)">
      <button type="button" class="toggle" [class.hidden]="!children().length" (click)="toggled.emit(node().id)" [attr.aria-label]="expanded() ? 'طي' : 'توسيع'">
        <app-icon [name]="expanded() ? 'chevron-down' : 'chevron-left'" [size]="16" />
      </button>
      <span class="lvl num">L{{ depth() }}</span>
      <span class="icon"><app-icon [name]="icon()" [size]="15" /></span>
      <span class="code">{{ node().code }}</span>
      <button type="button" class="name" (click)="opened.emit(node().id)">{{ node().name }}</button>
      <span class="qty num">× {{ node().quantity | num }}</span>
      <app-decision-badge [decision]="node().decision" />
      <span class="cost num">{{ cost() | money }}</span>
      <app-progress-bar class="progress" [value]="progress()" />
    </div>
    @if (expanded()) {
      @for (child of children(); track child.id) {
        <app-bom-tree-row
          [node]="child"
          [depth]="depth() + 1"
          [expandedIds]="expandedIds()"
          (toggled)="toggled.emit($event)"
          (opened)="opened.emit($event)"
        />
      }
    }
  `,
  styleUrl: './bom-tree-row.scss',
})
export class BomTreeRow {
  private readonly bom = inject(BomStore);
  private readonly insights = inject(ProjectInsightsQuery);

  readonly node = input.required<BomNode>();
  readonly depth = input(0);
  readonly expandedIds = input.required<ReadonlySet<EntityId>>();
  readonly toggled = output<EntityId>();
  readonly opened = output<EntityId>();

  protected readonly children = computed(() => this.bom.tree().children(this.node().id));
  protected readonly expanded = computed(() => this.expandedIds().has(this.node().id));
  protected readonly icon = computed(() => DISCIPLINES[this.node().discipline].icon);
  protected readonly cost = computed(() => this.insights.costByNode().get(this.node().id)?.unitCost ?? 0);
  protected readonly progress = computed(() => this.insights.progressByNode().get(this.node().id) ?? 0);
}
