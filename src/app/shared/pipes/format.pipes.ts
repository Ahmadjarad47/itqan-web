import { Pipe, PipeTransform } from '@angular/core';
import { IsoDate } from '@domain/models';
import { diffDays, parseIsoDate, todayIso } from '@domain/rules';

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const moneyFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compactMoney = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const dateFormat = new Intl.DateTimeFormat('ar-SY-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' });
const shortDate = new Intl.DateTimeFormat('ar-SY-u-nu-latn', { day: 'numeric', month: 'short' });
const dateTimeFormat = new Intl.DateTimeFormat('ar-SY-u-nu-latn', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export const CURRENCY = '$';

export function formatMoney(value: number | null | undefined, compact = false): string {
  if (value === null || value === undefined) return '—';
  return `${(compact ? compactMoney : moneyFormat).format(value)} ${CURRENCY}`;
}

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined, compact = false): string {
    return formatMoney(value, compact);
  }
}

@Pipe({ name: 'num' })
export class NumPipe implements PipeTransform {
  transform(value: number | null | undefined, suffix = ''): string {
    if (value === null || value === undefined) return '—';
    return numberFormat.format(value) + suffix;
  }
}

@Pipe({ name: 'arDate' })
export class ArDatePipe implements PipeTransform {
  transform(value: IsoDate | null | undefined, format: 'date' | 'short' | 'datetime' = 'date'): string {
    if (!value) return '—';
    if (format === 'datetime') return dateTimeFormat.format(new Date(value));
    const date = parseIsoDate(value);
    return (format === 'short' ? shortDate : dateFormat).format(date);
  }
}

@Pipe({ name: 'relativeDays' })
export class RelativeDaysPipe implements PipeTransform {
  transform(value: IsoDate | null | undefined): string {
    if (!value) return '—';
    const days = diffDays(todayIso(), value);
    if (days === 0) return 'اليوم';
    if (days === 1) return 'غداً';
    if (days === -1) return 'أمس';
    return days > 0 ? `بعد ${days} يوم` : `منذ ${-days} يوم`;
  }
}
