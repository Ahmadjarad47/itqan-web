import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BomStore } from '@application/state/bom.store';
import { ProjectStore } from '@application/state/project.store';
import { Entity, Project } from '@domain/models';
import * as ports from '@domain/ports/repositories';

class EmptyRepository<T extends Entity> {
  async getAll(): Promise<T[]> {
    return [];
  }
  async save(): Promise<void> {}
  async saveMany(): Promise<void> {}
  async remove(): Promise<void> {}
}

/** Router plus empty, side-effect free persistence for every repository port. */
export function featureProviders() {
  const repositories: Provider[] = Object.entries(ports)
    .filter(([name]) => name !== 'Repository')
    .map(([, provide]) => ({ provide, useFactory: () => new EmptyRepository() }));
  return [provideRouter([]), ...repositories];
}

/** A project with a three level product tree: root → child → grandchild. */
export function seedProject(code = 'ATL') {
  const bom = TestBed.inject(BomStore);
  const projectId = `p-${code}`;
  const data = { discipline: 'mechanical' as const, quantity: 1, unit: 'pcs' as const };
  const root = bom.createRoot(projectId, { ...data, code: `${code}-0`, name: `منتج ${code}` });
  TestBed.inject(ProjectStore).create({
    id: projectId,
    code,
    name: `مشروع ${code}`,
    customer: 'زبون',
    programId: null,
    rootNodeId: root.id,
    productionQuantity: 4,
    dueDate: '2027-01-01',
    status: 'active' as Project['status'],
    createdAt: '2026-01-01',
  });
  const child = bom.addChild(root.id, { ...data, name: `تجميعة ${code}` });
  const grandchild = bom.addChild(child.id, { ...data, name: `قطعة ${code}` });
  return { projectId, root, child, grandchild };
}

/** Types a value into an input and fires the given DOM event, as a user would. */
export function enter(input: HTMLInputElement, value: string, event: 'input' | 'change' = 'change'): void {
  input.value = value;
  input.dispatchEvent(new Event(event));
}
