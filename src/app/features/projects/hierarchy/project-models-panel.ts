import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { AuthorizationService } from '@application/auth/authorization.service';
import { ProgramStore, ProjectModelStore } from '@application/state/program.store';
import { ProjectStore } from '@application/state/project.store';
import { ConfirmService } from '@core/feedback/confirm.service';
import { ToastService } from '@core/feedback/toast.service';
import { EntityId, SERIAL_STATUS_LABELS, SerialUnitStatus } from '@domain/models';
import { Icon } from '@shared/ui/icon/icon';

/** Models (variants) of the project and the serial-numbered units of each model. */
@Component({
  selector: 'app-project-models-panel',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card">
      <div class="card__header">
        <div>
          <h2 class="card__title"><app-icon name="layers" [size]="18" /> الموديلات والوحدات</h2>
          <p class="card__subtitle">
            {{ company() }} ← {{ program()?.code ? 'برنامج ' + program()!.code : 'بدون برنامج' }} ← {{ project()?.code }} ← الموديلات ← الأرقام التسلسلية
          </p>
        </div>
        <span class="spacer"></span>
        @if (canManage()) {
          <select class="select input--sm program" [title]="'البرنامج'" (change)="setProgram($any($event.target).value)">
            <option value="">— بدون برنامج —</option>
            @for (p of programs.sorted(); track p.id) {
              <option [value]="p.id" [selected]="p.id === project()?.programId">{{ p.code }} — {{ p.name }}</option>
            }
          </select>
        }
      </div>
      <div class="card__body">
        <div class="models">
          @for (m of models(); track m.id) {
            <article class="model">
              <header class="model__head">
                <strong class="ltr">{{ m.code }}</strong>
                <span class="muted">{{ m.name }}</span>
                <span class="spacer"></span>
                <span class="badge num">{{ m.units.length }} وحدة</span>
                @if (canManage()) {
                  <button type="button" class="btn btn--ghost btn--icon btn--sm" aria-label="حذف الموديل" (click)="removeModel(m.id, m.code)">
                    <app-icon name="trash" [size]="14" />
                  </button>
                }
              </header>
              @if (m.description) {
                <p class="model__desc">{{ m.description }}</p>
              }
              <ul class="units">
                @for (u of m.units; track u.id) {
                  <li [class]="'unit unit--' + u.status">
                    <span class="ltr num serial">{{ u.serial }}</span>
                    <select class="select input--sm" [disabled]="!canManage()" (change)="models$.setUnitStatus(m.id, u.id, $any($event.target).value)">
                      @for (s of statuses; track s) {
                        <option [value]="s" [selected]="s === u.status">{{ statusLabels[s] }}</option>
                      }
                    </select>
                    @if (canManage()) {
                      <button type="button" class="btn btn--ghost btn--icon btn--sm" aria-label="حذف الوحدة" (click)="models$.removeUnit(m.id, u.id)">
                        <app-icon name="x" [size]="13" />
                      </button>
                    }
                  </li>
                } @empty {
                  <li class="subtle empty">لا توجد وحدات مسجلة</li>
                }
              </ul>
              @if (canManage()) {
                <button type="button" class="btn btn--sm add-unit" (click)="models$.addUnits(m.id, 1)">
                  <app-icon name="plus" [size]="14" /> إضافة وحدة ({{ m.code }}-{{ m.units.length + 1 }})
                </button>
              }
            </article>
          } @empty {
            <p class="subtle">لم تُعرّف موديلات لهذا المشروع بعد — مثال: AM.101 «مع قاعس ليزري».</p>
          }
        </div>

        @if (canManage()) {
          <div class="add">
            <input class="input input--sm ltr" [placeholder]="suggested()" [value]="code()" (input)="code.set($any($event.target).value)" />
            <input class="input input--sm" placeholder="وصف الموديل (مثال: مع كاميرا مبردة)" [value]="name()" (input)="name.set($any($event.target).value)" />
            <input class="input input--sm units-count" type="number" min="0" max="50" [value]="count()" (input)="count.set(+$any($event.target).value)" title="عدد الوحدات" />
            <button type="button" class="btn btn--primary btn--sm" [disabled]="!name().trim()" (click)="addModel()">
              <app-icon name="plus" [size]="15" /> إضافة موديل
            </button>
          </div>
        }
      </div>
    </section>
  `,
  styles: `
    .program {
      max-width: 240px;
    }
    .models {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 12px;
    }
    .model {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
      border-radius: var(--radius);
      border: 1px solid var(--accent);
      background: var(--accent-soft);
      &__head {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      &__desc {
        margin: 0;
        font-size: 12.5px;
        color: var(--text-muted);
      }
    }
    .units {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .unit {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 6px 4px 4px;
      border-radius: 8px;
      background: var(--surface);
      border-inline-start: 3px solid var(--tone);
      .serial {
        flex: 1;
        font-weight: 600;
        font-size: 12.5px;
      }
      .select {
        width: auto;
      }
      &.empty {
        border: 0;
        background: none;
        font-size: 12px;
      }
    }
    .unit--planned {
      --tone: var(--border-strong);
    }
    .unit--in-production {
      --tone: var(--warning);
    }
    .unit--testing {
      --tone: var(--info);
    }
    .unit--delivered {
      --tone: var(--success);
    }
    .add-unit {
      align-self: flex-start;
    }
    .add {
      display: grid;
      grid-template-columns: 1fr 2fr 80px auto;
      gap: 8px;
      margin-top: 14px;
    }
    @media (max-width: 720px) {
      .add {
        grid-template-columns: 1fr 1fr;
      }
    }
  `,
})
export class ProjectModelsPanel {
  protected readonly models$ = inject(ProjectModelStore);
  protected readonly programs = inject(ProgramStore);
  private readonly projects = inject(ProjectStore);
  private readonly auth = inject(AuthorizationService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly projectId = input.required<EntityId>();

  protected readonly statusLabels = SERIAL_STATUS_LABELS;
  protected readonly statuses = Object.keys(SERIAL_STATUS_LABELS) as SerialUnitStatus[];
  protected readonly code = signal('');
  protected readonly name = signal('');
  protected readonly count = signal(1);

  protected readonly canManage = computed(() => this.auth.can('projects.manage'));
  protected readonly project = computed(() => this.projects.find(this.projectId()));
  protected readonly program = computed(() => this.programs.find(this.project()?.programId));
  protected readonly company = computed(() => this.programs.company().code);
  protected readonly models = computed(() => this.models$.forProject(this.projectId()));
  protected readonly suggested = computed(() => this.models$.nextCode(this.projectId(), this.project()?.code ?? ''));

  protected setProgram(programId: string): void {
    this.projects.update(this.projectId(), { programId: programId || null });
  }

  protected addModel(): void {
    const code = this.code().trim() || this.suggested();
    if (this.models$.all().some((m) => m.code === code)) {
      this.toast.error('رمز الموديل مستخدم مسبقاً');
      return;
    }
    const model = this.models$.create(this.projectId(), { code, name: this.name().trim(), description: '' });
    if (this.count() > 0) this.models$.addUnits(model.id, this.count());
    this.toast.success('تمت إضافة الموديل', code);
    this.code.set('');
    this.name.set('');
    this.count.set(1);
  }

  protected async removeModel(id: EntityId, code: string): Promise<void> {
    const accepted = await this.confirm.ask({
      title: 'حذف الموديل',
      message: `سيتم حذف الموديل ${code} مع جميع وحداته.`,
      confirmLabel: 'حذف',
      danger: true,
    });
    if (accepted) this.models$.remove(id);
  }
}
