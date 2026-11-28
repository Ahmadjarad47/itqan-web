import { parseNumber } from './parse-number';

describe('parseNumber', () => {
  it.each(['', '   ', 'abc', 'Infinity', '-1'])('rejects "%s"', (raw) => {
    expect(parseNumber(raw)).toBeNull();
  });

  it('accepts zero and decimals by default', () => {
    expect([parseNumber('0'), parseNumber(' 2.5 ')]).toEqual([0, 2.5]);
  });

  it('can require a value above zero, a minimum or a whole number', () => {
    expect([parseNumber('0', { positive: true }), parseNumber('0', { min: 1 }), parseNumber('2.5', { integer: true })]).toEqual([null, null, null]);
  });

  it('caps at the maximum', () => {
    expect(parseNumber('99', { max: 4 })).toBe(4);
  });
});
