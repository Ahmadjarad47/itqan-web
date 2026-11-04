import { computed, inject, Injectable } from '@angular/core';
import { PURCHASE_STAGES, currentStageIndex, diffDays, etaDelayDays, isPurchaseCompleted, todayIso } from '@domain/rules';
import { BomStore } from '../state/bom.store';
import { ProjectStore } from '../state/project.store';
import { PurchaseStore } from '../state/purchase.store';
import { RoutingStore } from '../state/routing.store';
import { TaskStore } from '../state/task.store';
import { ProjectInsightsQuery } from './project-insights.query';

@Injectable({ providedIn: 'root' })
export class DashboardQuery {
  private readonly projects = inject(ProjectStore);
  private readonly bom = inject(BomStore);
  private readonly purchases = inject(PurchaseStore);
  private readonly routing = inject(RoutingStore);
  private readonly tasks = inject(TaskStore);
  private readonly insights = inject(ProjectInsightsQuery);

  readonly kpis = computed(() => {
    const today = todayIso();
    const openPurchases = this.purchases.all().filter((r) => !isPurchaseCompleted(r));
    const ops = this.routing.all();
    return {
      activeProjects: this.projects.all().filter((p) => p.status === 'active').length,
      totalProjects: this.projects.all().length,
      components: this.bom.all().length,
      openPurchases: openPurchases.length,
      delayedPurchases: openPurchases.filter((r) => etaDelayDays(r, today) > 0).length,
      runningOps: ops.filter((op) => !op.completed && op.earliestStart <= today).length,
      lateOps: ops.filter((op) => !op.completed && op.latestFinish < today).length,
      activeTasks: this.tasks.active().filter((t) => t.status === 'active').length,
      pendingTasks: this.tasks.active().filter((t) => t.status === 'sent').length,
    };
  });

  readonly projectCards = computed(() =>
    this.projects.sorted().map((project) => ({
      project,
      root: this.bom.find(project.rootNodeId),
      progress: this.insights.projectProgress(project.id),
      unitCost: this.insights.costByProject().get(project.id)?.unitCost ?? 0,
      daysLeft: diffDays(todayIso(), project.dueDate),
      components: this.bom.all().filter((n) => n.projectId === project.id).length,
    })),
  );

  readonly purchaseFunnel = computed(() => {
    const counts = new Array(PURCHASE_STAGES.length + 1).fill(0) as number[];
    for (const request of this.purchases.all()) counts[currentStageIndex(request)]++;
    const max = Math.max(1, ...counts);
    return [
      ...PURCHASE_STAGES.map((stage, i) => ({ label: stage.label, icon: stage.icon, count: counts[i], ratio: counts[i] / max })),
      { label: 'مكتمل ومستلم', icon: 'check-circle', count: counts.at(-1)!, ratio: counts.at(-1)! / max },
    ];
  });

  readonly sourcingSplit = computed(() => {
    const nodes = this.bom.all().filter((n) => n.parentId !== null);
    const make = nodes.filter((n) => n.decision === 'make').length;
    const buy = nodes.filter((n) => n.decision === 'buy').length;
    return { make, buy, undecided: nodes.length - make - buy, total: Math.max(1, nodes.length) };
  });

  readonly upcomingOperations = computed(() => {
    const today = todayIso();
    return this.routing
      .all()
      .filter((op) => !op.completed && diffDays(today, op.earliestStart) <= 7)
      .sort((a, b) => a.latestFinish.localeCompare(b.latestFinish))
      .slice(0, 7)
      .map((op) => ({ op, node: this.bom.find(op.nodeId), late: op.latestFinish < today }));
  });
}
