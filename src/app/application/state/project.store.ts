import { computed, inject, Injectable } from '@angular/core';
import { EntityId, Project } from '@domain/models';
import { ProjectRepository } from '@domain/ports/repositories';
import { EntityStore } from './entity-store';

@Injectable({ providedIn: 'root' })
export class ProjectStore extends EntityStore<Project> {
  protected readonly repository = inject(ProjectRepository);

  protected override normalize(project: Project): Project {
    return { ...project, programId: project.programId ?? null };
  }

  readonly sorted = computed(() => [...this.all()].sort((a, b) => a.code.localeCompare(b.code)));

  create(project: Project): Project {
    return this.insert(project);
  }

  update(id: EntityId, changes: Partial<Omit<Project, 'id'>>): void {
    this.modify(id, changes);
  }

  setProductionQuantity(id: EntityId, quantity: number): void {
    this.modify(id, { productionQuantity: Math.max(1, Math.round(quantity) || 1) });
  }

  remove(id: EntityId): void {
    this.removeWhere((project) => project.id === id);
  }
}
