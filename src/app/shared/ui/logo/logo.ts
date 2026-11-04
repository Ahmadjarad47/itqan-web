import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** System emblem. `light` recolours it for dark surfaces such as the sidebar. */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"logo logo--" + variant()', '[style.height.px]': 'size()' },
  templateUrl: './logo.html',
  styles: `
    :host {
      display: inline-flex;
      aspect-ratio: 367 / 467;
    }
    svg {
      width: 100%;
      height: 100%;
    }
    :host(.logo--color) {
      --logo-primary: #054239;
      --logo-secondary: #1e1e1e;
      --logo-accent: #b9a779;
    }
    :host(.logo--light) {
      --logo-primary: #edebe0;
      --logo-secondary: #b9a779;
      --logo-accent: #b9a779;
    }
    :host-context([data-theme='dark']):host(.logo--color) {
      --logo-primary: #5a9b8f;
      --logo-secondary: #d8ccab;
    }
  `,
})
export class Logo {
  readonly variant = input<'color' | 'light'>('color');
  readonly size = input(40);
}
