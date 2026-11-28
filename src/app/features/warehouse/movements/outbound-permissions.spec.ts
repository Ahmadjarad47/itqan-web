import { TestBed } from '@angular/core/testing';
import { InventoryStore } from '@application/state/inventory.store';
import { RequisitionStore } from '@application/state/warehouse.store';
import { Permission } from '@domain/models';
import { featureProviders } from '../../testing/feature-fixtures';
import { signInWith } from '../../../testing/stores';
import { OutboundPanel } from './outbound-panel';

describe('OutboundPanel permissions', () => {
  async function setup(...permissions: Permission[]) {
    TestBed.configureTestingModule({ providers: featureProviders() });
    signInWith(...permissions);
    const material = TestBed.inject(InventoryStore).create({
      code: 'M-1', name: 'صاج', kind: 'raw', unit: 'pcs', unitCost: 5, minStock: 0, maxStock: 0,
      categoryId: null, natureId: null, costMethod: 'average', margin: { type: 'percent', value: 0 }, specFiles: [], notes: '',
      opening: [{ warehouseId: 'wh-a', shelfId: null, quantity: 10, unitCost: 5 }],
    });
    const requisition = TestBed.inject(RequisitionStore).create({
      origin: 'system', departmentId: null, requester: 'سامر', projectId: null,
      requestDate: '2026-01-01', dueDate: '2026-01-05', warehouseId: null, notes: '',
      lines: [{ materialId: material.id, quantity: 2, note: '' }],
    });
    const fixture = TestBed.createComponent(OutboundPanel);
    await fixture.whenStable();
    return { fixture, requisition, panel: fixture.componentInstance as any };
  }

  const statusSelect = (el: HTMLElement) => el.querySelector('select.status-select');

  it('shows a view-only user the status without a way to change it', async () => {
    const { fixture } = await setup('inventory.view');
    expect(statusSelect(fixture.nativeElement)).toBeNull();
    expect(fixture.nativeElement.querySelector('tbody').textContent).toContain('جديد');
  });

  it('does not open the issue dialog for a view-only user', async () => {
    const { panel, requisition } = await setup('inventory.view');
    panel.openIssue(requisition);
    expect(panel.issueOpen()).toBe(false);
  });

  it('keeps the status list for a stock manager', async () => {
    const { fixture } = await setup('inventory.view', 'inventory.manage');
    expect(statusSelect(fixture.nativeElement)).not.toBeNull();
  });
});
