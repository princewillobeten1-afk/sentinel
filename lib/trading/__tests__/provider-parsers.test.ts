import { describe, expect, it } from 'vitest';
import { parseFunding } from '../sidebar-enrichment';
import { parseLiquidityLock } from '../rugcheck-liquidity';
import { parseWalletPnl } from '../wallet-position';
import { parseTrackerOwnership, parseTrackerWalletPosition } from '../solana-tracker';
import { parseRugcheckOwnership } from '../rugcheck-ownership';

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

  it('maps measured Tracker risk fields without inventing omitted classifications', () => {
    const body = { token: { mint }, holders: 51, risk: {
      top10: 41.5, dev: { percentage: 0 }, snipers: { totalPercentage: 3 },
      insiders: { totalPercentage: 0 },
    } };
    expect(parseTrackerOwnership(mint, body)).toMatchObject({
      top10Pct: 41.5, totalHolders: 51, devPct: 0, snipersPct: 3,
      insidersPct: 0, bundlersPct: null, proTraders: null, source: 'solana-tracker-token-risk',
    });
    expect(parseTrackerOwnership('other', body)).toBeNull();
    expect(parseTrackerOwnership(mint, { token: { mint }, risk: {} })).toBeNull();
  });

  it('binds Tracker position to the requested wallet and token', () => {
    const body = { wallet, token: mint, volume: { buyUsd: 10, sellUsd: 4 },
      current: { value: 8 }, pnl: { total: 2 } };
    expect(parseTrackerWalletPosition(body, wallet, mint)).toEqual({ boughtUsd: 10, soldUsd: 4, holdingUsd: 8, pnlUsd: 2 });
    expect(parseTrackerWalletPosition({ ...body, token: 'other' }, wallet, mint)).toBeNull();
    expect(parseTrackerWalletPosition({ wallet, token: mint }, wallet, mint)).toBeNull();
  });

  it('does not turn a creator missing from Rugcheck top holders into zero holding', () => {
    const body = { mint, creator: wallet, totalHolders: 100,
      topHolders: [{ owner: 'another-wallet', pct: 25, insider: false }, { owner: 'second-wallet', pct: 10, insider: false }] };
    expect(parseRugcheckOwnership(mint, body)).toMatchObject({
      top10Pct: 35, totalHolders: 100, devPct: null, insidersPct: null, snipersPct: null,
    });
    expect(parseRugcheckOwnership('another-mint', body)).toBeNull();
    expect(parseRugcheckOwnership(mint, { ...body, topHolders: [{ owner: 'x', pct: 'invalid' }] })?.top10Pct).toBeNull();
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
