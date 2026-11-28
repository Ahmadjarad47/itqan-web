import { TestBed } from '@angular/core/testing';
import { RoleStore } from '@application/state/role.store';
import { featureProviders } from '../../testing/feature-fixtures';
import { RolesPage } from './roles-page';

describe('RolesPage selection', () => {
  async function setup() {
    TestBed.configureTestingModule({ providers: featureProviders() });
    const roles = TestBed.inject(RoleStore);
    const base = { description: '', color: '#000', permissions: [] };
    const first = roles.create({ ...base, name: 'أ' });
    const second = roles.create({ ...base, name: 'ب' });
    const fixture = TestBed.createComponent(RolesPage);
    await fixture.whenStable();
    const page = fixture.componentInstance as any;
    page.selectedId.set(second.id);
    await fixture.whenStable();
    return { fixture, roles, page, first, second };
  }

  it('keeps the selected role while its permissions are edited', async () => {
    const { fixture, roles, page, second } = await setup();
    roles.togglePermission(second.id, 'dashboard.view');
    await fixture.whenStable();
    expect(page.selectedId()).toBe(second.id);
  });

  it('falls back to the first role when the selected one is removed', async () => {
    const { fixture, roles, page, first, second } = await setup();
    roles.remove(second.id);
    await fixture.whenStable();
    expect(page.selectedId()).toBe(first.id);
  });
});
