import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { BomStore } from '@application/state/bom.store';
import { EntityId } from '@domain/models';
import { Icon } from '@shared/ui/icon/icon';
import { BomDiagramNode } from './bom-diagram-node';

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.4;
const DEFAULT_DEPTH = 1;

/**
 * Product tree drawn as a node diagram (top-down org chart) with
 * expand/collapse per node, depth presets, zoom and drag-to-pan.
 */
@Component({
  selector: 'app-bom-diagram',
  imports: [Icon, BomDiagramNode],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bom-diagram.html',
  styleUrl: './bom-diagram.scss',
})
export class BomDiagram {
  private readonly bom = inject(BomStore);
  private readonly injector = inject(Injector);

  readonly rootId = input.required<EntityId>();
  readonly level = input(0);
  readonly opened = output<EntityId>();
  readonly tasksRequested = output<EntityId>();

  private readonly viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');

  protected readonly zoom = signal(1);
  protected readonly zoomPercent = computed(() => Math.round(this.zoom() * 100));
  protected readonly root = computed(() => this.bom.find(this.rootId()));
  protected readonly maxDepth = computed(() => this.bom.tree().depth(this.rootId()) - this.level());
  protected readonly depthPresets = computed(() => Array.from({ length: Math.max(0, this.maxDepth()) }, (_, i) => i + 1));
  protected readonly dragging = signal(false);

  /** Starts over only for another root; editing the tree keeps what the user opened. */
  protected readonly expanded = linkedSignal<EntityId, ReadonlySet<EntityId>>({
    source: () => this.rootId(),
    computation: (rootId) => untracked(() => this.idsToDepth(rootId, DEFAULT_DEPTH)),
  });

  private drag: { x: number; y: number; left: number; top: number } | null = null;

  constructor() {
    effect(() => {
      this.rootId();
      untracked(() => afterNextRender(() => this.centerRoot(), { injector: this.injector }));
    });
  }

  protected toggle(id: EntityId): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (next.has(id)) {
        next.delete(id);
        this.bom.tree().descendants(id).forEach((n) => next.delete(n.id));
      } else {
        next.add(id);
      }
      return next;
    });
  }

  protected showDepth(depth: number): void {
    this.expanded.set(this.idsToDepth(this.rootId(), depth));
    afterNextRender(() => this.centerRoot(), { injector: this.injector });
  }

  protected expandAll(): void {
    this.showDepth(Number.MAX_SAFE_INTEGER);
  }

  protected setZoom(value: number): void {
    this.zoom.set(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 10) / 10)));
  }

  protected onWheel(event: WheelEvent): void {
    if (!event.ctrlKey) return;
    event.preventDefault();
    this.setZoom(this.zoom() + (event.deltaY < 0 ? 0.1 : -0.1));
  }

  protected startDrag(event: PointerEvent): void {
    if ((event.target as HTMLElement).closest('.card, button, a, .menu')) return;
    const el = this.viewport().nativeElement;
    this.drag = { x: event.clientX, y: event.clientY, left: el.scrollLeft, top: el.scrollTop };
    this.dragging.set(true);
    el.setPointerCapture(event.pointerId);
  }

  protected moveDrag(event: PointerEvent): void {
    if (!this.drag) return;
    const el = this.viewport().nativeElement;
    el.scrollLeft = this.drag.left - (event.clientX - this.drag.x);
    el.scrollTop = this.drag.top - (event.clientY - this.drag.y);
  }

  protected endDrag(): void {
    this.drag = null;
    this.dragging.set(false);
  }

  /** Ids expanded so that `depth` levels below the root are visible. */
  private idsToDepth(rootId: EntityId, depth: number): Set<EntityId> {
    const tree = this.bom.tree();
    const ids = new Set<EntityId>();
    const visit = (id: EntityId, remaining: number) => {
      if (remaining <= 0) return;
      ids.add(id);
      tree.children(id).forEach((child) => visit(child.id, remaining - 1));
    };
    visit(rootId, depth);
    return ids;
  }

  private centerRoot(): void {
    const el = this.viewport().nativeElement;
    const card = el.querySelector<HTMLElement>(`[data-node="${this.rootId()}"]`);
    if (!card) return;
    const viewportBox = el.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();
    el.scrollLeft += cardBox.left + cardBox.width / 2 - (viewportBox.left + viewportBox.width / 2);
    el.scrollTop = 0;
  }
}
