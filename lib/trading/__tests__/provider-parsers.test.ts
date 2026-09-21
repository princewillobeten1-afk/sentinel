import { describe, expect, it } from 'vitest';
import { parseFunding } from '../sidebar-enrichment';
import { parseLiquidityLock } from '../rugcheck-liquidity';
import { parseWalletPnl } from '../wallet-position';

const wallet = '11111111111111111111111111111111';
const mint = 'So11111111111111111111111111111111111111112';

describe('trade sidebar provider parsers', () => {
  it('binds wallet PnL to the requested wallet, mint and USD response', () => {
    const body = { success: true, data: { meta: { address: wallet, currency: 'USD' }, tokens: {
      [mint]: { cashflow_usd: { total_invested: 10, total_sold: 4, current_value: 8 }, pnl: { total_usd: 2 } },
    } } };
    expect(parseWalletPnl(body, wallet, mint)).toEqual({ boughtUsd: 10, soldUsd: 4, holdingUsd: 8, pnlUsd: 2 });
    expect(parseWalletPnl(body, 'Vote111111111111111111111111111111111111111', mint)).toBeNull();
    expect(parseWalletPnl({ ...body, data: { ...body.data, meta: { ...body.data.meta, currency: 'SOL' } } }, wallet, mint)).toBeNull();
  });

  it('accepts only a verifiable SOL funding record', () => {
    const record = { funder: wallet, amount: 1.25, mint, signature: '2'.repeat(64), timestamp: 1_700_000_000 };
    expect(parseFunding(record)).toMatchObject({ address: wallet, amountSol: 1.25, signature: record.signature });
    expect(parseFunding({ ...record, mint: wallet })).toBeNull();
    expect(parseFunding({ ...record, signature: 'not-a-signature' })).toBeNull();
  });

  it('uses the deepest pool LP lock and leaves missing lock data unknown', () => {
    expect(parseLiquidityLock({ markets: [
      { lp: { lpLockedPct: 80, baseUSD: 10, quoteUSD: 10 } },
      { lp: { lpLockedPct: 35, baseUSD: 500, quoteUSD: 500 } },
    ] })).toBe(35);
    expect(parseLiquidityLock({ markets: [{ lp: {} }] })).toBeNull();
  });
});
