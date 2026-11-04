import { HasCustomFields } from './custom-field';
import { Entity } from './common';

export interface Supplier extends Entity, HasCustomFields {
  readonly name: string;
  readonly category: string;
  /** 1 to 5. */
  readonly rating: number;
  readonly contactPerson: string;
  readonly phone: string;
  readonly email: string;
  readonly city: string;
}

export const SUPPLIER_CATEGORIES = [
  'معادن وصاج',
  'مكونات كهربائية',
  'إلكترونيات وأتمتة',
  'أنظمة هوائية',
  'أنظمة هيدروليكية',
  'عناصر ربط وتثبيت',
  'خدمات تصنيع خارجية',
  'دهانات ومعالجة سطوح',
] as const;
