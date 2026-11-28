import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BomStore } from '@application/state/bom.store';
import { PurchaseStore } from '@application/state/purchase.store';
import { TaskStore } from '@application/state/task.store';
import { BomNode, EntityId } from '@domain/models';
import { isTaskOpen } from '@domain/rules';
import { Icon } from '@shared/ui/icon/icon';

interface RouteAction {
  readonly label: string;
  readonly icon: string;
  readonly link: readonly (string | EntityId)[] | null;
  readonly hint: string;
}

/**
 * The three shortcuts offered when pointing at / clicking a product-tree card:
 * the detail page, the manufacturing or purchase route, and the tasks assigned inside the item.
 */
@Component({
  selector: 'app-node-actions',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': "'node-actions node-actions--' + variant()", '(click)': '$event.stopPropagation()' },
  template: `
    <a class="action" [routerLink]="['/projects', node().projectId, 'items', node().id]">
      <app-icon name="eye" [size]="15" /> <span>صفحة التفاصيل</span>
    </a>
    @let r = route();
    @if (r.link) {
      <a class="action" [routerLink]="r.link" [title]="r.hint"><app-icon [name]="r.icon" [size]="15" /> <span>{{ r.label }}</span></a>
    } @else {
      <span class="action action--disabled" [title]="r.hint"><app-icon [name]="r.icon" [size]="15" /> <span>{{ r.label }}</span></span>
    }
    <button type="button" class="action" (click)="tasks.emit(node().id)">
      <app-icon name="clipboard" [size]="15" /> <span>المهام الموكلة</span>
      @if (taskCount(); as n) {
        <b class="count num">{{ n }}</b>
      }
    </button>
  `,
  styles: `
    :host {
      display: flex;
      gap: 4px;
    }
    :host(.node-actions--menu) {
      flex-direction: column;
      min-width: 190px;
      padding: 6px;
      border-radius: 12px;
      background: var(--surface);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-lg);
    }
    :host(.node-actions--strip) {
      flex-wrap: wrap;
      .action {
        flex: 1;
        justify-content: center;
        padding: 6px 4px;
        font-size: 11.5px;
        border: 1px solid var(--border);
      }
    }
    .action {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--text);
      font: inherit;
      font-size: 12.5px;
      font-weight: 600;
      text-align: start;
      white-space: nowrap;
      cursor: pointer;
      &:hover {
        background: var(--primary-soft);
        color: var(--primary);
      }
      &--disabled {
        color: var(--text-subtle);
        cursor: not-allowed;
        &:hover {
          background: transparent;
          color: var(--text-subtle);
        }
      }
    }
    .count {
      margin-inline-start: auto;
      min-width: 20px;
      padding: 0 6px;
      border-radius: 99px;
      font-size: 11px;
      text-align: center;
      color: var(--primary-contrast);
      background: var(--primary);
    }
  `,
})
export class NodeActions {
  private readonly bom = inject(BomStore);
  private readonly purchases = inject(PurchaseStore);
  private readonly taskStore = inject(TaskStore);

  readonly node = input.required<BomNode>();
  readonly variant = input<'menu' | 'strip'>('menu');
  readonly tasks = output<EntityId>();

  protected readonly route = computed<RouteAction>(() => {
    const node = this.node();
    if (node.decision === 'make') {
      return { label: 'مسار التصنيع', icon: 'route', link: ['/production/routing', node.id], hint: 'جدول عمليات التصنيع' };
    }
    if (node.decision === 'buy') {
      const request = this.purchases.byNode().get(node.id);
      return request
        ? { label: 'مسار الشراء', icon: 'cart', link: ['/procurement/requests', request.id], hint: request.number }
        : { label: 'مسار الشراء', icon: 'cart', link: null, hint: 'لم يُفتح طلب شراء لهذا المكون بعد' };
    }
    return { label: 'التصنيع / الشراء', icon: 'route', link: null, hint: 'لم يُحدد قرار التصنيع أو الشراء بعد' };
  });

  /** Open tasks assigned on the item or on any component below it. */
  protected readonly taskCount = computed(() => {
    const ids = new Set([this.node().id, ...this.bom.tree().descendants(this.node().id).map((n) => n.id)]);
    return this.taskStore.active().filter((t) => t.nodeId && ids.has(t.nodeId) && isTaskOpen(t)).length;
  });
}
