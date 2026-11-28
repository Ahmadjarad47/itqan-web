import { TestBed } from '@angular/core/testing';
import { BomStore } from '@application/state/bom.store';
import { enter, featureProviders, seedProject } from '../../testing/feature-fixtures';
import { AddComponentDialog } from './add-component-dialog';

describe('AddComponentDialog', () => {
  async function setup() {
    TestBed.configureTestingModule({ providers: featureProviders() });
    const seed = seedProject();
    const fixture = TestBed.createComponent(AddComponentDialog);
    fixture.componentRef.setInput('parentId', seed.child.id);
    fixture.componentRef.setInput('open', true);
    await fixture.whenStable();
    const name = () => (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[formControlName="name"]')!;
    return { ...seed, bom: TestBed.inject(BomStore), fixture, name };
  }

  it('keeps what the user typed when the parent changes in the store', async () => {
    const { bom, fixture, name, child } = await setup();
    enter(name(), 'صفيحة', 'input');
    bom.update(child.id, { description: 'تعديل' });
    await fixture.whenStable();
    expect(name().value).toBe('صفيحة');
  });

  it('starts blank on the next opening', async () => {
    const { fixture, name } = await setup();
    enter(name(), 'صفيحة', 'input');
    fixture.componentRef.setInput('open', false);
    await fixture.whenStable();
    localStorage.clear(); // the saved draft would otherwise be restored
    fixture.componentRef.setInput('open', true);
    await fixture.whenStable();
    expect(name().value).toBe('');
  });
});
