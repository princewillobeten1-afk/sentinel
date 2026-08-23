import { describe, expect, it } from 'vitest';
import { Decimal } from '../decimal';

describe('Decimal.toString / toNumber', () => {
  it('round-trips a whole number string', () => {
    expect(new Decimal('10').toString(18)).toBe('10.000000000000000000');
  });

  it('round-trips a fractional number string', () => {
    expect(new Decimal('142.50').toString(2)).toBe('142.50');
  });

  it('toNumber returns the true decimal value, not the raw fixed-point integer', () => {
    // Regression case for the bug this fix addresses: toString(6) used to split
    // on the passed-in `decimals` instead of the fixed internal scale (18),
    // so a Decimal("10") — stored as 10 * 10^18 — misread its last 6 raw
    // digits as the fractional part and produced something on the order of
    // 10^13 instead of 10.
    expect(new Decimal('10').toNumber()).toBe(10);
    expect(new Decimal('1').toNumber()).toBe(1);
    expect(new Decimal('0.4').toNumber()).toBe(0.4);
    expect(new Decimal('50000').toNumber()).toBe(50000);
  });

  it('toString(0) returns just the integer part with no decimal point', () => {
    expect(new Decimal('7.89').toString(0)).toBe('7');
  });

  it('truncates (does not round) when reducing precision', () => {
    expect(new Decimal('1.999999').toString(2)).toBe('1.99');
  });

  it('preserves the sign for negative values', () => {
    const negative = new Decimal('0').sub('5');
    expect(negative.toString(2)).toBe('-5.00');
    expect(negative.toNumber()).toBe(-5);
  });
});

describe('Decimal arithmetic', () => {
  it('adds correctly', () => {
    expect(new Decimal('1.5').add('2.25').toString(2)).toBe('3.75');
  });

  it('subtracts correctly', () => {
    expect(new Decimal('5').sub('1.5').toString(2)).toBe('3.50');
  });

  it('multiplies correctly', () => {
    expect(new Decimal('2').mul('3.5').toString(2)).toBe('7.00');
  });

  it('divides correctly with HALF_UP rounding', () => {
    expect(new Decimal('10').div('4').toString(2)).toBe('2.50');
  });

  it('throws on division by zero', () => {
    expect(() => new Decimal('10').div('0')).toThrow(/[Dd]ivision by zero/);
  });
});

describe('Decimal.toBaseUnits', () => {
  it('converts a token amount to atomic base units', () => {
    expect(Decimal.toBaseUnits('1.5', 9)).toBe(1_500_000_000n);
  });
});

describe('Decimal scientific notation handling', () => {
  it('correctly parses scientific notation from string without BigInt conversion errors', () => {
    const d = new Decimal('3.2618825722274056e-7');
    expect(d.toString(10)).toBe('0.0000003261');
    expect(d.raw).toBe(326188257222n);
  });

  it('handles small numbers passed as float numbers', () => {
    const d = new Decimal(0.0000000326);
    expect(d.toString(8)).toBe('0.00000003');
  });

  it('handles positive exponents', () => {
    const d = new Decimal('1.5e4');
    expect(d.toString(2)).toBe('15000.00');
    expect(d.toNumber()).toBe(15000);
  });

  it('handles negative scientific notation', () => {
    const d = new Decimal('-2.5e-3');
    expect(d.toString(4)).toBe('-0.0025');
  });
});

