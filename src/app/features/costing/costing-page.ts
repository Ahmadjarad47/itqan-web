import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ProjectInsightsQuery } from '@application/queries/project-insights.query';
import { BomStore } from '@application/state/bom.store';
import { InventoryStore } from '@application/state/inventory.store';
import { ProjectStore } from '@application/state/project.store';
import { BomNode, EntityId, UNIT_LABELS } from '@domain/models';
import { CostLine } from '@domain/rules';
import { MoneyPipe, NumPipe } from '@shared/pipes/format.pipes';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatCard } from '@shared/ui/stat-card/stat-card';

interface CostRow {
  readonly line: CostLine;
  readonly node: BomNode;
  readonly depth: number;
  readonly hasChildren: boolean;
  readonly share: number;
}

@Component({
  selector: 'app-costing-page',
  imports: [RouterLink, PageHeader, StatCard, Icon, EmptyState, MoneyPipe, NumPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './costing-page.html',
  styleUrl: './costing-page.scss',
})
export class CostingPage {
  private readonly router = inject(Router);
  private readonly insights = inject(ProjectInsightsQuery);
  private readonly bom = inject(BomStore);
  protected readonly projects = inject(ProjectStore);
  protected readonly inventory = inject(InventoryStore);

  /** Selected project from the `project` query parameter. */
  readonly project = input<EntityId>();

  protected readonly unitLabels = UNIT_LABELS;
  protected readonly selectedId = computed(() => this.project() ?? this.projects.sorted()[0]?.id ?? '');
  protected readonly selected = computed(() => this.projects.find(this.selectedId()));
  protected readonly root = computed(() => this.insights.costByProject().get(this.selectedId()));

  protected readonly expanded = linkedSignal<ReadonlySet<EntityId>>(() => {
    const root = this.root();
    if (!root) return new Set();
    return new Set([root.nodeId, ...root.children.map((child) => child.nodeId)]);
  });

  protected readonly rows = computed<CostRow[]>(() => {
    const root = this.root();
    if (!root) return [];
    const rows: CostRow[] = [];
    const visit = (line: CostLine, depth: number) => {
      const node = this.bom.find(line.nodeId);
      if (!node) return;
      rows.push({
        line,
        node,
        depth,
        hasChildren: line.children.length > 0,
        share: root.unitCost ? (line.extendedCost * this.bom.tree().quantityPerEndProduct(line.nodeId)) / line.quantity / root.unitCost : 0,
      });
      if (this.expanded().has(line.nodeId)) line.children.forEach((child) => visit(child, depth + 1));
    };
    visit(root, 0);
    return rows;
  });

  /** Totals per end product, split into material and processing cost across all levels. */
  protected readonly structure = computed(() => {
    const root = this.root();
    if (!root) return { material: 0, operations: 0 };
    let material = 0;
    let operations = 0;
    const tree = this.bom.tree();
    const visit = (line: CostLine) => {
      const factor = tree.quantityPerEndProduct(line.nodeId);
      material += line.ownMaterial * factor;
      operations += line.operationCost * factor;
      line.children.forEach(visit);
    };
    visit(root);
    return { material, operations };
  });

  protected readonly mainComponents = computed(() => {
    const root = this.root();
    if (!root) return [];
    const max = Math.max(1, ...root.children.map((c) => c.extendedCost));
    return root.children.map((line) => ({ line, node: this.bom.find(line.nodeId)!, ratio: line.extendedCost / max }));
  });

  /** Raw materials used anywhere in the selected project, for what-if price changes. */
  protected readonly projectMaterials = computed(() => {
    const ids = new Set<EntityId>();
    for (const node of this.bom.all()) {
      if (node.projectId !== this.selectedId()) continue;
      node.materials.forEach((m) => ids.add(m.materialId));
    }
    return this.inventory.all().filter((m) => ids.has(m.id));
  });

  protected selectProject(id: string): void {
    void this.router.navigate([], { queryParams: { project: id } });
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
    const root = this.root();
    if (root) this.expanded.set(new Set([root.nodeId, ...this.bom.tree().descendants(root.nodeId).map((n) => n.id)]));
  }

  protected collapseAll(): void {
    const root = this.root();
    if (root) this.expanded.set(new Set([root.nodeId]));
  }

  protected setMaterialPrice(id: EntityId, value: number): void {
    if (value >= 0) this.inventory.update(id, { unitCost: value });
  }

  protected setBuyPrice(id: EntityId, value: number): void {
    this.bom.update(id, { purchaseUnitPrice: value >= 0 ? value : null });
  }
}
