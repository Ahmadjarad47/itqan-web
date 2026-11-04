import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PurchaseRequest } from '@domain/models';
import { currentStageIndex, PURCHASE_STAGES } from '@domain/rules';

/** Compact 10-step indicator of the buy-flow status machine. */
@Component({
  selector: 'app-stage-dots',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (stage of stages; track stage.key; let i = $index) {
      <span
        class="dot"
        [class.done]="request().stages[i]?.done"
        [class.current]="i === current()"
        [class.failed]="failed() && i === current()"
        [title]="stage.label"
      ></span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      gap: 3px;
    }
    .dot {
      width: 12px;
      height: 6px;
      border-radius: 3px;
      background: var(--surface-sunken);
      border: 1px solid var(--border);
    }
    .done {
      background: var(--primary);
      border-color: var(--primary);
    }
    .current {
      background: var(--accent);
      border-color: var(--accent-strong);
      animation: pulse 1.6s ease-in-out infinite;
    }
    .failed {
      background: var(--danger);
      border-color: var(--danger);
    }
    @keyframes pulse {
      50% {
        opacity: 0.45;
      }
    }
  `,
})
export class StageDots {
  readonly request = input.required<PurchaseRequest>();
  protected readonly stages = PURCHASE_STAGES;
  protected readonly current = computed(() => currentStageIndex(this.request()));
  protected readonly failed = computed(() => this.request().qualityResult === 'failed');
}
