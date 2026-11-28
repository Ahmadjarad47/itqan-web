import { TestBed } from '@angular/core/testing';
import { InventoryStore } from '@application/state/inventory.store';
import { RequisitionStore } from '@application/state/warehouse.store';
import { featureProviders } from '../../testing/feature-fixtures';
import { OutboundPanel } from './outbound-panel';

describe('OutboundPanel issue validation', () => {
  /** Two requisition lines of the same item, which the requisition form allows. */
  async function setup(first: number, second: number) {
    TestBed.configureTestingModule({ providers: featureProviders() });
    const material = TestBed.inject(InventoryStore).create({
      code: 'M-1', name: 'صاج', kind: 'raw', unit: 'pcs', unitCost: 5, minStock: 0, maxStock: 0,
      categoryId: null, natureId: null, costMethod: 'average', margin: { type: 'percent', value: 0 }, specFiles: [], notes: '',
      opening: [{ warehouseId: 'wh-a', shelfId: null, quantity: 10, unitCost: 5 }],
    });
    const requisition = TestBed.inject(RequisitionStore).create({
      origin: 'system', departmentId: null, requester: 'سامر', projectId: null,
      requestDate: '2026-01-01', dueDate: '2026-01-05', warehouseId: null, notes: '',
      lines: [first, second].map((quantity) => ({ materialId: material.id, quantity, note: '' })),
    });
    const fixture = TestBed.createComponent(OutboundPanel);
    await fixture.whenStable();
    const panel = fixture.componentInstance as any;
    panel.openIssue(requisition);
    return { panel };
  }

  it('reports two lines that together exceed the stock of one location', async () => {
    const { panel } = await setup(6, 6);
    expect(panel.issueError()).toBe('مجموع الكميات أكبر من المتوفر في الموقع المحدد');
  });

  it('accepts two lines that fit together, including decimals', async () => {
    const { panel } = await setup(9.7, 0.3);
    expect(panel.issueError()).toBeNull();
  });

  it('rejects a negative selling price', async () => {
    const { panel } = await setup(1, 1);
    panel.patchLine(panel.issueLines()[0].lineId, { sellPrice: -2 });
    expect(panel.issueError()).toBe('سعر البيع لا يمكن أن يكون سالباً');
  });
});
