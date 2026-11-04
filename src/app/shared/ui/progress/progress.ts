import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

function toneFor(value: number): string {
  if (value >= 100) return 'var(--success)';
  if (value >= 60) return 'var(--primary)';
  if (value >= 25) return 'var(--accent-strong)';
  return 'var(--warning)';
}

@Component({
  selector: 'app-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'progressbar', '[attr.aria-valuenow]': 'rounded()', 'aria-valuemin': '0', 'aria-valuemax': '100' },
  template: `
    <div class="track" [style.height.px]="height()">
      <div class="fill" [style.width.%]="clamped()" [style.background]="color() ?? tone()"></div>
    </div>
    @if (showLabel()) {
      <span class="label num">{{ rounded() }}%</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 80px;
    }
    .track {
      flex: 1;
      border-radius: 99px;
      background: var(--surface-sunken);
      overflow: hidden;
    }
    .fill {
      height: 100%;
      border-radius: 99px;
      transition: width 0.6s var(--ease);
    }
    .label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      min-width: 36px;
      text-align: end;
    }
  `,
})
export class ProgressBar {
  readonly value = input.required<number>();
  readonly height = input(6);
  readonly showLabel = input(true);
  readonly color = input<string>();

  protected readonly clamped = computed(() => Math.min(100, Math.max(0, this.value())));
  protected readonly rounded = computed(() => Math.round(this.clamped()));
  protected readonly tone = computed(() => toneFor(this.clamped()));
}

@Component({
  selector: 'app-progress-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--surface-sunken)" [attr.stroke-width]="stroke()" />
      <circle
        cx="18"
        cy="18"
        r="15.5"
        fill="none"
        stroke-linecap="round"
        [attr.stroke]="tone()"
        [attr.stroke-width]="stroke()"
        [attr.stroke-dasharray]="dash()"
        transform="rotate(-90 18 18)"
      />
    </svg>
    <span class="value num" [style.font-size.px]="size() / 4.2">{{ rounded() }}%</span>
  `,
  styles: `
    :host {
      position: relative;
      display: inline-grid;
      place-items: center;
    }
    svg circle {
      transition: stroke-dasharray 0.8s var(--ease);
    }
    .value {
      position: absolute;
      font-weight: 700;
    }
  `,
})
export class ProgressRing {
  readonly value = input.required<number>();
  readonly size = input(56);
  readonly stroke = input(3.4);

  protected readonly rounded = computed(() => Math.round(Math.min(100, Math.max(0, this.value()))));
  protected readonly tone = computed(() => toneFor(this.value()));
  protected readonly dash = computed(() => {
    const circumference = 2 * Math.PI * 15.5;
    return `${(this.rounded() / 100) * circumference} ${circumference}`;
  });
}
