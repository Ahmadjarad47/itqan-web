import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from '../icon/icon';

export type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

@Component({
  selector: 'app-stat-card',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"tone-" + tone()' },
  template: `
    <div class="top">
      <span class="label">{{ label() }}</span>
      <span class="icon"><app-icon [name]="icon()" [size]="18" /></span>
    </div>
    <div class="value num">{{ value() }}</div>
    @if (hint()) {
      <div class="hint">{{ hint() }}</div>
    }
  `,
  styles: `
    :host {
      --tone: var(--primary);
      --tone-soft: var(--primary-soft);
      position: relative;
      display: block;
      padding: 18px 20px;
      border-radius: var(--radius-lg);
      background: var(--surface);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-xs);
      overflow: hidden;
      transition:
        transform 0.25s var(--ease),
        box-shadow 0.25s;
    }
    :host:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow);
    }
    :host::after {
      content: '';
      position: absolute;
      inset-inline-start: 0;
      top: 18px;
      bottom: 18px;
      width: 3px;
      border-radius: 3px;
      background: var(--tone);
    }
    :host(.tone-accent) { --tone: var(--accent-strong); --tone-soft: var(--accent-soft); }
    :host(.tone-success) { --tone: var(--success); --tone-soft: var(--success-soft); }
    :host(.tone-warning) { --tone: var(--warning); --tone-soft: var(--warning-soft); }
    :host(.tone-danger) { --tone: var(--danger); --tone-soft: var(--danger-soft); }
    :host(.tone-info) { --tone: var(--info); --tone-soft: var(--info-soft); }
    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .label {
      font-size: 13px;
      color: var(--text-muted);
      font-weight: 500;
    }
    .icon {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      color: var(--tone);
      background: var(--tone-soft);
    }
    .value {
      font-size: 28px;
      font-weight: 700;
      margin-top: 6px;
      letter-spacing: -0.02em;
    }
    .hint {
      font-size: 12px;
      color: var(--text-subtle);
      margin-top: 2px;
    }
  `,
})
export class StatCard {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly icon = input('box');
  readonly hint = input<string>();
  readonly tone = input<Tone>('primary');
}
