import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { NotificationsQuery } from '@application/queries/notifications.query';
import { EmployeeStore } from '@application/state/organization.store';
import { MANAGER_ID, SessionStore } from '@application/state/session.store';
import { clearLocalStorageData } from '@infrastructure/persistence/local-storage.repository';
import { ConfirmService } from '@core/feedback/confirm.service';
import { FeedbackHost } from '@core/feedback/feedback-host';
import { Avatar } from '@shared/ui/avatar/avatar';
import { Icon } from '@shared/ui/icon/icon';
import { Logo } from '@shared/ui/logo/logo';
import { NAVIGATION } from './navigation';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Logo, Avatar, FeedbackHost],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'closeMenus()' },
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly session = inject(SessionStore);
  protected readonly employees = inject(EmployeeStore);
  protected readonly notifications = inject(NotificationsQuery);
  private readonly confirm = inject(ConfirmService);

  protected readonly navigation = NAVIGATION;
  protected readonly managerId = MANAGER_ID;
  protected readonly sidebarOpen = signal(false);
  protected readonly menu = signal<'notifications' | 'user' | null>(null);
  protected readonly today = new Intl.DateTimeFormat('ar-SY-u-nu-latn', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  constructor() {
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.sidebarOpen.set(false);
        this.menu.set(null);
      });
  }

  protected toggleMenu(event: Event, menu: 'notifications' | 'user'): void {
    event.stopPropagation();
    this.menu.update((current) => (current === menu ? null : menu));
  }

  protected closeMenus(): void {
    this.menu.set(null);
  }

  protected switchUser(id: string): void {
    this.session.switchUser(id);
    this.menu.set(null);
  }

  protected async resetData(): Promise<void> {
    const accepted = await this.confirm.ask({
      title: 'إعادة تعيين البيانات التجريبية',
      message: 'سيتم حذف جميع التعديلات المحلية واستعادة البيانات الافتراضية.',
      confirmLabel: 'إعادة التعيين',
      danger: true,
    });
    if (!accepted) return;
    clearLocalStorageData();
    location.reload();
  }
}
