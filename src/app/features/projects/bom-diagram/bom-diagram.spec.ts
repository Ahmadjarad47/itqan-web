import { TestBed } from '@angular/core/testing';
import { BomStore } from '@application/state/bom.store';
import { featureProviders, seedProject } from '../../testing/feature-fixtures';
import { BomDiagram } from './bom-diagram';

async function setup() {
  TestBed.configureTestingModule({ providers: featureProviders() });
  const seed = seedProject();
  const fixture = TestBed.createComponent(BomDiagram);
  fixture.componentRef.setInput('rootId', seed.root.id);
  await fixture.whenStable();
  const diagram = fixture.componentInstance as any;
  return { ...seed, bom: TestBed.inject(BomStore), fixture, diagram };
}

describe('BomDiagram expansion', () => {
  it('stays expanded when the tree is edited', async () => {
    const { bom, fixture, diagram, root, child } = await setup();
    diagram.toggle(child.id);
    bom.update(child.id, { name: 'اسم جديد' });
    await fixture.whenStable();
    expect([...diagram.expanded()]).toEqual([root.id, child.id]);
  });

  it('starts over when the root changes', async () => {
    const { fixture, diagram, child } = await setup();
    diagram.toggle(child.id);
    const other = seedProject('ZED');
    fixture.componentRef.setInput('rootId', other.root.id);
    await fixture.whenStable();
    expect([...diagram.expanded()]).toEqual([other.root.id]);
  });
});
