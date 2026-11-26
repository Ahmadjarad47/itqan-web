import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { InventoryStore } from '@application/state/inventory.store';
import { RequisitionStore } from '@application/state/warehouse.store';
import { WarehouseUseCase } from '@application/use-cases/warehouse.use-case';
import { addDays, movementDate, todayIso } from '@domain/rules';
import { MoneyPipe } from '@shared/pipes/format.pipes';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatCard } from '@shared/ui/stat-card/stat-card';
import { InboundPanel } from './inbound-panel';
import { OutboundPanel } from './outbound-panel';

/** Screen 4 — warehouse movement: incoming (الوارد) and outgoing (الصادر). */
@Component({
  selector: 'app-movements-page',
  imports: [PageHeader, StatCard, Icon, MoneyPipe, InboundPanel, OutboundPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="حركة المستودع" subtitle="تسجيل الوارد وحفظ الفواتير، وتسجيل الصادر لطلبات الاحتياج والمناقلة والشطب" eyebrow="إدارة المستودعات" icon="refresh">
      <div class="segmented big">
        <button type="button" [class.active]="tab() === 'in'" (click)="setTab('in')"><app-icon name="download" [size]="16" /> القسم الأول: تسجيل الوارد</button>
        <button type="button" [class.active]="tab() === 'out'" (click)="setTab('out')"><app-icon name="upload" [size]="16" /> القسم الثاني: تسجيل الصادر</button>
      </div>
    </app-page-header>

    @let k = kpis();
    <section class="kpis">
      <app-stat-card label="وارد آخر 30 يوم" [value]="(k.inValue | money: true)" icon="download" tone="success" [hint]="k.inCount + ' عملية إدخال'" />
      <app-stat-card label="صادر آخر 30 يوم (تكلفة)" [value]="(k.outValue | money: true)" icon="upload" tone="info" [hint]="k.outCount + ' عملية إخراج'" />
      <app-stat-card label="طلبات توريد بانتظار الاستلام" [value]="k.awaiting" icon="truck" [tone]="k.awaiting ? 'warning' : 'success'" />
      <app-stat-card label="طلبات احتياج مفتوحة" [value]="k.requisitions" icon="inbox" [tone]="k.overdue ? 'danger' : 'primary'" [hint]="k.overdue ? k.overdue + ' متأخر' : ''" />
    </section>

    @if (tab() === 'in') {
      <app-inbound-panel [presetItem]="item()" [presetSupply]="supply()" />
    } @else {
      <app-outbound-panel [presetItem]="item()" />
    }
  `,
  styles: `
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }
    .big button {
      height: 38px;
      padding: 0 18px;
    }
  `,
})
export class MovementsPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly inventory = inject(InventoryStore);
  private readonly requisitions = inject(RequisitionStore);
  private readonly flows = inject(WarehouseUseCase);

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  protected readonly tab = computed(() => (this.params().get('tab') === 'out' ? 'out' : 'in'));
  protected readonly item = computed(() => this.params().get('item'));
  protected readonly supply = computed(() => this.params().get('supply'));

  protected readonly kpis = computed(() => {
    const since = addDays(todayIso(), -30);
    const recent = this.inventory.movements().filter((m) => m.type !== 'transfer' && movementDate(m) >= since);
    const incoming = recent.filter((m) => m.quantity > 0);
    const outgoing = recent.filter((m) => m.quantity < 0);
    const today = todayIso();
    return {
      inCount: incoming.length,
      inValue: incoming.reduce((s, m) => s + m.quantity * (m.unitCost ?? 0), 0),
      outCount: outgoing.length,
      outValue: outgoing.reduce((s, m) => s - m.quantity * (m.unitCost ?? 0), 0),
      awaiting: this.flows.awaitingReceipt().length,
      requisitions: this.requisitions.open().length,
      overdue: this.requisitions.open().filter((r) => r.dueDate < today).length,
    };
  });

  protected setTab(tab: 'in' | 'out'): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { tab } });
  }
}
