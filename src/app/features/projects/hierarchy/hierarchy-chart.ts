import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProgramStore, ProjectModelStore } from '@application/state/program.store';
import { ProjectStore } from '@application/state/project.store';
import { EntityId, Program, Project, ProjectModel, SERIAL_STATUS_LABELS } from '@domain/models';
import { Icon } from '@shared/ui/icon/icon';

interface ProgramBranch {
  readonly program: Program | null;
  readonly projects: readonly { project: Project; models: readonly ProjectModel[] }[];
}

/**
 * Organisation chart of the whole portfolio:
 * Company → Programs → Projects → Models → serial units.
 */
@Component({
  selector: 'app-hierarchy-chart',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="viewport">
      <div class="tree">
        <div class="branch">
          <button type="button" class="company" title="تعديل اسم الشركة" (click)="editCompany.emit()">
            <small>الشركة</small>
            <strong class="ltr">{{ programs.company().code }}</strong>
          </button>
          @if (branches().length) {
            <div class="children">
              @for (b of branches(); track b.program?.id ?? 'none') {
                <div class="child">
                  <div class="branch">
                    <button type="button" class="box box--program" [class.box--muted]="!b.program" (click)="b.program && programSelected.emit(b.program.id)">
                      <strong class="ltr">{{ b.program?.code ?? '—' }}</strong>
                      <small>{{ b.program?.name ?? 'مشاريع غير مصنفة' }}</small>
                    </button>
                    @if (b.projects.length) {
                      <div class="children">
                        @for (p of b.projects; track p.project.id) {
                          <div class="child">
                            <div class="branch">
                              <a class="box box--project" [routerLink]="['/projects', p.project.id]">
                                <strong class="ltr">{{ p.project.code }}</strong>
                                <small>{{ p.project.name }}</small>
                              </a>
                              @if (p.models.length) {
                                <div class="children">
                                  @for (m of p.models; track m.id) {
                                    <div class="child">
                                      <div class="branch">
                                        <div class="box box--model">
                                          <span class="tag">موديل</span>
                                          <strong class="ltr">{{ m.code }}</strong>
                                          <small>{{ m.name }}</small>
                                        </div>
                                        @if (m.units.length) {
                                          <ul class="units">
                                            @for (u of m.units; track u.id) {
                                              <li [class]="'unit unit--' + u.status" [title]="statusLabels[u.status]">
                                                <span class="ltr num">{{ u.serial }}</span>
                                              </li>
                                            }
                                          </ul>
                                        }
                                      </div>
                                    </div>
                                  }
                                </div>
                              }
                            </div>
                          </div>
                        }
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
    <div class="legend subtle">
      @for (s of statuses; track s) {
        <span><i [class]="'dot unit--' + s"></i>{{ statusLabels[s] }}</span>
      }
      <span class="spacer"></span>
      <span><app-icon name="eye" [size]="13" /> انقر على المشروع لفتح شجرة المنتج · على البرنامج لتصفية المشاريع</span>
    </div>
  `,
  styles: `
    :host {
      --line: var(--border-strong);
      --gap: 22px;
      display: block;
    }
    .viewport {
      overflow: auto;
      padding: 8px 4px 16px;
      border-radius: var(--radius-lg);
      background: var(--surface);
      border: 1px solid var(--border);
    }
    .tree {
      display: flex;
      justify-content: center;
      min-width: max-content;
      padding: 16px;
    }
    .branch {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .children {
      position: relative;
      display: flex;
      padding-top: var(--gap);
      &::before {
        content: '';
        position: absolute;
        top: 0;
        inset-inline-start: 50%;
        height: var(--gap);
        border-inline-start: 2px solid var(--line);
      }
    }
    .child {
      position: relative;
      padding: var(--gap) 8px 0;
      &::before,
      &::after {
        content: '';
        position: absolute;
        top: 0;
        width: 50%;
        height: var(--gap);
        border-top: 2px solid var(--line);
      }
      &::before {
        inset-inline-start: 0;
      }
      &::after {
        inset-inline-end: 0;
        border-inline-start: 2px solid var(--line);
      }
      &:first-child::before,
      &:last-child::after {
        border: 0;
      }
      &:last-child::before {
        border-inline-end: 2px solid var(--line);
      }
      &:only-child::before {
        display: none;
      }
      &:only-child::after {
        border-top: 0;
      }
    }
    .company {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-width: 130px;
      height: 64px;
      padding: 0 24px;
      border: 0;
      border-radius: 50%;
      color: #fff;
      background: var(--accent-strong);
      box-shadow: var(--shadow);
      cursor: pointer;
      font: inherit;
      small {
        font-size: 11px;
        opacity: 0.85;
      }
      strong {
        font-size: 18px;
      }
    }
    .box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      min-width: 120px;
      max-width: 190px;
      padding: 10px 14px;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      text-align: center;
      font: inherit;
      box-shadow: var(--shadow-xs);
      transition: transform 0.2s var(--ease), box-shadow 0.2s;
      strong {
        font-size: 14px;
      }
      small {
        font-size: 11.5px;
        color: var(--text-muted);
        line-height: 1.5;
      }
      &--program {
        cursor: pointer;
        background: var(--primary-soft);
        border-color: var(--primary);
        strong {
          color: var(--primary);
          font-size: 17px;
        }
      }
      &--muted {
        background: var(--surface-sunken);
        border-style: dashed;
        border-color: var(--border-strong);
        cursor: default;
      }
      &--project {
        background: var(--forest-800);
        border-color: var(--forest-800);
        color: #fff;
        small {
          color: var(--wheat-300);
        }
        &:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow);
        }
      }
      &--model {
        background: var(--accent-soft);
        border-color: var(--accent);
      }
    }
    .tag {
      font-size: 10px;
      font-weight: 700;
      color: var(--accent-strong);
    }
    .units {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin: 8px 0 0;
      padding: 0;
      list-style: none;
    }
    .unit {
      padding: 2px 10px;
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 600;
      border-inline-start: 3px solid var(--tone);
      background: var(--surface-sunken);
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
    .legend {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 16px;
      margin-top: 10px;
      font-size: 12px;
      span {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 3px;
      background: var(--tone);
    }
  `,
})
export class HierarchyChart {
  protected readonly programs = inject(ProgramStore);
  private readonly projects = inject(ProjectStore);
  private readonly models = inject(ProjectModelStore);

  readonly editCompany = output<void>();
  readonly programSelected = output<EntityId>();

  protected readonly statusLabels = SERIAL_STATUS_LABELS;
  protected readonly statuses = Object.keys(SERIAL_STATUS_LABELS) as (keyof typeof SERIAL_STATUS_LABELS)[];

  protected readonly branches = computed<ProgramBranch[]>(() => {
    const projects = this.projects.sorted();
    const known = new Set(this.programs.all().map((p) => p.id));
    const withModels = (list: readonly Project[]) => list.map((project) => ({ project, models: this.models.forProject(project.id) }));
    const branches: ProgramBranch[] = this.programs.sorted().map((program) => ({
      program,
      projects: withModels(projects.filter((p) => p.programId === program.id)),
    }));
    const orphans = projects.filter((p) => !p.programId || !known.has(p.programId));
    if (orphans.length) branches.push({ program: null, projects: withModels(orphans) });
    return branches;
  });
}
