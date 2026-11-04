import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SourcingDecision } from '@domain/models';

@Component({
  selector: 'app-decision-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (decision()) {
      @case ('make') {
        <span class="badge badge--primary badge--dot">تصنيع</span>
      }
      @case ('buy') {
        <span class="badge badge--accent badge--dot">شراء</span>
      }
      @default {
        <span class="badge badge--warning badge--dot">بانتظار القرار</span>
      }
    }
  `,
})
export class DecisionBadge {
  readonly decision = input<SourcingDecision | null>(null);
}
