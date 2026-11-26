import { ChangeDetectionStrategy, Component, computed, effect, inject, model, output, signal } from '@angular/core';
import { InventoryStore } from '@application/state/inventory.store';
import { CatalogOptionStore, WarehouseStore } from '@application/state/warehouse.store';
import { ToastService } from '@core/feedback/toast.service';
import {
  Attachment,
  CatalogList,
  COST_METHOD_LABELS,
  CostMethod,
  EntityId,
  IsoDate,
  Material,
  MATERIAL_KIND_LABELS,
  MaterialKind,
  Unit,
  UNIT_LABELS,
} from '@domain/models';
import { generateItemCode, normalizeText, sellingPrice, textSimilarity } from '@domain/rules';
import { MoneyPipe, NumPipe } from '@shared/pipes/format.pipes';
import { AttachmentList } from '@shared/ui/file-drop/attachment-list';
import { FileDrop } from '@shared/ui/file-drop/file-drop';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';
import { LocationPicker } from '../shared/location-picker';

type StepKey = 'check' | 'category' | 'nature' | 'code' | 'info' | 'opening' | 'critical' | 'locations' | 'pricing' | 'review';

const STEPS: { key: StepKey; label: string }[] = [
  { key: 'check', label: 'التحقق من عدم التكرار' },
  { key: 'category', label: 'تصنيف النوع' },
  { key: 'nature', label: 'التصنيف التفصيلي' },
  { key: 'code', label: 'ترميز العنصر' },
  { key: 'info', label: 'معلومات العنصر' },
  { key: 'opening', label: 'حالة المخزون الأولى' },
  { key: 'critical', label: 'القيم الحرجة' },
  { key: 'locations', label: 'مواقع المنتج' },
  { key: 'pricing', label: 'التكلفة والتسعير' },
  { key: 'review', label: 'المراجعة والحفظ' },
];

interface OpeningRow {
  id: number;
  warehouseId: EntityId | null;
  shelfId: EntityId | null;
  quantity: number;
  unitCost: number;
  expiryDate: IsoDate | '';
}

interface StorageRow {
  id: number;
  warehouseId: EntityId | null;
  shelfId: EntityId | null;
}

/** Guided creation of a product card that forces the duplicate check first (screen 2). */
@Component({
  selector: 'app-item-wizard',
  imports: [Modal, Icon, FileDrop, AttachmentList, LocationPicker, NumPipe, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './item-wizard.html',
  styleUrls: ['../shared/warehouse-common.scss', './item-wizard.scss'],
})
export class ItemWizard {
  private readonly toast = inject(ToastService);
  private readonly inventory = inject(InventoryStore);
  protected readonly options = inject(CatalogOptionStore);
  protected readonly warehouses = inject(WarehouseStore);

  readonly open = model(false);
  readonly created = output<Material>();

  protected readonly steps = STEPS;
  protected readonly unitLabels = UNIT_LABELS;
  protected readonly units = Object.keys(UNIT_LABELS) as Unit[];
  protected readonly kindLabels = MATERIAL_KIND_LABELS;
  protected readonly kinds = Object.keys(MATERIAL_KIND_LABELS) as MaterialKind[];
  protected readonly methodLabels = COST_METHOD_LABELS;
  protected readonly methods = Object.keys(COST_METHOD_LABELS) as CostMethod[];

  protected readonly step = signal(0);
  protected readonly current = computed(() => STEPS[this.step()].key);

  // Step 1 — duplicate check
  protected readonly probe = signal('');
  protected readonly checked = signal(false);
  // Steps 2–3
  protected readonly categoryId = signal<EntityId | null>(null);
  protected readonly natureId = signal<EntityId | null>(null);
  protected readonly newOptionName = signal('');
  protected readonly newOptionCode = signal('');
  // Step 4
  protected readonly manualCode = signal(false);
  protected readonly code = signal('');
  // Step 5
  protected readonly name = signal('');
  protected readonly unit = signal<Unit>('pcs');
  protected readonly kind = signal<MaterialKind>('raw');
  protected readonly specFiles = signal<readonly Attachment[]>([]);
  protected readonly notes = signal('');
  protected readonly duplicateAccepted = signal(false);
  // Step 6
  protected readonly hasStock = signal<boolean | null>(null);
  protected readonly opening = signal<OpeningRow[]>([]);
  // Step 7
  protected readonly minStock = signal(0);
  protected readonly maxStock = signal(0);
  // Step 8
  protected readonly storage = signal<StorageRow[]>([]);
  // Step 9
  protected readonly costMethod = signal<CostMethod>('average');
  protected readonly marginType = signal<'amount' | 'percent'>('percent');
  protected readonly marginValue = signal(15);

  private rowId = 0;

  protected readonly probeMatches = computed(() => this.similarTo(this.probe(), 0.5));
  protected readonly nameMatches = computed(() => this.similarTo(`${this.name()}`, 0.6));

  protected readonly category = computed(() => this.options.find(this.categoryId()));
  protected readonly nature = computed(() => this.options.find(this.natureId()));
  protected readonly suggestedCode = computed(() =>
    generateItemCode([this.category()?.code ?? '', this.nature()?.code ?? ''], this.inventory.all().map((m) => m.code)),
  );
  protected readonly codeTaken = computed(() => !!this.code().trim() && !!this.inventory.findByCode(this.code()));

  protected readonly openingTotal = computed(() => this.opening().reduce((s, r) => s + (r.quantity || 0), 0));
  protected readonly openingValue = computed(() => this.opening().reduce((s, r) => s + (r.quantity || 0) * (r.unitCost || 0), 0));
  protected readonly openingCost = computed(() => (this.openingTotal() ? this.openingValue() / this.openingTotal() : 0));
  protected readonly sellPreview = computed(() => sellingPrice(this.openingCost(), { type: this.marginType(), value: this.marginValue() }));

  /** Every place the item will be stored (opening quantities + designated empty places). */
  protected readonly allPlaces = computed(() => {
    const places = new Map<string, { label: string; quantity: number }>();
    for (const r of this.opening()) {
      if (!r.warehouseId) continue;
      const key = `${r.warehouseId}|${r.shelfId ?? ''}`;
      places.set(key, { label: this.warehouses.locationLabel(r.warehouseId, r.shelfId), quantity: (places.get(key)?.quantity ?? 0) + (r.quantity || 0) });
    }
    for (const r of this.storage()) {
      if (!r.warehouseId) continue;
      const key = `${r.warehouseId}|${r.shelfId ?? ''}`;
      if (!places.has(key)) places.set(key, { label: this.warehouses.locationLabel(r.warehouseId, r.shelfId), quantity: 0 });
    }
    return [...places.values()];
  });

  /** Reason the current step cannot be left yet, or null. */
  protected readonly blocker = computed<string | null>(() => {
    switch (this.current()) {
      case 'check':
        return this.checked() ? null : 'أكّد أنك بحثت ولم تجد عنصراً بنفس المواصفات';
      case 'category':
        return this.categoryId() ? null : 'اختر الفئة الأساسية';
      case 'nature':
        return this.natureId() ? null : 'اختر التصنيف التفصيلي';
      case 'code':
        if (!this.code().trim()) return 'أدخل رمز العنصر';
        return this.codeTaken() ? 'الرمز مستخدم في بطاقة أخرى' : null;
      case 'info':
        if (!this.name().trim()) return 'أدخل اسم العنصر';
        return this.nameMatches().length && !this.duplicateAccepted() ? 'يوجد عناصر مشابهة — راجعها وأكّد أن العنصر مختلف' : null;
      case 'opening':
        if (this.hasStock() === null) return 'حدد هل العنصر موجود مسبقاً في المستودعات';
        if (this.hasStock()) {
          if (!this.opening().length) return 'أضف موقعاً واحداً على الأقل مع الكمية';
          if (this.opening().some((r) => !r.warehouseId || r.quantity <= 0)) return 'حدد المستودع والكمية لكل سطر';
          if (this.opening().some((r) => r.unitCost < 0)) return 'سعر الوحدة غير صالح';
        }
        return null;
      case 'critical':
        if (this.minStock() < 0 || this.maxStock() < 0) return 'القيم لا يمكن أن تكون سالبة';
        return this.maxStock() && this.maxStock() < this.minStock() ? 'الحد الأقصى يجب أن يكون أكبر من الحد الأدنى' : null;
      case 'locations':
        if (this.storage().some((r) => !r.warehouseId)) return 'اختر المستودع لكل موقع أو احذفه';
        return this.allPlaces().length ? null : 'حدد موقعاً واحداً على الأقل للمنتج';
      default:
        return null;
    }
  });

  constructor() {
    effect(() => {
      if (this.open()) this.reset();
    });
    // Keep the generated code in sync until the user switches to manual entry.
    effect(() => {
      const suggested = this.suggestedCode();
      if (!this.manualCode()) this.code.set(suggested);
    });
  }

  private similarTo(text: string, threshold: number) {
    const probe = normalizeText(text);
    if (probe.length < 2) return [];
    return this.inventory
      .all()
      .map((m) => {
        const byCode = m.code.toLowerCase().includes(probe) ? 1 : 0;
        const byName = normalizeText(m.name).includes(probe) ? 1 : textSimilarity(text, `${m.name} ${m.notes}`);
        return { material: m, score: Math.max(byCode, byName) };
      })
      .filter((r) => r.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }

  protected go(index: number): void {
    if (index <= this.step()) {
      this.step.set(index);
      return;
    }
    // Moving forward is allowed only through valid steps.
    while (this.step() < index && !this.blocker()) this.step.update((s) => s + 1);
    if (this.blocker() && this.step() < index) this.toast.warning('أكمل الخطوة الحالية', this.blocker()!);
  }

  protected next(): void {
    const blocker = this.blocker();
    if (blocker) {
      this.toast.warning('لا يمكن المتابعة', blocker);
      return;
    }
    if (this.current() === 'info' && !this.probe().trim()) this.probe.set(this.name());
    this.step.update((s) => Math.min(STEPS.length - 1, s + 1));
  }

  protected back(): void {
    this.step.update((s) => Math.max(0, s - 1));
  }

  protected addOption(list: CatalogList): void {
    const name = this.newOptionName().trim();
    const code = this.newOptionCode().trim() || name.slice(0, 3);
    if (!name) return;
    const option = this.options.create(list, name, code);
    if (list === 'category') this.categoryId.set(option.id);
    else this.natureId.set(option.id);
    this.newOptionName.set('');
    this.newOptionCode.set('');
  }

  protected setManual(manual: boolean): void {
    this.manualCode.set(manual);
    if (!manual) this.code.set(this.suggestedCode());
  }

  protected setHasStock(value: boolean): void {
    this.hasStock.set(value);
    if (value && !this.opening().length) this.addOpening();
  }

  protected addOpening(): void {
    const last = this.opening().at(-1);
    this.opening.update((rows) => [...rows, { id: ++this.rowId, warehouseId: null, shelfId: null, quantity: 0, unitCost: last?.unitCost ?? 0, expiryDate: '' }]);
  }

  protected patchOpening(id: number, changes: Partial<OpeningRow>): void {
    this.opening.update((rows) => rows.map((r) => (r.id === id ? { ...r, ...changes } : r)));
  }

  protected removeOpening(id: number): void {
    this.opening.update((rows) => rows.filter((r) => r.id !== id));
  }

  protected addStorage(): void {
    this.storage.update((rows) => [...rows, { id: ++this.rowId, warehouseId: null, shelfId: null }]);
  }

  protected patchStorage(id: number, changes: Partial<StorageRow>): void {
    this.storage.update((rows) => rows.map((r) => (r.id === id ? { ...r, ...changes } : r)));
  }

  protected removeStorage(id: number): void {
    this.storage.update((rows) => rows.filter((r) => r.id !== id));
  }

  protected addFiles(files: readonly Attachment[]): void {
    this.specFiles.update((list) => [...list, ...files]);
  }

  protected removeFile(id: EntityId): void {
    this.specFiles.update((list) => list.filter((f) => f.id !== id));
  }

  protected save(): void {
    const material = this.inventory.create({
      code: this.code().trim().toUpperCase(),
      name: this.name().trim(),
      kind: this.kind(),
      unit: this.unit(),
      unitCost: this.openingCost(),
      minStock: this.minStock(),
      maxStock: this.maxStock(),
      categoryId: this.categoryId(),
      natureId: this.natureId(),
      costMethod: this.costMethod(),
      margin: { type: this.marginType(), value: this.marginValue() },
      specFiles: this.specFiles(),
      notes: this.notes().trim(),
      opening: this.hasStock()
        ? this.opening().map((r) => ({ warehouseId: r.warehouseId!, shelfId: r.shelfId, quantity: r.quantity, unitCost: r.unitCost, expiryDate: r.expiryDate || null }))
        : [],
      storage: this.storage()
        .filter((r) => r.warehouseId)
        .map((r) => ({ warehouseId: r.warehouseId!, shelfId: r.shelfId })),
    });
    this.toast.success(this.hasStock() ? 'تم إنشاء البطاقة مع الرصيد الحالي' : 'تم إنشاء البطاقة برصيد صفري', `${material.code} — ${material.name}`);
    this.created.emit(material);
    this.open.set(false);
  }

  private reset(): void {
    this.step.set(0);
    this.probe.set('');
    this.checked.set(false);
    this.categoryId.set(null);
    this.natureId.set(null);
    this.manualCode.set(false);
    this.name.set('');
    this.unit.set('pcs');
    this.kind.set('raw');
    this.specFiles.set([]);
    this.notes.set('');
    this.duplicateAccepted.set(false);
    this.hasStock.set(null);
    this.opening.set([]);
    this.minStock.set(0);
    this.maxStock.set(0);
    this.storage.set([]);
    this.costMethod.set('average');
    this.marginType.set('percent');
    this.marginValue.set(15);
  }
}
