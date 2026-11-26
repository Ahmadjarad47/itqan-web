import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { WarehouseReportsQuery } from '@application/queries/warehouse-reports.query';
import { InventoryStore } from '@application/state/inventory.store';
import { EmployeeStore } from '@application/state/organization.store';
import { RequisitionStore, WarehouseStore } from '@application/state/warehouse.store';
import { WarehouseUseCase } from '@application/use-cases/warehouse.use-case';
import { CanDirective } from '@core/auth/can.directive';
import { EntityId, Warehouse } from '@domain/models';
import { addDays, movementDate, todayIso } from '@domain/rules';
import { MoneyPipe } from '@shared/pipes/format.pipes';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatCard } from '@shared/ui/stat-card/stat-card';
import { MovementLog } from '../shared/movement-log';
import { WarehouseFormDialog } from '../shared/warehouse-form-dialog';
import { WarehouseReports } from '../shared/warehouse-reports';

/** Screen 1 — dashboard of every warehouse, their movements, alerts and reports. */
@Component({
  selector: 'app-warehouse-dashboard-page',
  imports: [RouterLink, CanDirective, PageHeader, StatCard, Icon, EmptyState, MoneyPipe, MovementLog, WarehouseReports, WarehouseFormDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './warehouse-dashboard-page.html',
  styleUrls: ['../shared/warehouse-common.scss', './warehouse-dashboard-page.scss'],
})
export class WarehouseDashboardPage {
  private readonly router = inject(Router);
  private readonly inventory = inject(InventoryStore);
  private readonly reports = inject(WarehouseReportsQuery);
  private readonly requisitions = inject(RequisitionStore);
  private readonly flows = inject(WarehouseUseCase);
  protected readonly warehouses = inject(WarehouseStore);
  protected readonly employees = inject(EmployeeStore);

  protected readonly creating = signal(false);
  protected readonly parentForNew = signal<EntityId | null>(null);
  protected readonly alertFilter = signal<'all' | 'danger' | 'warning' | 'info'>('all');

  protected readonly summaries = this.reports.summaries;

  protected readonly cards = computed(() => {
    const summaries = this.summaries();
    const maxMoves = Math.max(1, ...[...summaries.values()].map((s) => s.inCount + s.outCount));
    return this.warehouses.tree().map((row) => {
      const summary = summaries.get(row.warehouse.id)!;
      return {
        ...row,
        summary,
        manager: this.employees.find(row.warehouse.managerId),
        children: this.warehouses.children(row.warehouse.id).length,
        inRatio: (summary.inCount / maxMoves) * 100,
        outRatio: (summary.outCount / maxMoves) * 100,
      };
    });
  });

  protected readonly totals = computed(() => {
    const since = addDays(todayIso(), -30);
    const recent = this.inventory.movements().filter((m) => m.type !== 'transfer' && movementDate(m) >= since);
    return {
      warehouses: this.warehouses.all().length,
      shelves: this.warehouses.all().reduce((s, w) => s + w.shelves.length, 0),
      value: this.inventory.all().reduce((s, m) => s + m.stock * m.unitCost, 0),
      items: this.inventory.all().filter((m) => m.stock > 0).length,
      inCount: recent.filter((m) => m.quantity > 0).length,
      outCount: recent.filter((m) => m.quantity < 0).length,
      openRequisitions: this.requisitions.open().length,
      awaitingReceipt: this.flows.awaitingReceipt().filter((r) => r.materialId).length,
    };
  });

  protected readonly alerts = computed(() => {
    const filter = this.alertFilter();
    return this.reports.alerts().filter((a) => filter === 'all' || a.tone === filter);
  });

  protected readonly alertCounts = computed(() => {
    const all = this.reports.alerts();
    return {
      all: all.length,
      danger: all.filter((a) => a.tone === 'danger').length,
      warning: all.filter((a) => a.tone === 'warning').length,
      info: all.filter((a) => a.tone === 'info').length,
    };
  });

  protected openCreate(parentId: EntityId | null = null): void {
    this.parentForNew.set(parentId);
    this.creating.set(true);
  }

  protected open(warehouse: Warehouse): void {
    void this.router.navigate(['/warehouse/sites', warehouse.id]);
  }
}
