import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { PurchaseStore } from '@application/state/purchase.store';
import { SupplierStore } from '@application/state/supplier.store';
import {
  CONTACT_CHANNEL_ICONS,
  CONTACT_CHANNEL_LABELS,
  ContactChannel,
  EntityId,
  PurchaseRequest,
} from '@domain/models';
import { addDays, isContactOverdue, todayIso } from '@domain/rules';
import { Icon } from '@shared/ui/icon/icon';

/**
 * RFQ follow-up: which suppliers were contacted, when and how, and when each one is
 * expected to reply with its price quotation.
 */
@Component({
  selector: 'app-contacts-panel',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="summary">
      <span><b class="num">{{ request().contacts.length }}</b> موردين تم التواصل معهم</span>
      <span class="ok"><b class="num">{{ stats().replied }}</b> ردّوا بالتسعير</span>
      <span><b class="num">{{ stats().waiting }}</b> بانتظار الرد</span>
      @if (stats().overdue) {
        <span class="late"><b class="num">{{ stats().overdue }}</b> تجاوزوا موعد الرد</span>
      }
    </div>

    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>المورد</th>
            <th>تاريخ التواصل</th>
            <th>آلية التواصل</th>
            <th>الرد المتوقع بالتسعير</th>
            <th>ملاحظات</th>
            <th>الحالة</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (c of request().contacts; track c.id) {
            @let late = overdue(c.id);
            <tr [class.late]="late">
              <td><strong>{{ suppliers.find(c.supplierId)?.name ?? '—' }}</strong></td>
              <td class="num nowrap">
                <input class="input input--sm" type="date" [value]="c.contactedAt" (change)="update(c.id, { contactedAt: $any($event.target).value || today })" />
              </td>
              <td>
                <select class="select input--sm" (change)="update(c.id, { channel: $any($event.target).value })">
                  @for (ch of channels; track ch) {
                    <option [value]="ch" [selected]="ch === c.channel">{{ channelLabels[ch] }}</option>
                  }
                </select>
              </td>
              <td class="num nowrap">
                <input class="input input--sm" type="date" [value]="c.expectedReplyDate ?? ''" (change)="update(c.id, { expectedReplyDate: $any($event.target).value || null })" />
              </td>
              <td><input class="input input--sm" [value]="c.note" placeholder="—" (change)="update(c.id, { note: $any($event.target).value })" /></td>
              <td class="nowrap">
                @if (c.replied) {
                  <button type="button" class="badge badge--success" title="إلغاء" (click)="update(c.id, { replied: false })"><app-icon name="check" [size]="12" /> تم الرد</button>
                } @else {
                  <button type="button" class="badge" [class.badge--danger]="late" [class.badge--accent]="!late" title="تسجيل الرد" (click)="update(c.id, { replied: true })">
                    <app-icon name="clock" [size]="12" /> {{ late ? 'متأخر' : 'بانتظار الرد' }}
                  </button>
                }
              </td>
              <td>
                <button type="button" class="btn btn--ghost btn--icon btn--sm" aria-label="حذف" (click)="purchases.removeContact(request().id, c.id)">
                  <app-icon name="trash" [size]="15" />
                </button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="7" class="subtle">لم يُسجَّل أي تواصل مع الموردين بعد</td></tr>
          }
        </tbody>
      </table>
    </div>

    <div class="add">
      <select class="select input--sm" [value]="supplierId()" (change)="supplierId.set($any($event.target).value)">
        <option value="">المورد الذي تم التواصل معه...</option>
        @for (s of available(); track s.id) {
          <option [value]="s.id">{{ s.name }} — {{ s.category }}</option>
        }
      </select>
      <label class="mini">
        <span>تاريخ التواصل</span>
        <input class="input input--sm" type="date" [value]="contactedAt()" (change)="contactedAt.set($any($event.target).value || today)" />
      </label>
      <label class="mini">
        <span>آلية التواصل</span>
        <select class="select input--sm" (change)="channel.set($any($event.target).value)">
          @for (ch of channels; track ch) {
            <option [value]="ch" [selected]="ch === channel()">{{ channelLabels[ch] }}</option>
          }
        </select>
      </label>
      <label class="mini">
        <span>الرد المتوقع</span>
        <input class="input input--sm" type="date" [value]="expected()" (change)="expected.set($any($event.target).value)" />
      </label>
      <input class="input input--sm note" placeholder="ملاحظات (ما المطلوب تسعيره، الشخص المسؤول...)" [value]="note()" (input)="note.set($any($event.target).value)" />
      <button type="button" class="btn btn--primary btn--sm" [disabled]="!supplierId()" (click)="add()">
        <app-icon name="plus" [size]="15" /> تسجيل التواصل
      </button>
    </div>
  `,
  styles: `
    .summary {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 18px;
      margin-bottom: 10px;
      font-size: 12.5px;
      color: var(--text-muted);
      .ok b { color: var(--success); }
      .late b { color: var(--danger); }
    }
    tr.late td {
      background: var(--danger-soft);
    }
    td .input,
    td .select {
      min-width: 120px;
    }
    button.badge {
      border: 0;
      cursor: pointer;
      font: inherit;
      font-size: 11.5px;
    }
    .add {
      display: grid;
      grid-template-columns: 1.4fr 1fr 1fr 1fr;
      gap: 8px;
      align-items: end;
      padding-top: 12px;
      .note {
        grid-column: 1 / 4;
      }
    }
    .mini {
      display: flex;
      flex-direction: column;
      gap: 3px;
      span {
        font-size: 11px;
        color: var(--text-subtle);
      }
    }
    @media (max-width: 820px) {
      .add {
        grid-template-columns: 1fr 1fr;
        .note {
          grid-column: 1 / -1;
        }
      }
    }
  `,
})
export class ContactsPanel {
  protected readonly purchases = inject(PurchaseStore);
  protected readonly suppliers = inject(SupplierStore);

  readonly request = input.required<PurchaseRequest>();

  protected readonly today = todayIso();
  protected readonly channels = Object.keys(CONTACT_CHANNEL_LABELS) as ContactChannel[];
  protected readonly channelLabels = CONTACT_CHANNEL_LABELS;
  protected readonly channelIcons = CONTACT_CHANNEL_ICONS;

  protected readonly supplierId = signal('');
  protected readonly contactedAt = signal(this.today);
  protected readonly channel = signal<ContactChannel>('email');
  protected readonly expected = signal(addDays(this.today, 3));
  protected readonly note = signal('');

  protected readonly available = computed(() => {
    const used = new Set(this.request().contacts.map((c) => c.supplierId));
    return this.suppliers.sorted().filter((s) => !used.has(s.id));
  });

  protected readonly stats = computed(() => {
    const contacts = this.request().contacts;
    const replied = contacts.filter((c) => c.replied).length;
    return {
      replied,
      waiting: contacts.length - replied,
      overdue: contacts.filter((c) => isContactOverdue(c, this.today)).length,
    };
  });

  protected overdue(contactId: EntityId): boolean {
    const contact = this.request().contacts.find((c) => c.id === contactId);
    return !!contact && isContactOverdue(contact, this.today);
  }

  protected update(contactId: EntityId, changes: Parameters<PurchaseStore['updateContact']>[2]): void {
    this.purchases.updateContact(this.request().id, contactId, changes);
  }

  protected add(): void {
    this.purchases.addContact(this.request().id, {
      supplierId: this.supplierId(),
      contactedAt: this.contactedAt() || this.today,
      channel: this.channel(),
      expectedReplyDate: this.expected() || null,
      note: this.note().trim(),
      replied: false,
    });
    this.supplierId.set('');
    this.note.set('');
  }
}
