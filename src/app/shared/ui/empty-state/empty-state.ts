import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-empty-state',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="icon"><app-icon [name]="icon()" [size]="26" /></span>
    <h3>{{ title() }}</h3>
    @if (text()) {
      <p>{{ text() }}</p>
    }
    <ng-content />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 8px;
      padding: 40px 20px;
    }
    .icon {
      width: 60px;
      height: 60px;
      border-radius: 18px;
      display: grid;
      place-items: center;
      color: var(--accent-strong);
      background: var(--accent-soft);
      margin-bottom: 6px;
    }
    h3 {
      font-size: 15px;
    }
    p {
      color: var(--text-muted);
      font-size: 13px;
      max-width: 380px;
    }
  `,
})
export class EmptyState {
  readonly icon = input('inbox');
  readonly title = input.required<string>();
  readonly text = input<string>();
}
