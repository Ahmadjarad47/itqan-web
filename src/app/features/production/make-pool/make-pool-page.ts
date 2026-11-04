import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ProjectInsightsQuery } from '@application/queries/project-insights.query';
import { BomStore } from '@application/state/bom.store';
import { ProjectStore } from '@application/state/project.store';
import { RoutingStore } from '@application/state/routing.store';
import { maxDate, minDate, todayIso } from '@domain/rules';
import { ArDatePipe, MoneyPipe, NumPipe } from '@shared/pipes/format.pipes';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { ProductVisual } from '@shared/ui/product-visual/product-visual';
import { ProgressBar } from '@shared/ui/progress/progress';
import { StatCard } from '@shared/ui/stat-card/stat-card';

type PoolFilter = 'all' | 'unplanned' | 'running' | 'late' | 'done';

@Component({
  selector: 'app-make-pool-page',
  imports: [RouterLink, PageHeader, StatCard, Icon, ProductVisual, ProgressBar, EmptyState, MoneyPipe, NumPipe, ArDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './make-pool-page.html',
  styleUrl: './make-pool-page.scss',
})
export class MakePoolPage {
  private readonly router = inject(Router);
  private readonly bom = inject(BomStore);
  private readonly routing = inject(RoutingStore);
  private readonly insights = inject(ProjectInsightsQuery);
  protected readonly projects = inject(ProjectStore);

  protected readonly projectFilter = signal('');
  protected readonly filter = signal<PoolFilter>('all');
  protected readonly filters: { key: PoolFilter; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'unplanned', label: 'بلا مسار' },
    { key: 'running', label: 'قيد التنفيذ' },
    { key: 'late', label: 'متأخرة' },
    { key: 'done', label: 'منجزة' },
  ];

  private readonly items = computed(() => {
    const today = todayIso();
    const tree = this.bom.tree();
    return this.bom
      .all()
      .filter((node) => node.decision === 'make')
      .map((node) => {
        const ops = this.routing.forNode(node.id);
        const progress = ops.length
          ? ops.reduce((sum, op) => sum + (op.completed ? 100 : op.progressPercent), 0) / ops.length
          : 0;
        const state: PoolFilter = !ops.length
          ? 'unplanned'
          : ops.every((op) => op.completed)
            ? 'done'
            : ops.some((op) => !op.completed && op.latestFinish < today)
              ? 'late'
              : 'running';
        return {
          node,
          project: this.projects.find(node.projectId),
          level: tree.level(node.id),
          ops,
          hours: ops.reduce((sum, op) => sum + op.plannedHours, 0),
          external: ops.filter((op) => op.location === 'external').length,
          start: minDate(ops.map((op) => op.earliestStart)),
          end: maxDate(ops.map((op) => op.latestFinish)),
          progress,
          state,
          cost: this.insights.costByNode().get(node.id)?.operationCost ?? 0,
          lot: this.insights.lotSize(node.id),
        };
      })
      .sort((a, b) => a.node.code.localeCompare(b.node.code, 'en', { numeric: true }));
  });

  protected readonly counts = computed(() => {
    const result: Record<PoolFilter, number> = { all: 0, unplanned: 0, running: 0, late: 0, done: 0 };
    for (const item of this.items()) {
      if (this.projectFilter() && item.node.projectId !== this.projectFilter()) continue;
      result.all++;
      result[item.state]++;
    }
    return result;
  });

  protected readonly rows = computed(() =>
    this.items()
      .filter((item) => !this.projectFilter() || item.node.projectId === this.projectFilter())
      .filter((item) => this.filter() === 'all' || item.state === this.filter()),
  );

  protected readonly totals = computed(() => ({
    components: this.items().length,
    operations: this.routing.all().length,
    hours: this.routing.all().reduce((sum, op) => sum + op.plannedHours, 0),
    external: this.routing.all().filter((op) => op.location === 'external').length,
  }));

  protected open(nodeId: string): void {
    void this.router.navigate(['/production/routing', nodeId]);
  }
}
