import { describe, expect, it } from 'vitest';
import { measuredTradeUsd, mergeTradeTape, type TapeTrade } from '../trade-tape';

const base: TapeTrade = { signature: 'sig-1', mint: 'Mint-1', wallet: null, side: 'BUY',
  amountUsd: 20, amountSol: null, amountTokens: 100, priceUsd: 0.2,
  timestamp: '2026-09-24T00:00:00.000Z', isMev: false, source: 'jupiter' };

describe('trade tape merge', () => {
  it('does not label a token quantity as USD when unit price is unavailable', () => {
    expect(measuredTradeUsd(100, null)).toBeNull();
    expect(measuredTradeUsd(100, 0.2)).toBe(20);
    expect(measuredTradeUsd(0, 0.2)).toBe(0);
    expect(measuredTradeUsd('', 0.2)).toBeNull();
  });
  it('keeps a buy and a sell from the same transaction distinct', () => {
    const rows = mergeTradeTape([base, { ...base, side: 'SELL' }], []);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map(row => row.eventId)).size).toBe(2);
  });

  it('replaces a history aggregate with two proven fills without duplicating its amount', () => {
    const rows = mergeTradeTape([base], [
      { ...base, eventId: 'solana:sig-1:Mint-1:BUY:outer-1', amountTokens: null, source: 'stream' },
      { ...base, eventId: 'solana:sig-1:Mint-1:BUY:outer-2', amountTokens: null, source: 'stream' },
    ]);
    expect(rows.map(row => row.eventId)).toEqual([
      'solana:sig-1:Mint-1:BUY:outer-1', 'solana:sig-1:Mint-1:BUY:outer-2',
    ]);
    expect(rows.every(row => row.amountTokens === null)).toBe(true);
  });

  it('fills missing values on the single aggregate without emitting a duplicate', () => {
    const rows = mergeTradeTape([base], [{ ...base, amountTokens: null, wallet: 'measured', source: 'stream' }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ wallet: 'measured', amountTokens: 100, source: 'stream' });
  });
});
