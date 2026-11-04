import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { Icon } from '../icon/icon';

/** Centered dialog (`modal`) or side sheet (`drawer`) with enter/leave animations. */
@Component({
  selector: 'app-modal',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'open.set(false)' },
  template: `
    @if (open()) {
      <div class="backdrop" animate.enter="enter-fade" animate.leave="leave-fade" (click)="open.set(false)"></div>
      <section
        class="panel"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
        [class.panel--drawer]="mode() === 'drawer'"
        [style.--panel-width]="width()"
        animate.enter="panel-enter"
        animate.leave="panel-leave"
      >
        <header>
          <div>
            <h2>{{ title() }}</h2>
            @if (subtitle()) {
              <p>{{ subtitle() }}</p>
            }
          </div>
          <button type="button" class="btn btn--ghost btn--icon btn--sm" aria-label="إغلاق" (click)="open.set(false)">
            <app-icon name="x" />
          </button>
        </header>
        <div class="body"><ng-content /></div>
        <footer><ng-content select="[modal-actions]" /></footer>
      </section>
    }
  `,
  styleUrl: './modal.scss',
})
export class Modal {
  readonly open = model(false);
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly mode = input<'modal' | 'drawer'>('modal');
  readonly width = input('560px');
}
