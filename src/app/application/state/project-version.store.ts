import { computed, inject, Injectable } from '@angular/core';
import { EntityId, ProjectVersion } from '@domain/models';
import { ProjectVersionRepository } from '@domain/ports/repositories';
import { EntityStore } from './entity-store';

/** Saved snapshots (versions) of every project's tree and routings. */
@Injectable({ providedIn: 'root' })
export class ProjectVersionStore extends EntityStore<ProjectVersion> {
  protected readonly repository = inject(ProjectVersionRepository);

  /** Versions of each project, newest first. */
  readonly byProject = computed(() => {
    const map = new Map<EntityId, ProjectVersion[]>();
    for (const version of [...this.all()].sort((a, b) => b.number - a.number)) {
      map.set(version.projectId, [...(map.get(version.projectId) ?? []), version]);
    }
    return map;
  });

  forProject(projectId: EntityId): readonly ProjectVersion[] {
    return this.byProject().get(projectId) ?? [];
  }

  latest(projectId: EntityId): ProjectVersion | undefined {
    return this.forProject(projectId).find((v) => !v.automatic) ?? this.forProject(projectId)[0];
  }

  nextNumber(projectId: EntityId): number {
    return (this.forProject(projectId)[0]?.number ?? 0) + 1;
  }

  create(version: ProjectVersion): ProjectVersion {
    return this.insert(version);
  }

  update(id: EntityId, changes: Partial<Pick<ProjectVersion, 'label' | 'note'>>): void {
    this.modify(id, changes);
  }

  remove(id: EntityId): void {
    this.removeWhere((version) => version.id === id);
  }

  removeProject(projectId: EntityId): void {
    this.removeWhere((version) => version.projectId === projectId);
  }
}
