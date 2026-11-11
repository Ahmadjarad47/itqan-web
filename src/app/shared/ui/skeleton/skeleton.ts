import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** One shimmering placeholder card: avatar, two title lines and two body lines. */
@Component({
  selector: 'app-skeleton-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'skeleton-card', 'aria-hidden': 'true' },
  template: `
    <div class="skeleton-card__head">
      <span class="skeleton skeleton--circle"></span>
      <div class="skeleton-card__titles">
        <span class="skeleton skeleton--line" style="width: 48%"></span>
        <span class="skeleton skeleton--line" style="width: 100%"></span>
      </div>
    </div>
    <span class="skeleton skeleton--line" style="width: 100%"></span>
    <span class="skeleton skeleton--line" style="width: 92%"></span>
  `,
})
export class SkeletonCard {}

/** Full-page placeholder shown while a screen's code is loading. */
@Component({
  selector: 'app-page-skeleton',
  imports: [SkeletonCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page-skeleton', role: 'status', 'aria-label': 'جارٍ التحميل…', 'aria-busy': 'true' },
  template: `
    <div class="page-skeleton__header">
      <span class="skeleton skeleton--line" style="width: 220px; height: 22px"></span>
      <span class="skeleton skeleton--line" style="width: 340px"></span>
    </div>
    <div class="page-skeleton__grid">
      @for (card of cards(); track $index) {
        <app-skeleton-card />
      }
    </div>
  `,
})
export class PageSkeleton {
  readonly count = input(6);
  protected cards() {
    return Array.from({ length: this.count() });
  }
}
