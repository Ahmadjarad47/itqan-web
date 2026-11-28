import { TestBed } from '@angular/core/testing';
import { BomStore } from '@application/state/bom.store';
import { enter, featureProviders, seedProject } from '../../testing/feature-fixtures';
import { ItemDetailPage } from './item-detail-page';

async function setup() {
  TestBed.configureTestingModule({ providers: featureProviders() });
  const seed = seedProject();
  const bom = TestBed.inject(BomStore);
  bom.update(seed.child.id, { decision: 'buy', purchaseUnitPrice: 20, quantity: 3 });
  const fixture = TestBed.createComponent(ItemDetailPage);
  fixture.componentRef.setInput('projectId', seed.projectId);
  fixture.componentRef.setInput('nodeId', seed.child.id);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const field = (label: string) =>
    [...element.querySelectorAll('label.field')].find((l) => l.textContent!.includes(label))!.querySelector('input')!;
  const node = () => bom.find(seed.child.id)!;
  return { ...seed, fixture, element, node, quantity: () => field('كمية الاستخدام'), price: () => field('سعر وحدة الشراء') };
}

describe('ItemDetailPage numbers', () => {
  it.each(['-5', '0', ''])('keeps the quantity and restores the field for "%s"', async (typed) => {
    const { fixture, node, quantity } = await setup();
    enter(quantity(), typed);
    await fixture.whenStable();
    expect([node().quantity, quantity().value]).toEqual([3, '3']);
  });

  it('saves a positive quantity', async () => {
    const { node, quantity } = await setup();
    enter(quantity(), '2.5');
    expect(node().quantity).toBe(2.5);
  });

  it('keeps the purchase price and restores the field for a negative value', async () => {
    const { fixture, node, price } = await setup();
    enter(price(), '-4');
    await fixture.whenStable();
    expect([node().purchaseUnitPrice, price().value]).toEqual([20, '20']);
  });

  it.each([
    ['', null],
    ['0', 0],
    ['12.5', 12.5],
  ])('saves the purchase price "%s" as %s', async (typed, saved) => {
    const { node, price } = await setup();
    enter(price(), typed);
    expect(node().purchaseUnitPrice).toBe(saved);
  });
});

describe('ItemDetailPage route', () => {
  it('does not show a component that belongs to another project', async () => {
    const { fixture, element } = await setup();
    const other = seedProject('ZED');
    fixture.componentRef.setInput('nodeId', other.child.id);
    await fixture.whenStable();
    expect(element.textContent).toContain('المكون غير موجود');
    expect(element.textContent).not.toContain(other.child.name);
  });
});
