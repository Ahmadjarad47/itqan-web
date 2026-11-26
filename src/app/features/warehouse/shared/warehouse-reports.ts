import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WarehouseReportsQuery } from '@application/queries/warehouse-reports.query';
import { WarehouseStore } from '@application/state/warehouse.store';
import { EntityId, UNIT_LABELS } from '@domain/models';
import { ArDatePipe, MoneyPipe, NumPipe } from '@shared/pipes/format.pipes';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { downloadCsv } from './csv';

type Report = 'stagnant' | 'moving' | 'critical' | 'expiry';

const REPORTS: { key: Report; label: string; icon: string; hint: string }[] = [
  { key: 'stagnant', label: 'العناصر الراكدة', icon: 'archive', hint: 'عناصر لها رصيد ولم تُصرف منذ الفترة المحددة' },
  { key: 'moving', label: 'الأكثر حركة', icon: 'trending', hint: 'أكثر العناصر حركة دخولاً وخروجاً خلال الفترة' },
  { key: 'critical', label: 'الحالات الحرجة (Min/Max)', icon: 'alert', hint: 'عناصر تحت الحد الأدنى أو فوق الحد الأقصى' },
  { key: 'expiry', label: 'اقتراب انتهاء الصلاحية', icon: 'clock', hint: 'دفعات منتهية أو تنتهي صلاحيتها خلال الفترة' },
];

const PERIODS = [7, 30, 60, 90, 180, 365];

/** The four SRS reports, per selected warehouse or across all warehouses. */
@Component({
  selector: 'app-warehouse-reports',
  imports: [RouterLink, Icon, EmptyState, NumPipe, MoneyPipe, ArDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './warehouse-reports.html',
  styleUrls: ['./warehouse-common.scss', './warehouse-reports.scss'],
})
export class WarehouseReports {
  private readonly reports = inject(WarehouseReportsQuery);
  protected readonly warehouses = inject(WarehouseStore);

  /** Fixed scope (warehouse page); when null the user can pick the scope. */
  readonly warehouseId = input<EntityId | null>(null);
  readonly lockScope = input(false);

  protected readonly definitions = REPORTS;
  protected readonly periods = PERIODS;
  protected readonly unitLabels = UNIT_LABELS;

  protected readonly report = signal<Report>('stagnant');
  protected readonly scope = linkedSignal(() => this.warehouseId() ?? '');
  protected readonly period = signal(60);

  protected readonly current = computed(() => REPORTS.find((r) => r.key === this.report())!);
  private readonly scopeId = computed(() => this.scope() || null);

  protected readonly stagnant = computed(() => (this.report() === 'stagnant' ? this.reports.stagnant(this.scopeId(), this.period()) : []));
  protected readonly moving = computed(() => (this.report() === 'moving' ? this.reports.moving(this.scopeId(), this.period(), 15) : []));
  protected readonly critical = computed(() => (this.report() === 'critical' ? this.reports.critical(this.scopeId()) : []));
  protected readonly expiry = computed(() => (this.report() === 'expiry' ? this.reports.expiring(this.scopeId(), this.period()) : []));

  protected readonly scopeLabel = computed(() => (this.scopeId() ? this.warehouses.path(this.scopeId()) : 'جميع المستودعات'));

  protected indent(depth: number): string {
    return depth ? '  '.repeat(depth) + '↳ ' : '';
  }

  protected print(): void {
    window.print();
  }

  protected exportCsv(): void {
    const name = `report-${this.report()}`;
    switch (this.report()) {
      case 'stagnant':
        return downloadCsv(name, ['الرمز', 'العنصر', 'الرصيد', 'القيمة', 'آخر صرف', 'أيام الركود'], this.stagnant().map((r) => [r.material.code, r.material.name, r.quantity, r.value.toFixed(2), r.lastOut ?? '—', r.idleDays]));
      case 'moving':
        return downloadCsv(name, ['الرمز', 'العنصر', 'عدد الحركات', 'كمية الدخول', 'كمية الخروج'], this.moving().map((r) => [r.material.code, r.material.name, r.count, r.inQty, r.outQty]));
      case 'critical':
        return downloadCsv(name, ['الرمز', 'العنصر', 'الرصيد', 'الحد الأدنى', 'الحد الأقصى', 'الحالة'], this.critical().map((r) => [r.material.code, r.material.name, r.material.stock, r.material.minStock, r.material.maxStock, r.level]));
      case 'expiry':
        return downloadCsv(name, ['الرمز', 'العنصر', 'الكمية', 'تاريخ الانتهاء', 'الأيام المتبقية', 'الدفعة'], this.expiry().map((r) => [r.material.code, r.material.name, r.quantity, r.expiryDate, r.days, r.reference]));
    }
  }
}
