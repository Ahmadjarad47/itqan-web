import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-page-header',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      @if (icon()) {
        <span class="head__icon"><app-icon [name]="icon()!" [size]="22" /></span>
      }
      <div class="head__text">
        @if (eyebrow()) {
          <span class="head__eyebrow">{{ eyebrow() }}</span>
        }
        <h1>{{ title() }}</h1>
        @if (subtitle()) {
          <p>{{ subtitle() }}</p>
        }
      </div>
    </div>
    <div class="actions"><ng-content /></div>
  `,
  styles: `
    :host {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 24px;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .head__icon {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      color: var(--accent);
      background: var(--forest-800);
      box-shadow: inset 0 0 0 1px rgba(185, 167, 121, 0.35), var(--shadow);
    }
    .head__eyebrow {
      font-size: 12px;
      font-weight: 600;
      color: var(--accent-strong);
      letter-spacing: 0.02em;
    }
    h1 {
      font-size: 22px;
    }
    p {
      color: var(--text-muted);
      font-size: 13.5px;
      margin-top: 2px;
    }
    .actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly eyebrow = input<string>();
  readonly icon = input<string>();
}
