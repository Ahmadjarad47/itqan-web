import { computed, inject, Injectable, signal } from '@angular/core';
import {
  CompanyProfile,
  EntityId,
  Program,
  ProjectModel,
  SerialUnit,
  SerialUnitStatus,
} from '@domain/models';
import { ProgramRepository, ProjectModelRepository } from '@domain/ports/repositories';
import { nextSequence, todayIso } from '@domain/rules';
import { EntityStore, newId } from './entity-store';

const COMPANY_KEY = 'erp101.company';
const DEFAULT_COMPANY: CompanyProfile = { code: 'RAD', name: 'الشركة' };

function readCompany(): CompanyProfile {
  try {
    const raw = localStorage.getItem(COMPANY_KEY);
    return raw ? { ...DEFAULT_COMPANY, ...(JSON.parse(raw) as Partial<CompanyProfile>) } : DEFAULT_COMPANY;
  } catch {
    return DEFAULT_COMPANY;
  }
}

/** Programs (top level under the company) that group related projects. */
@Injectable({ providedIn: 'root' })
export class ProgramStore extends EntityStore<Program> {
  protected readonly repository = inject(ProgramRepository);

  /** Root of the hierarchy chart; a UI preference until a backend owns it. */
  readonly company = signal<CompanyProfile>(readCompany());

  readonly sorted = computed(() => [...this.all()].sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true })));

  setCompany(profile: CompanyProfile): void {
    this.company.set(profile);
    try {
      localStorage.setItem(COMPANY_KEY, JSON.stringify(profile));
    } catch {
      // Preference only.
    }
  }

  create(data: Pick<Program, 'code' | 'name' | 'description'>): Program {
    return this.insert({ ...data, id: newId('prog'), createdAt: todayIso() });
  }

  update(id: EntityId, changes: Partial<Pick<Program, 'code' | 'name' | 'description'>>): void {
    this.modify(id, changes);
  }

  remove(id: EntityId): void {
    this.removeWhere((program) => program.id === id);
  }
}

/** Models (product variants) of each project and their serial units. */
@Injectable({ providedIn: 'root' })
export class ProjectModelStore extends EntityStore<ProjectModel> {
  protected readonly repository = inject(ProjectModelRepository);

  readonly byProject = computed(() => {
    const map = new Map<EntityId, ProjectModel[]>();
    for (const model of [...this.all()].sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }))) {
      const list = map.get(model.projectId) ?? [];
      list.push(model);
      map.set(model.projectId, list);
    }
    return map;
  });

  forProject(projectId: EntityId): readonly ProjectModel[] {
    return this.byProject().get(projectId) ?? [];
  }

  /** Suggests the next model code, e.g. AM.101 → AM.102. */
  nextCode(projectId: EntityId, projectCode: string): string {
    const prefix = `${projectCode}.`;
    return `${prefix}${nextSequence(this.forProject(projectId).map((m) => m.code), prefix)}`;
  }

  create(projectId: EntityId, data: Pick<ProjectModel, 'code' | 'name' | 'description'>): ProjectModel {
    return this.insert({ ...data, id: newId('mdl'), projectId, units: [], createdAt: todayIso() });
  }

  update(id: EntityId, changes: Partial<Pick<ProjectModel, 'code' | 'name' | 'description'>>): void {
    this.modify(id, changes);
  }

  /** Adds serial units numbered after the highest existing serial (AM.101-1, AM.101-2...). */
  addUnits(id: EntityId, count: number): void {
    this.modify(id, (model) => {
      const highest = model.units.reduce((max, unit) => Math.max(max, Number(unit.serial.split('-').at(-1)) || 0), 0);
      const units: SerialUnit[] = Array.from({ length: Math.max(1, Math.min(50, count)) }, (_, i) => ({
        id: newId('u'),
        serial: `${model.code}-${highest + i + 1}`,
        status: 'planned',
        note: '',
      }));
      return { ...model, units: [...model.units, ...units] };
    });
  }

  setUnitStatus(id: EntityId, unitId: EntityId, status: SerialUnitStatus): void {
    this.modify(id, (model) => ({ ...model, units: model.units.map((u) => (u.id === unitId ? { ...u, status } : u)) }));
  }

  removeUnit(id: EntityId, unitId: EntityId): void {
    this.modify(id, (model) => ({ ...model, units: model.units.filter((u) => u.id !== unitId) }));
  }

  remove(id: EntityId): void {
    this.removeWhere((model) => model.id === id);
  }

  removeProject(projectId: EntityId): void {
    this.removeWhere((model) => model.projectId === projectId);
  }
}
