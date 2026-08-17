import { describe, expect, it } from 'vitest';
import { toDecimalString, percentToDecimalString, DecimalInputError } from '../decimal-input';

/** The exact regex `POST /api/v1/orders` validates these strings against. */
const API_DECIMAL = /^\d+(\.\d+)?$/;

describe('toDecimalString', () => {
  it('passes plain decimals through unchanged', () => {
    expect(toDecimalString('0.5')).toBe('0.5');
    expect(toDecimalString('1234.567890123456789')).toBe('1234.567890123456789');
  });

  it('preserves precision a float would destroy', () => {
    // The reason the API takes strings at all.
    const exact = '1234.567890123456789';
    expect(toDecimalString(exact)).toBe(exact);
    expect(String(Number(exact))).not.toBe(exact);
  });

  it('adds the leading digit the regex requires', () => {
    expect(toDecimalString('.5')).toBe('0.5');
  });

  it('drops a trailing decimal point left mid-typing', () => {
    expect(toDecimalString('5.')).toBe('5');
  });

  it('trims surrounding whitespace and a leading plus', () => {
    expect(toDecimalString('  2.5 ')).toBe('2.5');
    expect(toDecimalString('+2.5')).toBe('2.5');
  });

  it('rejects a negative amount', () => {
    expect(() => toDecimalString('-1')).toThrow(DecimalInputError);
  });

  it('rejects empty and non-numeric input', () => {
    expect(() => toDecimalString('')).toThrow(DecimalInputError);
    expect(() => toDecimalString('   ')).toThrow(DecimalInputError);
    expect(() => toDecimalString('abc')).toThrow(DecimalInputError);
    expect(() => toDecimalString('1,5')).toThrow(DecimalInputError);
  });

  it('rejects exponent notation the endpoint would refuse', () => {
    expect(() => toDecimalString('1e-7')).toThrow(DecimalInputError);
  });

  it('converts a small number without producing exponent notation', () => {
    // String(1e-7) is "1e-7", which fails the API regex.
    const out = toDecimalString(0.0000001);
    expect(out).toMatch(API_DECIMAL);
    expect(Number(out)).toBeCloseTo(0.0000001, 12);
  });

  it('rejects non-finite numbers', () => {
    expect(() => toDecimalString(NaN)).toThrow(DecimalInputError);
    expect(() => toDecimalString(Infinity)).toThrow(DecimalInputError);
  });

  it('always returns something the API regex accepts', () => {
    for (const v of ['0.5', '.25', '10', '1234.5678', '  7  ', '+3.1']) {
      expect(toDecimalString(v)).toMatch(API_DECIMAL);
    }
  });
});

describe('percentToDecimalString', () => {
  it('converts whole percents', () => {
    expect(percentToDecimalString('1')).toBe('0.01');
    expect(percentToDecimalString('100')).toBe('1');
    expect(percentToDecimalString('50')).toBe('0.5');
  });

  it('converts the slippage values the trade form offers', () => {
    expect(percentToDecimalString('0.5')).toBe('0.005');
    expect(percentToDecimalString('1.0')).toBe('0.01');
    expect(percentToDecimalString('2.5')).toBe('0.025');
  });

  it('avoids binary floating-point artefacts', () => {
    // Dividing by 100 in floating point does not give the decimal answer:
    // 1.1/100 is 0.011000000000000001 and 0.7/100 is 0.006999999999999999.
    // Both are 19 significant characters of noise in a NUMERIC column.
    expect(percentToDecimalString('1.1')).toBe('0.011');
    expect(String(1.1 / 100)).toBe('0.011000000000000001');

    expect(percentToDecimalString('0.7')).toBe('0.007');
    expect(String(0.7 / 100)).toBe('0.006999999999999999');
  });

  it('never emits exponent notation for small percentages', () => {
    const out = percentToDecimalString('0.00001');
    expect(out).toMatch(API_DECIMAL);
    expect(out).toBe('0.0000001');
  });

  it('handles zero', () => {
    expect(percentToDecimalString('0')).toBe('0');
  });

  it('always returns something the API regex accepts', () => {
    for (const v of ['0', '0.01', '0.5', '1', '1.0', '2.5', '15', '100']) {
      expect(percentToDecimalString(v)).toMatch(API_DECIMAL);
    }
  });

  it('round-trips to the expected numeric value', () => {
    for (const v of ['0.5', '1', '2.5', '15']) {
      expect(Number(percentToDecimalString(v))).toBeCloseTo(Number(v) / 100, 12);
    }
  });

  it('rejects a negative percentage', () => {
    expect(() => percentToDecimalString('-1')).toThrow(DecimalInputError);
  });
});
