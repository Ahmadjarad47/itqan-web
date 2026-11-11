import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, model, signal } from '@angular/core';
import { BomStore } from '@application/state/bom.store';
import { ProjectStore } from '@application/state/project.store';
import { RoutingStore } from '@application/state/routing.store';
import { ProjectSetupUseCase } from '@application/use-cases/project-setup.use-case';
import { ToastService } from '@core/feedback/toast.service';
import { EntityId } from '@domain/models';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';

/** Copies a component (with all its sub-levels) from any project under the current node. */
@Component({
  selector: 'app-clone-tree-dialog',
  imports: [Modal, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [(open)]="open" title="استنساخ من مشروع" [subtitle]="'تُنسخ الشجرة المختارة كفرع تحت: ' + (target()?.name ?? '')" width="620px">
      <div class="form-grid">
        <label class="field span-full">
          <span class="field__label">المشروع المصدر</span>
          <select class="select" (change)="sourceProjectId.set($any($event.target).value)">
            @for (p of projects.sorted(); track p.id) {
              <option [value]="p.id" [selected]="p.id === sourceProjectId()">{{ p.code }} — {{ p.name }}{{ p.id === target()?.projectId ? ' (المشروع الحالي)' : '' }}</option>
            }
          </select>
        </label>
        <label class="field span-full">
          <span class="field__label">العقدة المراد نسخها (مع كل ما تحتها)</span>
          <select class="select" (change)="sourceNodeId.set($any($event.target).value)">
            @for (n of sourceNodes(); track n.node.id) {
              <option [value]="n.node.id" [selected]="n.node.id === sourceNodeId()">{{ n.indent }}{{ n.node.code }} — {{ n.node.name }}</option>
            }
          </select>
          <span class="field__hint">اختر المستوى 0 لنسخ الشجرة كاملة، أو أي مكون لنسخ فرعه فقط.</span>
        </label>
        <label class="check span-full">
          <input type="checkbox" [checked]="includeRouting()" (change)="includeRouting.set($any($event.target).checked)" />
          نسخ مسارات التصنيع أيضاً (العمليات، المحطات، الأزمنة والمواد المستهلكة) — تبدأ جدولتها من اليوم ويُصفّر الإنجاز
        </label>
      </div>

      <div class="preview">
        <div><span>المكونات</span><strong class="num">{{ preview().nodes }}</strong></div>
        <div><span>المستويات</span><strong class="num">{{ preview().levels }}</strong></div>
        <div><span>العمليات</span><strong class="num">{{ includeRouting() ? preview().operations : 0 }}</strong></div>
        <div><span>الرمز الجديد</span><strong class="ltr">{{ newCode() }}</strong></div>
      </div>
      <p class="subtle note">لا تُنسخ المهام وطلبات الشراء — النسخة خطة جديدة مستقلة عن المصدر.</p>

      <ng-container modal-actions>
        <button type="button" class="btn" (click)="open.set(false)">إلغاء</button>
        <button type="button" class="btn btn--primary" [disabled]="!sourceNodeId()" (click)="submit()">
          <app-icon name="copy" [size]="16" /> استنساخ
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .check {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 13px;
      input {
        margin-top: 3px;
      }
    }
    .preview {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-top: 16px;
      div {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 10px 12px;
        border-radius: var(--radius);
        background: var(--surface-sunken);
      }
      span {
        font-size: 12px;
        color: var(--text-muted);
      }
    }
    .note {
      margin: 10px 0 0;
      font-size: 12.5px;
    }
    @media (max-width: 560px) {
      .preview {
        grid-template-columns: 1fr 1fr;
      }
    }
  `,
})
export class CloneTreeDialog {
  protected readonly projects = inject(ProjectStore);
  private readonly bom = inject(BomStore);
  private readonly routing = inject(RoutingStore);
  private readonly setup = inject(ProjectSetupUseCase);
  private readonly toast = inject(ToastService);

  readonly open = model(false);
  readonly targetId = input.required<EntityId>();

  protected readonly target = computed(() => this.bom.find(this.targetId()));
  protected readonly includeRouting = signal(true);

  /** Defaults to another project than the current one. */
  protected readonly sourceProjectId = linkedSignal(() => {
    const current = this.target()?.projectId;
    return this.projects.sorted().find((p) => p.id !== current)?.id ?? current ?? '';
  });

  protected readonly sourceNodes = computed(() => {
    const project = this.projects.find(this.sourceProjectId());
    const tree = this.bom.tree();
    if (!project || !tree.node(project.rootNodeId)) return [];
    const root = tree.node(project.rootNodeId)!;
    return [root, ...tree.descendants(root.id)].map((node) => ({ node, indent: '  '.repeat(tree.level(node.id) * 2) }));
  });

  protected readonly sourceNodeId = linkedSignal(() => this.sourceNodes()[0]?.node.id ?? '');

  protected readonly preview = computed(() => {
    const id = this.sourceNodeId();
    const tree = this.bom.tree();
    if (!id || !tree.node(id)) return { nodes: 0, levels: 0, operations: 0 };
    const ids = [id, ...tree.descendants(id).map((n) => n.id)];
    return {
      nodes: ids.length,
      levels: Math.max(tree.depth(id), tree.level(id)) - tree.level(id) + 1,
      operations: ids.reduce((sum, nodeId) => sum + this.routing.forNode(nodeId).length, 0),
    };
  });

  protected readonly newCode = computed(() => (this.target() ? this.bom.nextChildCode(this.target()!.id) : ''));

  constructor() {
    effect(() => {
      if (this.open()) this.includeRouting.set(true);
    });
  }

  protected submit(): void {
    const source = this.bom.find(this.sourceNodeId());
    const copy = this.setup.importSubtree(this.sourceNodeId(), this.targetId(), this.includeRouting());
    if (!copy || !source) return;
    this.open.set(false);
    this.toast.success('تم الاستنساخ', `${source.name} ← ${copy.code} (${this.preview().nodes} مكون)`);
  }
}
