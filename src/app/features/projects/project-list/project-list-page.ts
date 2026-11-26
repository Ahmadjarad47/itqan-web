import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthorizationService } from '@application/auth/authorization.service';
import { ProjectInsightsQuery } from '@application/queries/project-insights.query';
import { BomStore } from '@application/state/bom.store';
import { ProjectStore } from '@application/state/project.store';
import { ProgramStore, ProjectModelStore } from '@application/state/program.store';
import { HierarchyChart } from '../hierarchy/hierarchy-chart';
import { ProjectSetupUseCase } from '@application/use-cases/project-setup.use-case';
import { CanDirective } from '@core/auth/can.directive';
import { ToastService } from '@core/feedback/toast.service';
import { Discipline, DISCIPLINES, DISCIPLINE_KEYS, EntityId, PROJECT_STATUS_LABELS } from '@domain/models';
import { addDays, todayIso } from '@domain/rules';
import { ArDatePipe, MoneyPipe } from '@shared/pipes/format.pipes';
import { Icon } from '@shared/ui/icon/icon';
import { readImageAsDataUrl } from '@shared/ui/image-picker/read-image';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { ProductVisual } from '@shared/ui/product-visual/product-visual';
import { ProgressBar } from '@shared/ui/progress/progress';
import { FormDraft } from '@shared/ui/form-draft/form-draft';

@Component({
  selector: 'app-project-list-page',
  imports: [ReactiveFormsModule, FormDraft, RouterLink, CanDirective, PageHeader, Icon, Modal, ProductVisual, ProgressBar, HierarchyChart, MoneyPipe, ArDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-list-page.html',
  styleUrl: './project-list-page.scss',
})
export class ProjectListPage {
  private readonly projects = inject(ProjectStore);
  private readonly bom = inject(BomStore);
  private readonly insights = inject(ProjectInsightsQuery);
  private readonly setup = inject(ProjectSetupUseCase);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly programs = inject(ProgramStore);
  private readonly models = inject(ProjectModelStore);

  private readonly auth = inject(AuthorizationService);
  protected readonly canManage = computed(() => this.auth.can('projects.manage'));
  protected readonly statusLabels = PROJECT_STATUS_LABELS;
  protected readonly disciplines = DISCIPLINE_KEYS.map((key) => ({ key, label: DISCIPLINES[key].label }));
  protected readonly creating = signal(false);
  protected readonly image = signal<string | null>(null);

  protected readonly view = signal<'cards' | 'hierarchy'>('cards');
  /** '' = all programs, 'none' = projects outside any program. */
  protected readonly programFilter = signal('');
  protected readonly programOpen = signal(false);
  protected readonly companyOpen = signal(false);
  protected readonly programDraft = signal({ code: '', name: '', description: '' });
  protected readonly companyDraft = signal({ code: '', name: '' });

  protected readonly programCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const p of this.projects.all()) counts.set(p.programId ?? 'none', (counts.get(p.programId ?? 'none') ?? 0) + 1);
    return counts;
  });

  protected readonly cards = computed(() =>
    this.projects
      .sorted()
      .filter((project) => {
        const filter = this.programFilter();
        return !filter || (filter === 'none' ? !project.programId : project.programId === filter);
      })
      .map((project) => {
      const root = this.bom.find(project.rootNodeId);
      const cost = this.insights.costByProject().get(project.id);
      return {
        project,
        root,
        progress: this.insights.projectProgress(project.id),
        unitCost: cost?.unitCost ?? 0,
        totalCost: (cost?.unitCost ?? 0) * project.productionQuantity,
        levels: root ? this.bom.tree().depth(root.id) + 1 : 1,
        mainComponents: root ? this.bom.tree().children(root.id).length : 0,
        program: this.programs.find(project.programId),
        models: this.models.forProject(project.id).length,
        units: this.models.forProject(project.id).reduce((sum, m) => sum + m.units.length, 0),
      };
    }),
  );

  protected readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9-]+$/)]],
    name: ['', Validators.required],
    customer: ['', Validators.required],
    programId: [''],
    productionQuantity: [1, [Validators.required, Validators.min(1)]],
    dueDate: [addDays(todayIso(), 90), Validators.required],
    discipline: ['mechanical' as Discipline],
    description: [''],
  });

  protected setQuantity(id: EntityId, value: number): void {
    this.projects.setProductionQuantity(id, value);
  }

  protected step(event: Event, id: EntityId, current: number, delta: number): void {
    event.stopPropagation();
    this.projects.setProductionQuantity(id, current + delta);
  }

  protected async onImage(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.image.set(await readImageAsDataUrl(file));
  }

  protected openCreate(): void {
    this.form.reset({ programId: this.programFilter() && this.programFilter() !== 'none' ? this.programFilter() : '' });
    this.image.set(null);
    this.creating.set(true);
  }

  protected create(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const project = this.setup.create({ ...value, programId: value.programId || null, code: value.code.toUpperCase(), image: this.image() });
    this.creating.set(false);
    this.toast.success('تم إنشاء المشروع', `${project.name} — يمكنك الآن بناء شجرة المنتج`);
    void this.router.navigate(['/projects', project.id]);
  }

  protected selectProgram(id: string): void {
    this.programFilter.set(id);
    this.view.set('cards');
  }

  protected openProgram(): void {
    this.programDraft.set({ code: '', name: '', description: '' });
    this.programOpen.set(true);
  }

  protected patchProgram(changes: Partial<{ code: string; name: string; description: string }>): void {
    this.programDraft.update((draft) => ({ ...draft, ...changes }));
  }

  protected saveProgram(): void {
    const draft = this.programDraft();
    const code = draft.code.trim().toUpperCase();
    if (!code || !draft.name.trim()) {
      this.toast.warning('أدخل رمز البرنامج واسمه');
      return;
    }
    if (this.programs.all().some((p) => p.code.toUpperCase() === code)) {
      this.toast.error('رمز البرنامج مستخدم مسبقاً');
      return;
    }
    const program = this.programs.create({ code, name: draft.name.trim(), description: draft.description.trim() });
    this.programOpen.set(false);
    this.toast.success('تم إنشاء البرنامج', `${program.code} — ${program.name}`);
  }

  protected openCompany(): void {
    this.companyDraft.set({ ...this.programs.company() });
    this.companyOpen.set(true);
  }

  protected saveCompany(): void {
    const draft = this.companyDraft();
    if (!draft.code.trim()) return;
    this.programs.setCompany({ code: draft.code.trim(), name: draft.name.trim() });
    this.companyOpen.set(false);
  }

  protected setProgram(projectId: EntityId, programId: string): void {
    this.projects.update(projectId, { programId: programId || null });
  }
}
