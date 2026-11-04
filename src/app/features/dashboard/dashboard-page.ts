import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardQuery } from '@application/queries/dashboard.query';
import { SessionStore } from '@application/state/session.store';
import { CanDirective } from '@core/auth/can.directive';
import { PROJECT_STATUS_LABELS } from '@domain/models';
import { ArDatePipe, MoneyPipe } from '@shared/pipes/format.pipes';
import { Icon } from '@shared/ui/icon/icon';
import { Logo } from '@shared/ui/logo/logo';
import { ProductVisual } from '@shared/ui/product-visual/product-visual';
import { ProgressBar, ProgressRing } from '@shared/ui/progress/progress';
import { StatCard } from '@shared/ui/stat-card/stat-card';

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, CanDirective, StatCard, Icon, Logo, ProgressRing, ProgressBar, ProductVisual, MoneyPipe, ArDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  protected readonly dashboard = inject(DashboardQuery);
  protected readonly session = inject(SessionStore);
  protected readonly statusLabels = PROJECT_STATUS_LABELS;
}
