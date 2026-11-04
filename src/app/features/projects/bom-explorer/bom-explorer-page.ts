import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, linkedSignal, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ProjectInsightsQuery } from '@application/queries/project-insights.query';
import { BomStore } from '@application/state/bom.store';
import { ProjectStore } from '@application/state/project.store';
import { BomNode, DISCIPLINES, EntityId, levelTitle, UNIT_LABELS } from '@domain/models';
import { MoneyPipe, NumPipe } from '@shared/pipes/format.pipes';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { ProductVisual } from '@shared/ui/product-visual/product-visual';
import { ProgressBar, ProgressRing } from '@shared/ui/progress/progress';
import { AddComponentDialog } from '../shared/add-component-dialog';
import { DecisionBadge } from '../shared/decision-badge';
import { BomTreeRow } from './bom-tree-row';

const CLICK_DELAY_MS = 230;

@Component({
  selector: 'app-bom-explorer-page',
  imports: [
    RouterLink,
    Icon,
    ProductVisual,
    ProgressBar,
    ProgressRing,
    DecisionBadge,
    EmptyState,
    AddComponentDialog,
    BomTreeRow,
    MoneyPipe,
    NumPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bom-explorer-page.html',
  styleUrl: './bom-explorer-page.scss',
})
export class BomExplorerPage {
  private readonly router = inject(Router);
  private readonly projects = inject(ProjectStore);
  protected readonly bom = inject(BomStore);
  protected readonly insights = inject(ProjectInsightsQuery);

  /** Route param and query param bound through component input binding. */
  readonly projectId = input.required<EntityId>();
  readonly node = input<EntityId>();

  protected readonly unitLabels = UNIT_LABELS;
  protected readonly view = signal<'cards' | 'tree'>('cards');
  protected readonly adding = signal(false);
  protected readonly filter = signal('');
  private clickTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly project = computed(() => this.projects.find(this.projectId()));
  protected readonly currentId = computed(() => this.node() ?? this.project()?.rootNodeId ?? '');
  protected readonly current = computed(() => this.bom.find(this.currentId()));
  protected readonly path = computed(() => this.bom.tree().path(this.currentId()));
  protected readonly level = computed(() => Math.max(0, this.path().length - 1));
  protected readonly levelTitle = computed(() => levelTitle(this.level()));
  protected readonly childLevelTitle = computed(() => levelTitle(this.level() + 1));

  protected readonly children = computed(() => {
    const term = this.filter().trim();
    const items = this.bom.tree().children(this.currentId());
    return term ? items.filter((n) => n.name.includes(term) || n.code.toLowerCase().includes(term.toLowerCase())) : items;
  });

  protected readonly currentCost = computed(() => this.insights.costByNode().get(this.currentId()));
  protected readonly currentProgress = computed(() => this.insights.progressByNode().get(this.currentId()) ?? 0);
  protected readonly lotSize = computed(() => this.insights.lotSize(this.currentId()));

  /** Outline view: everything expanded down to the current level by default. */
  protected readonly expanded = linkedSignal<ReadonlySet<EntityId>>(
    () => new Set([this.currentId(), ...this.bom.tree().children(this.currentId()).map((n) => n.id)]),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.clickTimer));
  }

  protected childCount(id: EntityId): number {
    return this.bom.tree().children(id).length;
  }

  protected icon(node: BomNode): string {
    return DISCIPLINES[node.discipline].icon;
  }

  protected discipline(node: BomNode): string {
    return DISCIPLINES[node.discipline].label;
  }

  /** Single click drills down; a double click cancels it and opens the detail page. */
  protected onCardClick(node: BomNode): void {
    clearTimeout(this.clickTimer);
    this.clickTimer = setTimeout(() => {
      if (this.childCount(node.id)) this.drill(node.id);
      else this.openDetail(node.id);
    }, CLICK_DELAY_MS);
  }

  protected onCardDoubleClick(node: BomNode): void {
    clearTimeout(this.clickTimer);
    this.openDetail(node.id);
  }

  protected drill(nodeId: EntityId): void {
    this.filter.set('');
    const isRoot = nodeId === this.project()?.rootNodeId;
    void this.router.navigate(['/projects', this.projectId()], { queryParams: isRoot ? {} : { node: nodeId } });
  }

  protected goUp(): void {
    const parent = this.current()?.parentId;
    if (parent) this.drill(parent);
    else void this.router.navigate(['/projects']);
  }

  protected openDetail(nodeId: EntityId): void {
    void this.router.navigate(['/projects', this.projectId(), 'items', nodeId]);
  }

  protected toggle(id: EntityId): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected expandAll(): void {
    this.expanded.set(new Set([this.currentId(), ...this.bom.tree().descendants(this.currentId()).map((n) => n.id)]));
  }
}
