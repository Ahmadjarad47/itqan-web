import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { InventoryStore } from '@application/state/inventory.store';
import { ToastService } from '@core/feedback/toast.service';
import {
  EntityId,
  Material,
  MATERIAL_KIND_LABELS,
  MaterialKind,
  MOVEMENT_LABELS,
  StockMovementType,
  Unit,
  UNIT_LABELS,
} from '@domain/models';
import { ArDatePipe, MoneyPipe, NumPipe } from '@shared/pipes/format.pipes';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatCard } from '@shared/ui/stat-card/stat-card';

@Component({
  selector: 'app-inventory-page',
  imports: [ReactiveFormsModule, PageHeader, StatCard, Icon, Modal, EmptyState, MoneyPipe, NumPipe, ArDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inventory-page.html',
  styleUrl: './inventory-page.scss',
})
export class InventoryPage {
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly inventory = inject(InventoryStore);

  protected readonly kindLabels = MATERIAL_KIND_LABELS;
  protected readonly kinds = Object.keys(MATERIAL_KIND_LABELS) as MaterialKind[];
  protected readonly unitLabels = UNIT_LABELS;
  protected readonly units = Object.keys(UNIT_LABELS) as Unit[];
  protected readonly movementLabels = MOVEMENT_LABELS;

  protected readonly tab = signal<'stock' | 'movements'>('stock');
  protected readonly kindFilter = signal<MaterialKind | ''>('');
  protected readonly search = signal('');
  protected readonly creating = signal(false);
  protected readonly movingId = signal<EntityId | null>(null);
  protected readonly moveOpen = signal(false);
  protected readonly moveType = signal<StockMovementType>('receipt');
  protected readonly moveQty = signal(1);
  protected readonly moveRef = signal('');

  protected readonly rows = computed(() => {
    const term = this.search().trim();
    return this.inventory
      .all()
      .filter((m) => !this.kindFilter() || m.kind === this.kindFilter())
      .filter((m) => !term || m.name.includes(term) || m.code.toLowerCase().includes(term.toLowerCase()))
      .map((material) => ({
        material,
        value: material.stock * material.unitCost,
        low: material.kind !== 'purchased' && material.stock < material.minStock,
        ratio: material.minStock ? Math.min(1, material.stock / (material.minStock * 2)) : 1,
      }));
  });

  protected readonly movements = computed(() =>
    this.inventory.movements().map((movement) => ({ movement, material: this.inventory.find(movement.materialId) })),
  );

  protected readonly totals = computed(() => {
    const all = this.inventory.all();
    return {
      items: all.length,
      value: all.reduce((sum, m) => sum + m.stock * m.unitCost, 0),
      low: this.inventory.lowStock().length,
      warehouses: new Set(all.map((m) => m.warehouse)).size,
    };
  });

  protected readonly moving = computed(() => this.inventory.find(this.movingId()));

  protected readonly form = this.fb.group({
    code: ['', Validators.required],
    name: ['', Validators.required],
    kind: ['raw' as MaterialKind],
    unit: ['kg' as Unit],
    unitCost: [0, [Validators.required, Validators.min(0)]],
    stock: [0, Validators.min(0)],
    minStock: [0, Validators.min(0)],
    warehouse: ['مستودع المعادن', Validators.required],
  });

  protected openCreate(): void {
    this.form.reset();
    this.creating.set(true);
  }

  protected create(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const material = this.inventory.create(this.form.getRawValue());
    this.creating.set(false);
    this.toast.success('تمت إضافة المادة', material.name);
  }

  protected openMove(material: Material, type: StockMovementType): void {
    this.movingId.set(material.id);
    this.moveType.set(type);
    this.moveQty.set(1);
    this.moveRef.set('');
    this.moveOpen.set(true);
  }

  protected confirmMove(): void {
    const material = this.moving();
    if (!material || this.moveQty() <= 0) return;
    this.inventory.move(material.id, this.moveType(), this.moveQty(), this.moveRef() || 'حركة يدوية');
    this.moveOpen.set(false);
    this.toast.success(`تم تسجيل ${MOVEMENT_LABELS[this.moveType()]}`, material.name);
  }
}
