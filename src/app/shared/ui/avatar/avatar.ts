import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const PALETTE = ['#054239', '#428177', '#988561', '#6b1f2a', '#3d3a3b', '#2c6a5f'];

@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.font-size.px]': 'size() / 2.6',
    '[style.background]': 'color()',
    '[attr.title]': 'name()',
  },
  template: `{{ initials() }}`,
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
      flex-shrink: 0;
      border-radius: 50%;
      color: #fff;
      font-weight: 700;
      box-shadow: 0 0 0 2px var(--surface);
    }
  `,
})
export class Avatar {
  readonly name = input.required<string>();
  readonly size = input(34);

  protected readonly initials = computed(() =>
    this.name()
      .replace(/^م\.\s*/, '')
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.replace(/^ال/, '').charAt(0))
      .join(' '),
  );

  protected readonly color = computed(() => {
    const hash = [...this.name()].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return PALETTE[hash % PALETTE.length];
  });
}
