import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BomStore } from '@application/state/bom.store';
import { ProjectStore } from '@application/state/project.store';
import { PurchaseStore } from '@application/state/purchase.store';
import { SupplierStore } from '@application/state/supplier.store';
import { CanDirective } from '@core/auth/can.directive';
import { ToastService } from '@core/feedback/toast.service';
import { PRIORITY_LABELS, PurchasePriority, PurchaseRequest, Unit, UNIT_LABELS } from '@domain/models';
import {
  etaDelayDays,
  isAwaitingQuotes,
  isIncoming,
  isPurchaseCompleted,
  purchaseProgress,
  purchaseStatusLabel,
  researchDays,
  todayIso,
} from '@domain/rules';
import { ArDatePipe, MoneyPipe, NumPipe } from '@shared/pipes/format.pipes';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { ProgressBar } from '@shared/ui/progress/progress';
import { StatCard } from '@shared/ui/stat-card/stat-card';
import { StageDots } from '../shared/stage-dots';

type Segment = 'all' | 'quotes' | 'incoming' | 'delayed' | 'completed' | 'standalone';

const SEGMENTS: { key: Segment; label: string; test: (r: PurchaseRequest, today: string) => boolean }[] = [
  { key: 'all', label: 'الكل', test: () => true },
  { key: 'quotes', label: 'بانتظار عروض الأسعار', test: (r) => isAwaitingQuotes(r) },
  { key: 'incoming', label: 'المنتجات الواردة', test: (r) => isIncoming(r) },
  { key: 'delayed', label: 'متأخرة', test: (r, today) => etaDelayDays(r, today) > 0 && !isPurchaseCompleted(r) },
  { key: 'completed', label: 'مستلمة', test: (r) => isPurchaseCompleted(r) },
  { key: 'standalone', label: 'شراء مستقل', test: (r) => r.projectId === null },
];
import { FormDraft } from '@shared/ui/form-draft/form-draft';

@Component({
  selector: 'app-purchase-list-page',
  imports: [ReactiveFormsModule, FormDraft, RouterLink, CanDirective, PageHeader, StatCard, Icon, Modal, EmptyState, ProgressBar, StageDots, MoneyPipe, NumPipe, ArDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './purchase-list-page.html',
  styleUrl: './purchase-list-page.scss',
})
export class PurchaseListPage {
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly purchases = inject(PurchaseStore);
  private readonly bom = inject(BomStore);
  protected readonly projects = inject(ProjectStore);
  protected readonly suppliers = inject(SupplierStore);

  protected readonly segments = SEGMENTS;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly unitLabels = UNIT_LABELS;
  protected readonly units = Object.keys(UNIT_LABELS) as Unit[];
  protected readonly priorities = Object.keys(PRIORITY_LABELS) as PurchasePriority[];
  protected readonly today = todayIso();

  protected readonly segment = signal<Segment>('all');
  protected readonly projectFilter = signal('');
  protected readonly supplierFilter = signal('');
  protected readonly search = signal('');
  protected readonly creating = signal(false);

  protected readonly counts = computed(() => {
    const result = {} as Record<Segment, number>;
    for (const s of SEGMENTS) result[s.key] = this.purchases.all().filter((r) => s.test(r, this.today)).length;
    return result;
  });

  protected readonly rows = computed(() => {
    const test = SEGMENTS.find((s) => s.key === this.segment())!.test;
    const term = this.search().trim();
    return this.purchases
      .sorted()
      .filter((r) => test(r, this.today))
      .filter((r) => !this.projectFilter() || r.projectId === this.projectFilter())
      .filter((r) => !this.supplierFilter() || r.supplierId === this.supplierFilter() || r.quotes.some((q) => q.supplierId === this.supplierFilter()))
      .filter((r) => !term || r.title.includes(term) || r.number.toLowerCase().includes(term.toLowerCase()))
      .map((request) => ({
        request,
        node: this.bom.find(request.nodeId),
        project: this.projects.find(request.projectId),
        supplier: this.suppliers.find(request.supplierId),
        status: purchaseStatusLabel(request),
        progress: purchaseProgress(request),
        delay: etaDelayDays(request, this.today),
        research: researchDays(request, this.today),
        completed: isPurchaseCompleted(request),
      }));
  });

  protected readonly totals = computed(() => {
    const all = this.purchases.all();
    const committed = all.filter((r) => r.unitPrice !== null).reduce((sum, r) => sum + (r.unitPrice ?? 0) * r.quantity, 0);
    return {
      open: all.filter((r) => !isPurchaseCompleted(r)).length,
      committed,
      incoming: this.counts().incoming,
      delayed: this.counts().delayed,
    };
  });

  protected readonly form = this.fb.group({
    title: ['', Validators.required],
    quantity: [1, [Validators.required, Validators.min(0.01)]],
    unit: ['pcs' as Unit],
    priority: ['normal' as PurchasePriority],
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
    const request = this.purchases.create({ ...this.form.getRawValue(), projectId: null, nodeId: null });
    this.creating.set(false);
    this.toast.success('تم فتح سجل شراء مستقل', request.number);
    void this.router.navigate(['/procurement/requests', request.id]);
  }

  protected open(id: string): void {
    void this.router.navigate(['/procurement/requests', id]);
  }
}
