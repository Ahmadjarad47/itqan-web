import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { NotificationsQuery } from '@application/queries/notifications.query';
import { EmployeeStore } from '@application/state/organization.store';
import { AuthorizationService } from '@application/auth/authorization.service';
import { RoleStore } from '@application/state/role.store';
import { SessionStore } from '@application/state/session.store';
import { firstAllowedLink } from '@core/auth/permission.guard';
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
  protected readonly auth = inject(AuthorizationService);
  protected readonly roles = inject(RoleStore);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  /** Only the screens the current role is allowed to open. */
  protected readonly navigation = computed(() =>
    NAVIGATION.map((group) => ({ ...group, items: group.items.filter((item) => this.auth.can(item.permission)) })).filter(
      (group) => group.items.length,
    ),
  );
  protected readonly sidebarOpen = signal(false);
  protected readonly menu = signal<'notifications' | 'user' | null>(null);
  protected readonly today = new Intl.DateTimeFormat('ar-SY-u-nu-latn', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  constructor() {
    this.router.events.pipe(
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
    void this.router.navigateByUrl(firstAllowedLink(this.auth));
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
