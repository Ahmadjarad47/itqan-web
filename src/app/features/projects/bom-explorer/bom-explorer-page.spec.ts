import { TestBed } from '@angular/core/testing';
import { featureProviders, seedProject } from '../../testing/feature-fixtures';
import { BomExplorerPage } from './bom-explorer-page';

describe('BomExplorerPage ?node=', () => {
  async function setup() {
    TestBed.configureTestingModule({ providers: featureProviders() });
    const own = seedProject();
    const other = seedProject('ZED');
    const fixture = TestBed.createComponent(BomExplorerPage);
    fixture.componentRef.setInput('projectId', own.projectId);
    const show = async (nodeId: string) => {
      fixture.componentRef.setInput('node', nodeId);
      await fixture.whenStable();
      return (fixture.nativeElement as HTMLElement).textContent!;
    };
    return { own, other, show };
  }

  it('shows a component of the project', async () => {
    const { own, show } = await setup();
    expect(await show(own.child.id)).toContain(own.child.name);
  });

  it('does not show a component of another project', async () => {
    const { other, show } = await setup();
    const text = await show(other.child.id);
    expect(text).not.toContain(other.child.name);
    expect(text).toContain('المشروع غير موجود');
  });
});
