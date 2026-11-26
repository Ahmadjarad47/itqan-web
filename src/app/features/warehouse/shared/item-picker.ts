import { ChangeDetectionStrategy, Component, computed, inject, input, model, signal } from '@angular/core';
import { InventoryStore } from '@application/state/inventory.store';
import { EntityId, UNIT_LABELS } from '@domain/models';
import { normalizeText } from '@domain/rules';
import { NumPipe } from '@shared/pipes/format.pipes';
import { Icon } from '@shared/ui/icon/icon';

/** Picks a product card by typing its code (رمز بطاقة العنصر) or name. */
@Component({
  selector: 'app-item-picker',
  imports: [Icon, NumPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(focusout)': 'onBlur($event)' },
  template: `
    <div class="box" [class.box--sm]="small()">
      <app-icon name="search" [size]="15" />
      <input
        class="input"
        [class.input--sm]="small()"
        [placeholder]="placeholder()"
        [value]="open() ? term() : label()"
        (focus)="onFocus()"
        (input)="term.set($any($event.target).value); open.set(true)"
        (keydown.enter)="$event.preventDefault(); pickFirst()"
        (keydown.escape)="open.set(false)"
      />
      @if (value() && !open()) {
        <button type="button" class="clear" aria-label="مسح" (click)="value.set(null)"><app-icon name="x" [size]="13" /></button>
      }
    </div>
    @if (open()) {
      <div class="menu" role="listbox">
        @for (m of matches(); track m.id) {
          <button type="button" class="opt" role="option" (mousedown)="$event.preventDefault()" (click)="pick(m.id)">
            <span class="code">{{ m.code }}</span>
            <span class="name">{{ m.name }}</span>
            <span class="subtle num">{{ m.stock | num }} {{ units[m.unit] }}</span>
          </button>
        } @empty {
          <div class="empty">لا توجد بطاقة مطابقة</div>
        }
      </div>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      min-width: 220px;
    }
    .box {
      position: relative;
      display: flex;
      align-items: center;
    }
    .box app-icon {
      position: absolute;
      inset-inline-start: 11px;
      color: var(--text-subtle);
      pointer-events: none;
    }
    .input {
      padding-inline-start: 34px;
      padding-inline-end: 30px;
    }
    .clear {
      position: absolute;
      inset-inline-end: 8px;
      border: 0;
      background: none;
      color: var(--text-subtle);
      cursor: pointer;
      display: grid;
    }
    .menu {
      position: absolute;
      z-index: 30;
      inset-inline: 0;
      top: calc(100% + 4px);
      max-height: 280px;
      overflow-y: auto;
      background: var(--surface);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius);
      box-shadow: var(--shadow-lg);
      padding: 4px;
    }
    .opt {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 8px 10px;
      border: 0;
      border-radius: 8px;
      background: none;
      color: var(--text);
      font: inherit;
      font-size: 13px;
      text-align: start;
      cursor: pointer;
    }
    .opt:hover {
      background: var(--primary-soft);
    }
    .name {
      flex: 1;
    }
    .empty {
      padding: 10px;
      color: var(--text-subtle);
      font-size: 13px;
    }
  `,
})
export class ItemPicker {
  private readonly inventory = inject(InventoryStore);

  readonly value = model<EntityId | null>(null);
  readonly placeholder = input('رمز بطاقة العنصر أو اسمه');
  readonly small = input(false);

  protected readonly units = UNIT_LABELS;
  protected readonly term = signal('');
  protected readonly open = signal(false);

  protected readonly label = computed(() => {
    const m = this.inventory.find(this.value());
    return m ? `${m.code} — ${m.name}` : '';
  });

  protected readonly matches = computed(() => {
    const term = normalizeText(this.term());
    const all = this.inventory.sorted();
    if (!term) return all.slice(0, 40);
    return all.filter((m) => m.code.toLowerCase().includes(term) || normalizeText(m.name).includes(term)).slice(0, 40);
  });

  protected onFocus(): void {
    this.term.set('');
    this.open.set(true);
  }

  protected onBlur(event: FocusEvent): void {
    const host = event.currentTarget as HTMLElement;
    if (!host.contains(event.relatedTarget as Node | null)) this.open.set(false);
  }

  protected pick(id: EntityId): void {
    this.value.set(id);
    this.open.set(false);
  }

  protected pickFirst(): void {
    const exact = this.inventory.findByCode(this.term());
    const first = exact ?? this.matches()[0];
    if (first) this.pick(first.id);
  }
}
