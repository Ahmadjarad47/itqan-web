export interface NumberRules {
  /** Smallest accepted value (0 unless stated). */
  readonly min?: number;
  /** Rejects zero as well. */
  readonly positive?: boolean;
  /** Larger values are capped to this. */
  readonly max?: number;
  readonly integer?: boolean;
}

/** Reads a typed number; null when the text is blank or not acceptable, so the caller decides what to keep. */
export function parseNumber(raw: string, { min = 0, positive = false, max = Infinity, integer = false }: NumberRules = {}): number | null {
  const value = raw.trim() === '' ? NaN : Number(raw);
  if (!Number.isFinite(value) || value < min || (positive && value <= 0) || (integer && !Number.isInteger(value))) return null;
  return Math.min(value, max);
}
