import { TestBed } from '@angular/core/testing';
import { RoutingStore } from '@application/state/routing.store';
import { enter, featureProviders, seedProject } from '../../testing/feature-fixtures';
import { OperationForm } from './operation-form';

describe('OperationForm numbers', () => {
  async function setup() {
    TestBed.configureTestingModule({ providers: featureProviders() });
    const { child } = seedProject();
    const routing = TestBed.inject(RoutingStore);
    const created = routing.createBlank(child.id);
    routing.update(created.id, { progressMode: 'quantity', completedQuantity: 1 });
    const fixture = TestBed.createComponent(OperationForm);
    const operation = () => routing.find(created.id)!;
    fixture.componentRef.setInput('operation', operation());
    await fixture.whenStable();
    const field = (label: string) =>
      [...(fixture.nativeElement as HTMLElement).querySelectorAll('label.field')]
        .find((l) => l.textContent!.includes(label))!
        .querySelector('input')!;
    return { operation, field };
  }

  it.each(['0', '-10', '', '2.5'])('keeps the sequence and restores the field for "%s"', async (typed) => {
    const { operation, field } = await setup();
    enter(field('تسلسل العملية'), typed);
    expect([operation().sequence, field('تسلسل العملية').value]).toEqual([10, '10']);
  });

  it('caps the completed quantity at the lot size', async () => {
    const { operation, field } = await setup();
    enter(field('الكمية المكتملة'), '99');
    expect([operation().completedQuantity, field('الكمية المكتملة').value]).toEqual([4, '4']);
  });

  it('keeps the stored value for a negative number', async () => {
    const { operation, field } = await setup();
    enter(field('وقت الإعداد'), '-1');
    expect(operation().setupMinutes).toBe(15);
  });
});
