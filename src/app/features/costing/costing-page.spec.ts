import { TestBed } from '@angular/core/testing';
import { BomStore } from '@application/state/bom.store';
import { InventoryStore } from '@application/state/inventory.store';
import { EmployeeStore } from '@application/state/organization.store';
import { RoleStore } from '@application/state/role.store';
import { enter, featureProviders, seedProject } from '../testing/feature-fixtures';
import { CostingPage } from './costing-page';

async function setup() {
  TestBed.configureTestingModule({ providers: featureProviders() });
  const seed = seedProject();
  const bom = TestBed.inject(BomStore);
  const fixture = TestBed.createComponent(CostingPage);
  await fixture.whenStable();
  const page = fixture.componentInstance as any;
  const visible = (): string[] => page.rows().map((r: any) => r.node.id);
  return { ...seed, bom, fixture, page, visible, inventory: TestBed.inject(InventoryStore) };
}

describe('CostingPage tree expansion', () => {
  it('stays expanded when a price changes', async () => {
    const { bom, fixture, page, visible, grandchild } = await setup();
    // The fourth level is closed by default: open its parent by hand.
    const leaf = bom.addChild(grandchild.id, { name: 'برغي', discipline: 'mechanical', quantity: 1, unit: 'pcs' });
    page.toggle(grandchild.id);
    expect(visible()).toContain(leaf.id);
    bom.update(leaf.id, { purchaseUnitPrice: 7, decision: 'buy' });
    await fixture.whenStable();
    expect(visible()).toContain(leaf.id);
  });

  it('stays collapsed when a price changes', async () => {
    const { bom, fixture, page, visible, root, child } = await setup();
    page.collapseAll();
    bom.update(root.id, { purchaseUnitPrice: 7 });
    await fixture.whenStable();
    expect(visible()).toEqual([root.id, child.id]);
  });

  it('starts over when another project is selected', async () => {
    const { fixture, page, visible } = await setup();
    page.collapseAll();
    const other = seedProject('ZED');
    fixture.componentRef.setInput('project', other.projectId);
    await fixture.whenStable();
    expect(visible()).toEqual([other.root.id, other.child.id, other.grandchild.id]);
  });
});

describe('CostingPage price inputs', () => {
  async function withInputs() {
    const context = await setup();
    // Price editing needs the costing.simulate permission of the signed-in user.
    const role = TestBed.inject(RoleStore).create({ name: 'م', description: '', color: '#000', permissions: ['costing.simulate'] });
    TestBed.inject(EmployeeStore).create({ name: 'مستخدم', title: '', departmentId: null, roleId: role.id, active: true } as never);
    const material = context.inventory.create({
      code: 'M-1', name: 'صاج', kind: 'raw', unit: 'pcs', unitCost: 5, minStock: 0, maxStock: 0,
      categoryId: null, natureId: null, costMethod: 'average', margin: { type: 'percent', value: 0 }, specFiles: [], notes: '',
    });
    context.bom.setMaterials(context.root.id, [{ materialId: material.id, quantity: 1 }]);
    context.bom.update(context.child.id, { decision: 'buy', purchaseUnitPrice: 20 });
    await context.fixture.whenStable();
    const element = context.fixture.nativeElement as HTMLElement;
    return {
      ...context,
      materialInput: () => element.querySelector<HTMLInputElement>('.materials input')!,
      buyInput: () => element.querySelector<HTMLInputElement>('.cost-table input')!,
      materialPrice: () => context.inventory.find(material.id)!.unitCost,
      buyPrice: () => context.bom.find(context.child.id)!.purchaseUnitPrice,
    };
  }

  it.each(['', '-3'])('keeps the material price while the field holds "%s"', async (typed) => {
    const { materialInput, materialPrice } = await withInputs();
    enter(materialInput(), typed, 'input');
    expect(materialPrice()).toBe(5);
  });

  it('shows the kept material price again when the user leaves the field', async () => {
    const { materialInput } = await withInputs();
    enter(materialInput(), '', 'input');
    materialInput().dispatchEvent(new Event('blur'));
    expect(materialInput().value).toBe('5');
  });

  it('clears the purchase price to null when the field is emptied', async () => {
    const { buyInput, buyPrice } = await withInputs();
    enter(buyInput(), '');
    expect(buyPrice()).toBeNull();
  });

  it('keeps the purchase price for a negative value', async () => {
    const { buyInput, buyPrice } = await withInputs();
    enter(buyInput(), '-3');
    expect([buyPrice(), buyInput().value]).toEqual([20, '20']);
  });
});
