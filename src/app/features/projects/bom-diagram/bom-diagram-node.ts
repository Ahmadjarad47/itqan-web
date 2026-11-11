import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, output, signal } from '@angular/core';
import { ProjectInsightsQuery } from '@application/queries/project-insights.query';
import { BomStore } from '@application/state/bom.store';
import { EmployeeStore } from '@application/state/organization.store';
import { BomNode, DISCIPLINES, EntityId } from '@domain/models';
import { MoneyPipe, NumPipe } from '@shared/pipes/format.pipes';
import { Icon } from '@shared/ui/icon/icon';
import { NodeActions } from '../shared/node-actions';

/** One node of the BOM diagram; renders its own subtree recursively. */
@Component({
  selector: 'app-bom-diagram-node',
  imports: [Icon, MoneyPipe, NumPipe, NodeActions, BomDiagramNode],
  host: { '(document:click)': 'closeOnOutsideClick($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bom-diagram-node.html',
  styleUrl: './bom-diagram-node.scss',
})
export class BomDiagramNode {
  private readonly bom = inject(BomStore);
  private readonly insights = inject(ProjectInsightsQuery);
  private readonly employees = inject(EmployeeStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly node = input.required<BomNode>();
  readonly level = input(0);
  readonly root = input(false);
  readonly expandedIds = input.required<ReadonlySet<EntityId>>();

  readonly toggled = output<EntityId>();
  readonly opened = output<EntityId>();
  readonly tasksRequested = output<EntityId>();

  /** Three-option menu (details, route, tasks), shown on hover and toggled by click / Enter. */
  protected readonly menuOpen = signal(false);
  protected readonly owner = computed(() => this.employees.find(this.node().ownerId)?.name ?? null);

  protected readonly children = computed(() => this.bom.tree().children(this.node().id));
  protected readonly descendants = computed(() => this.bom.tree().descendants(this.node().id).length);
  protected readonly expanded = computed(() => this.expandedIds().has(this.node().id));
  protected readonly icon = computed(() => DISCIPLINES[this.node().discipline].icon);
  protected readonly discipline = computed(() => DISCIPLINES[this.node().discipline].label);
  protected readonly cost = computed(() => this.insights.costByNode().get(this.node().id)?.unitCost ?? 0);
  protected readonly progress = computed(() => Math.round(this.insights.progressByNode().get(this.node().id) ?? 0));

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeOnOutsideClick(event: Event): void {
    if (!this.menuOpen()) return;
    const ownNode = this.host.nativeElement.querySelector(':scope > .branch > .node');
    if (!ownNode?.contains(event.target as Node)) this.menuOpen.set(false);
  }

  protected toggle(event: Event): void {
    event.stopPropagation();
    this.toggled.emit(this.node().id);
  }
}
