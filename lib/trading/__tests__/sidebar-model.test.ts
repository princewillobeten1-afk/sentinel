import { describe, expect, it } from 'vitest';
import { measuredNumber, measuredUsd, summarizePosition } from '../sidebar-model';
import type { MonetaryValue } from '@/lib/portfolio/types';
import type { TradeWalletPosition } from '../sidebar-model';

describe('trade sidebar values', () => {
  it('never converts missing data into zero', () => {
    for (const value of [null, undefined, '', ' ', NaN, Infinity, {}, false]) expect(measuredNumber(value)).toBeNull();
    expect(measuredNumber(0)).toBe(0);
    expect(measuredNumber('0')).toBe(0);
    expect(measuredNumber('12.5')).toBe(12.5);
    expect(measuredUsd({ usd: 0, status: 'UNKNOWN' } as MonetaryValue)).toBeNull();
  });
  it('keeps disconnected positions unknown', () => {
    expect(Object.values(summarizePosition(null))).toEqual([null, null, null, null, null]);
  });
  it('preserves measured wallet position values and measured zeros', () => {
    const position = { quantity: 40, boughtUsd: 25, soldUsd: 0, holdingUsd: 0, pnlUsd: -25 } as TradeWalletPosition;
    expect(summarizePosition(position)).toEqual({quantity: 40, boughtUsd: 25, soldUsd: 0, holdingUsd: 0, pnlUsd: -25});
  });
});
