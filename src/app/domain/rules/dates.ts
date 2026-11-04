import { IsoDate, IsoDateTime } from '../models';

const DAY_MS = 86_400_000;

export function toIsoDate(date: Date): IsoDate {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseIsoDate(value: IsoDate): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function todayIso(): IsoDate {
  return toIsoDate(new Date());
}

export function nowIso(): IsoDateTime {
  return new Date().toISOString();
}

export function addDays(value: IsoDate, days: number): IsoDate {
  const date = parseIsoDate(value);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: IsoDate, to: IsoDate): number {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / DAY_MS);
}

export function minDate(dates: readonly IsoDate[]): IsoDate | null {
  return dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
}

export function maxDate(dates: readonly IsoDate[]): IsoDate | null {
  return dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;
}
