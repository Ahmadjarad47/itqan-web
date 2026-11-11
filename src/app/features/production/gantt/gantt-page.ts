import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BomStore } from '@application/state/bom.store';
import { ProjectStore } from '@application/state/project.store';
import { RoutingStore, WorkstationStore } from '@application/state/routing.store';
import { BomNode, IsoDate, RoutingOperation } from '@domain/models';
import { addDays, diffDays, maxDate, minDate, parseIsoDate, todayIso } from '@domain/rules';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';

type BarState = 'done' | 'active' | 'late' | 'planned' | 'external';

interface GanttBar {
  readonly op: RoutingOperation;
  readonly offset: number;
  readonly span: number;
  readonly state: BarState;
  readonly progress: number;
  readonly label: string;
}

interface GanttGroup {
  readonly node: BomNode;
  readonly level: number;
  readonly offset: number;
  readonly span: number;
  readonly bars: readonly GanttBar[];
}

const monthFormat = new Intl.DateTimeFormat('ar-SY-u-nu-latn', { month: 'long', year: 'numeric' });

@Component({
  selector: 'app-gantt-page',
  imports: [RouterLink, PageHeader, Icon, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gantt-page.html',
  styleUrl: './gantt-page.scss',
})
export class GanttPage {
  private readonly router = inject(Router);
  private readonly bom = inject(BomStore);
  private readonly routing = inject(RoutingStore);
  private readonly workstations = inject(WorkstationStore);
  protected readonly projects = inject(ProjectStore);

  protected readonly today = todayIso();
  protected readonly projectFilter = signal('');
  protected readonly levelFilter = signal('all');
  protected readonly componentFilter = signal('');
  protected readonly hideCompleted = signal(false);
  protected readonly dayWidth = signal(30);

  protected readonly legend: { state: BarState; label: string }[] = [
    { state: 'done', label: 'منجزة' },
    { state: 'active', label: 'قيد التنفيذ' },
    { state: 'late', label: 'متأخرة' },
    { state: 'planned', label: 'مخططة' },
    { state: 'external', label: 'خارجية' },
  ];

  protected readonly componentOptions = computed(() =>
    this.bom
      .all()
      .filter((n) => (!this.projectFilter() || n.projectId === this.projectFilter()) && this.routing.forNode(n.id).length)
      .sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true })),
  );

  private readonly filteredOps = computed(() => {
    const tree = this.bom.tree();
    const level = this.levelFilter();
    const component = this.componentFilter();
    const scope = component ? new Set([component, ...tree.descendants(component).map((n) => n.id)]) : null;
    return this.routing.all().filter((op) => {
      const node = this.bom.find(op.nodeId);
      if (!node) return false;
      if (this.projectFilter() && node.projectId !== this.projectFilter()) return false;
      if (scope && !scope.has(node.id)) return false;
      if (this.hideCompleted() && op.completed) return false;
      if (level !== 'all') {
        const nodeLevel = tree.level(node.id);
        if (level === '3' ? nodeLevel < 3 : nodeLevel !== +level) return false;
      }
      return true;
    });
  });

  protected readonly range = computed(() => {
    const ops = this.filteredOps();
    const start = addDays(minDate([...ops.map((op) => op.earliestStart), this.today]) ?? this.today, -2);
    const end = addDays(maxDate([...ops.map((op) => op.latestFinish), this.today]) ?? this.today, 3);
    return { start, length: diffDays(start, end) + 1 };
  });

  protected readonly days = computed(() => {
    const { start, length } = this.range();
    return Array.from({ length }, (_, i) => {
      const iso = addDays(start, i);
      const date = parseIsoDate(iso);
      const weekday = date.getDay();
      return { iso, day: date.getDate(), weekend: weekday === 5 || weekday === 6, today: iso === this.today };
    });
  });

  protected readonly months = computed(() => {
    const result: { label: string; span: number }[] = [];
    for (const day of this.days()) {
      const label = monthFormat.format(parseIsoDate(day.iso));
      const last = result.at(-1);
      if (last?.label === label) result[result.length - 1] = { label, span: last.span + 1 };
      else result.push({ label, span: 1 });
    }
    return result;
  });

  protected readonly todayOffset = computed(() => diffDays(this.range().start, this.today));

  protected readonly groups = computed<GanttGroup[]>(() => {
    const tree = this.bom.tree();
    const start = this.range().start;
    const byNode = new Map<string, RoutingOperation[]>();
    for (const op of this.filteredOps()) {
      const list = byNode.get(op.nodeId) ?? [];
      list.push(op);
      byNode.set(op.nodeId, list);
    }
    return [...byNode.entries()]
      .map(([nodeId, ops]) => {
        const node = this.bom.find(nodeId)!;
        const sorted = [...ops].sort((a, b) => a.sequence - b.sequence);
        const groupStart = minDate(sorted.map((o) => o.earliestStart))!;
        const groupEnd = maxDate(sorted.map((o) => o.latestFinish))!;
        return {
          node,
          level: tree.level(nodeId),
          offset: diffDays(start, groupStart),
          span: diffDays(groupStart, groupEnd) + 1,
          bars: sorted.map((op) => this.toBar(op, start)),
        };
      })
      .sort((a, b) => a.node.projectId.localeCompare(b.node.projectId) || a.node.code.localeCompare(b.node.code, 'en', { numeric: true }));
  });

  private toBar(op: RoutingOperation, start: IsoDate): GanttBar {
    const state: BarState = op.completed
      ? 'done'
      : op.latestFinish < this.today
        ? 'late'
        : op.location === 'external'
          ? 'external'
          : op.earliestStart <= this.today
            ? 'active'
            : 'planned';
    const ws = this.workstations.find(op.workstationId);
    return {
      op,
      offset: diffDays(start, op.earliestStart),
      span: diffDays(op.earliestStart, op.latestFinish) + 1,
      state,
      progress: op.completed ? 100 : op.progressPercent,
      label: `${op.sequence} — ${op.name} · ${op.location === 'external' ? op.subcontractor : op.location === 'company' ? 'داخل الشركة' : (ws?.name ?? '')} · ${op.progressPercent}%`,
    };
  }

  protected setProject(id: string): void {
    this.projectFilter.set(id);
    this.componentFilter.set('');
  }

  protected zoom(delta: number): void {
    this.dayWidth.update((w) => Math.min(64, Math.max(14, w + delta)));
  }

  protected open(nodeId: string): void {
    void this.router.navigate(['/production/routing', nodeId]);
  }
}
