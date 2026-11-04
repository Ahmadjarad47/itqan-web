import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CustomFieldDefinition, CustomFieldValue, CustomFieldValues, EntityId, isEmptyValue } from '@domain/models';

export interface CustomFieldChange {
  readonly fieldId: EntityId;
  readonly value: CustomFieldValue;
}

/** Renders user-defined fields dynamically from their definitions. */
@Component({
  selector: 'app-custom-fields-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="form-grid">
      @for (field of fields(); track field.id) {
        @let value = values()?.[field.id] ?? null;
        @let invalid = showErrors() && field.required && isEmpty(value);
        <div class="field" [class.span-full]="field.type === 'textarea' || field.type === 'multiselect'">
          <span class="field__label">
            {{ field.label }}
            @if (field.required) {
              <b class="req">*</b>
            }
            @if (field.unit) {
              <small>({{ field.unit }})</small>
            }
          </span>
          @switch (field.type) {
            @case ('textarea') {
              <textarea class="textarea" [class.invalid]="invalid" [disabled]="disabled()" [placeholder]="field.placeholder" [value]="value ?? ''" (change)="emit(field.id, $any($event.target).value)"></textarea>
            }
            @case ('number') {
              <input class="input" type="number" step="any" [class.invalid]="invalid" [disabled]="disabled()" [placeholder]="field.placeholder" [value]="value ?? ''" (change)="emitNumber(field.id, $any($event.target).value)" />
            }
            @case ('date') {
              <input class="input" type="date" [class.invalid]="invalid" [disabled]="disabled()" [value]="value ?? ''" (change)="emit(field.id, $any($event.target).value)" />
            }
            @case ('url') {
              <input class="input ltr" type="url" [class.invalid]="invalid" [disabled]="disabled()" [placeholder]="field.placeholder || 'https://'" [value]="value ?? ''" (change)="emit(field.id, $any($event.target).value)" />
            }
            @case ('select') {
              <select class="select" [class.invalid]="invalid" [disabled]="disabled()" (change)="emit(field.id, $any($event.target).value)">
                <option value="" [selected]="!value">— اختر —</option>
                @for (option of field.options; track option) {
                  <option [value]="option" [selected]="option === value">{{ option }}</option>
                }
              </select>
            }
            @case ('multiselect') {
              <div class="chips" [class.invalid]="invalid">
                @for (option of field.options; track option) {
                  <button type="button" class="chip" [class.active]="includes(value, option)" [disabled]="disabled()" (click)="toggle(field.id, value, option)">
                    {{ option }}
                  </button>
                }
              </div>
            }
            @case ('checkbox') {
              <label class="checkbox switch">
                <input type="checkbox" [disabled]="disabled()" [checked]="!!value" (change)="emit(field.id, $any($event.target).checked)" />
                {{ value ? 'نعم' : 'لا' }}
              </label>
            }
            @default {
              <input class="input" [class.invalid]="invalid" [disabled]="disabled()" [placeholder]="field.placeholder" [value]="value ?? ''" (change)="emit(field.id, $any($event.target).value)" />
            }
          }
          @if (invalid) {
            <span class="field__error">هذا الحقل إلزامي</span>
          }
        </div>
      } @empty {
        <p class="subtle">{{ emptyText() }}</p>
      }
    </div>
  `,
  styles: `
    .req {
      color: var(--danger);
    }
    small {
      color: var(--text-subtle);
      font-weight: 400;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 4px;
      border-radius: 10px;
    }
    .chip {
      height: 30px;
      font-size: 12.5px;
    }
    .invalid {
      border-color: var(--danger) !important;
      box-shadow: 0 0 0 3px var(--danger-soft);
    }
    .switch {
      height: 40px;
    }
  `,
})
export class CustomFieldsForm {
  readonly fields = input.required<readonly CustomFieldDefinition[]>();
  readonly values = input<CustomFieldValues | undefined>();
  readonly disabled = input(false);
  readonly showErrors = input(true);
  readonly emptyText = input('لا توجد حقول مخصصة معرّفة لهذا الكيان.');

  readonly changed = output<CustomFieldChange>();

  protected isEmpty(value: CustomFieldValue): boolean {
    return isEmptyValue(value);
  }

  protected includes(value: CustomFieldValue, option: string): boolean {
    return Array.isArray(value) && value.includes(option);
  }

  protected emit(fieldId: EntityId, value: CustomFieldValue): void {
    this.changed.emit({ fieldId, value: value === '' ? null : value });
  }

  protected emitNumber(fieldId: EntityId, raw: string): void {
    this.emit(fieldId, raw === '' ? null : Number(raw));
  }

  protected toggle(fieldId: EntityId, current: CustomFieldValue, option: string): void {
    const list = Array.isArray(current) ? current : [];
    this.emit(fieldId, list.includes(option) ? list.filter((o) => o !== option) : [...list, option]);
  }
}
