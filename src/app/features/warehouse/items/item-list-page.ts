import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CustomFieldStore } from '@application/state/custom-field.store';
import { InventoryStore } from '@application/state/inventory.store';
import { CatalogOptionStore, WarehouseStore } from '@application/state/warehouse.store';
import { CanDirective } from '@core/auth/can.directive';
import { ConfirmService } from '@core/feedback/confirm.service';
import { ToastService } from '@core/feedback/toast.service';
import {
  CATALOG_LIST_LABELS,
  CatalogList,
  CatalogOption,
  COST_METHOD_LABELS,
  CustomFieldDefinition,
  CustomFieldValue,
  formatCustomValue,
  Material,
  UNIT_LABELS,
} from '@domain/models';
import { sellingPrice, stockLevel, StockLevel } from '@domain/rules';
import { MoneyPipe, NumPipe } from '@shared/pipes/format.pipes';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatCard } from '@shared/ui/stat-card/stat-card';
import { downloadCsv } from '../shared/csv';
import { ItemWizard } from './item-wizard';

/** Screen 2 — product cards (بطاقات المنتجات). */
@Component({
  selector: 'app-item-list-page',
  imports: [CanDirective, PageHeader, StatCard, Icon, Modal, EmptyState, MoneyPipe, NumPipe, ItemWizard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './item-list-page.html',
  styleUrls: ['../shared/warehouse-common.scss', './item-list-page.scss'],
})
export class ItemListPage {
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fieldDefinitions = inject(CustomFieldStore);
  protected readonly inventory = inject(InventoryStore);
  protected readonly options = inject(CatalogOptionStore);
  protected readonly warehouses = inject(WarehouseStore);

  protected readonly unitLabels = UNIT_LABELS;
  protected readonly methodLabels = COST_METHOD_LABELS;
  protected readonly listLabels = CATALOG_LIST_LABELS;
  protected readonly columns = computed(() => this.fieldDefinitions.listColumns('material'));

  protected readonly search = signal('');
  protected readonly categoryFilter = signal('');
  protected readonly natureFilter = signal('');
  protected readonly warehouseFilter = signal('');
  protected readonly levelFilter = signal<StockLevel | ''>('');
  protected readonly sort = signal<'code' | 'name' | 'stock' | 'value'>('code');
  protected readonly creating = signal(false);
  protected readonly listsOpen = signal(false);
  protected readonly listTab = signal<CatalogList>('category');
  protected readonly optionName = signal('');
  protected readonly optionCode = signal('');

  protected readonly rows = computed(() => {
    const term = this.search().trim().toLowerCase();
    const scope = this.warehouseFilter() ? this.warehouses.subtreeIds(this.warehouseFilter()) : null;
    const rows = this.inventory
      .all()
      .filter((m) => !this.categoryFilter() || m.categoryId === this.categoryFilter())
      .filter((m) => !this.natureFilter() || m.natureId === this.natureFilter())
      .filter((m) => !scope || m.locations.some((l) => scope.has(l.warehouseId)))
      .filter((m) => !term || `${m.name} ${m.code} ${m.notes}`.toLowerCase().includes(term))
      .map((material) => {
        const level = stockLevel(material.stock, material.minStock, material.maxStock);
        return {
          material,
          level,
          value: material.stock * material.unitCost,
          sell: sellingPrice(material.unitCost, material.margin),
          places: material.locations.filter((l) => l.quantity > 0).length,
          ratio: material.maxStock ? Math.min(1, material.stock / material.maxStock) : material.minStock ? Math.min(1, material.stock / (material.minStock * 2)) : 1,
        };
      })
      .filter((r) => !this.levelFilter() || r.level === this.levelFilter());
    const sort = this.sort();
    return rows.sort((a, b) =>
      sort === 'name'
        ? a.material.name.localeCompare(b.material.name, 'ar')
        : sort === 'stock'
          ? b.material.stock - a.material.stock
          : sort === 'value'
            ? b.value - a.value
            : a.material.code.localeCompare(b.material.code),
    );
  });

  protected readonly totals = computed(() => {
    const all = this.inventory.all();
    return {
      cards: all.length,
      value: all.reduce((s, m) => s + m.stock * m.unitCost, 0),
      low: this.inventory.lowStock().length,
      over: this.inventory.overStock().length,
      zero: all.filter((m) => m.stock <= 0).length,
    };
  });

  protected readonly listOptions = computed(() => (this.listTab() === 'category' ? this.options.categories() : this.options.natures()));
  protected readonly usage = computed(() => {
    const map = new Map<string, number>();
    for (const m of this.inventory.all()) {
      if (m.categoryId) map.set(m.categoryId, (map.get(m.categoryId) ?? 0) + 1);
      if (m.natureId) map.set(m.natureId, (map.get(m.natureId) ?? 0) + 1);
    }
    return map;
  });

  protected format(field: CustomFieldDefinition, value: CustomFieldValue | undefined): string {
    return formatCustomValue(field, value);
  }

  protected open(material: Material): void {
    void this.router.navigate(['/warehouse/items', material.id]);
  }

  protected addOption(): void {
    const name = this.optionName().trim();
    if (!name) return;
    this.options.create(this.listTab(), name, this.optionCode().trim() || name.slice(0, 3));
    this.optionName.set('');
    this.optionCode.set('');
  }

  protected renameOption(option: CatalogOption, name: string): void {
    if (name.trim() && name.trim() !== option.name) this.options.update(option.id, { name: name.trim() });
  }

  protected recodeOption(option: CatalogOption, code: string): void {
    if (code.trim() && code.trim().toUpperCase() !== option.code) this.options.update(option.id, { code: code.trim() });
  }

  protected async removeOption(option: CatalogOption): Promise<void> {
    if (this.usage().get(option.id)) {
      this.toast.warning('لا يمكن الحذف', 'هذا الخيار مستخدم في بطاقات منتجات');
      return;
    }
    if (await this.confirm.ask({ title: 'حذف الخيار', message: `حذف «${option.name}» من القائمة؟`, confirmLabel: 'حذف', danger: true })) {
      this.options.remove(option.id);
    }
  }

  protected exportCsv(): void {
    downloadCsv(
      'product-cards',
      ['الرمز', 'الاسم', 'الفئة', 'التصنيف', 'الوحدة', 'الرصيد', 'الحد الأدنى', 'الحد الأقصى', 'تكلفة الوحدة', 'سعر البيع', 'طريقة التكلفة', 'القيمة'],
      this.rows().map((r) => [
        r.material.code,
        r.material.name,
        this.options.name(r.material.categoryId),
        this.options.name(r.material.natureId),
        UNIT_LABELS[r.material.unit],
        r.material.stock,
        r.material.minStock,
        r.material.maxStock,
        r.material.unitCost.toFixed(4),
        r.sell.toFixed(2),
        COST_METHOD_LABELS[r.material.costMethod],
        r.value.toFixed(2),
      ]),
    );
  }
}
