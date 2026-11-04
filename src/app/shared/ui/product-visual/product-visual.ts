import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Discipline, DISCIPLINES } from '@domain/models';
import { Icon } from '../icon/icon';

/** Shows a component image, or a generated emblem based on its discipline. */
@Component({
  selector: 'app-product-visual',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.has-image]': '!!image()' },
  template: `
    @if (image(); as src) {
      <img [src]="src" [alt]="name()" loading="lazy" />
    } @else {
      <div class="emblem">
        <span class="emblem__ring"><app-icon [name]="icon()" [size]="iconSize()" [stroke]="1.6" /></span>
        @if (code()) {
          <span class="emblem__code ltr">{{ code() }}</span>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      overflow: hidden;
      background: var(--wheat-50);
    }
    :host-context([data-theme='dark']) {
      background: #13302b;
    }
    :host::before {
      content: '';
      position: absolute;
      inset: 0;
      background: url('/pattern.svg');
      background-size: 70px;
      opacity: 0.35;
    }
    :host(.has-image)::before {
      opacity: 0.25;
    }
    img {
      position: relative;
      width: 100%;
      height: 100%;
      object-fit: contain;
      padding: 8%;
    }
    .emblem {
      position: relative;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .emblem__ring {
      width: 44%;
      max-width: 88px;
      aspect-ratio: 1;
      border-radius: 28%;
      display: grid;
      place-items: center;
      color: var(--accent);
      background: var(--forest-800);
      box-shadow:
        inset 0 0 0 1px rgba(185, 167, 121, 0.4),
        0 10px 24px -10px rgba(0, 38, 35, 0.5);
    }
    .emblem__code {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      font-family: 'IBM Plex Mono', monospace;
    }
  `,
})
export class ProductVisual {
  readonly image = input<string | null>(null);
  readonly name = input('');
  readonly code = input<string>();
  readonly discipline = input<Discipline>('mechanical');
  readonly iconSize = input(30);

  protected readonly icon = computed(() => DISCIPLINES[this.discipline()].icon);
}
