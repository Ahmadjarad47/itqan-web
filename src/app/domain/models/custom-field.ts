import { Entity } from './common';

/** Entities that accept user-defined (dynamic) fields. */
export type CustomFieldEntity = 'bomNode' | 'supplier' | 'purchase' | 'material' | 'operation';

export const CUSTOM_FIELD_ENTITIES: Record<CustomFieldEntity, { label: string; icon: string }> = {
  bomNode: { label: 'مكونات شجرة المنتج', icon: 'tree' },
  supplier: { label: 'الموردون', icon: 'truck' },
  purchase: { label: 'طلبات الشراء', icon: 'cart' },
  material: { label: 'مواد المستودع', icon: 'warehouse' },
  operation: { label: 'عمليات المسار', icon: 'route' },
};

export type CustomFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'multiselect' | 'checkbox' | 'url';

export const CUSTOM_FIELD_TYPES: Record<CustomFieldType, { label: string; icon: string }> = {
  text: { label: 'نص قصير', icon: 'edit' },
  textarea: { label: 'نص طويل', icon: 'list' },
  number: { label: 'رقم', icon: 'coins' },
  date: { label: 'تاريخ', icon: 'calendar' },
  select: { label: 'قائمة اختيار', icon: 'chevron-down' },
  multiselect: { label: 'اختيار متعدد', icon: 'layers' },
  checkbox: { label: 'نعم / لا', icon: 'check-circle' },
  url: { label: 'رابط', icon: 'external' },
};

export type CustomFieldValue = string | number | boolean | readonly string[] | null;

export type CustomFieldValues = Readonly<Record<string, CustomFieldValue>>;

export interface CustomFieldDefinition extends Entity {
  readonly entity: CustomFieldEntity;
  readonly label: string;
  readonly type: CustomFieldType;
  readonly required: boolean;
  readonly options: readonly string[];
  readonly placeholder: string;
  readonly unit: string;
  readonly order: number;
  readonly active: boolean;
  /** Also shown as a column in the entity's list (where supported). */
  readonly showInList: boolean;
}

/** Any entity that can carry dynamic field values. */
export interface HasCustomFields {
  readonly customFields?: CustomFieldValues;
}

export function isEmptyValue(value: CustomFieldValue | undefined): boolean {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

/** Labels of required, active fields that have no value. */
export function missingRequiredFields(
  definitions: readonly CustomFieldDefinition[],
  values: CustomFieldValues | undefined,
): string[] {
  return definitions.filter((d) => d.active && d.required && isEmptyValue(values?.[d.id])).map((d) => d.label);
}

export function formatCustomValue(definition: CustomFieldDefinition, value: CustomFieldValue | undefined): string {
  if (isEmptyValue(value)) return '—';
  if (definition.type === 'checkbox') return value ? 'نعم' : 'لا';
  if (Array.isArray(value)) return value.join('، ');
  return `${value}${definition.unit ? ' ' + definition.unit : ''}`;
}
