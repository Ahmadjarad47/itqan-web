import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthorizationService } from '@application/auth/authorization.service';
import { SessionStore } from '@application/state/session.store';
import { Icon } from '@shared/ui/icon/icon';

@Component({
  selector: 'app-forbidden-page',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="box enter-fade-up">
      <span class="box__icon"><app-icon name="shield" [size]="30" /></span>
      <h1>لا تملك صلاحية الوصول</h1>
      <p>
        الدور الحالي <strong>«{{ auth.role()?.name ?? 'بدون دور' }}»</strong> للمستخدم {{ session.displayName() }}
        لا يتضمن صلاحية فتح هذه الشاشة. تواصل مع مدير النظام لتعديل الصلاحيات، أو بدّل المستخدم من القائمة أعلى الشاشة.
      </p>
    </section>
  `,
  styles: `
    .box {
      max-width: 520px;
      margin: 8vh auto 0;
      padding: 36px 28px;
      text-align: center;
      border-radius: var(--radius-xl);
      background: var(--surface);
      border: 1px solid var(--border);
    }
    .box__icon {
      width: 68px;
      height: 68px;
      margin: 0 auto 16px;
      border-radius: 20px;
      display: grid;
      place-items: center;
      color: var(--danger);
      background: var(--danger-soft);
    }
    h1 {
      font-size: 20px;
    }
    p {
      margin-top: 10px;
      color: var(--text-muted);
    }
  `,
})
export class ForbiddenPage {
  protected readonly auth = inject(AuthorizationService);
  protected readonly session = inject(SessionStore);
}
