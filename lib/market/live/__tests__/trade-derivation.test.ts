import { describe, it, expect } from 'vitest';
import {
  netDeltasByMint,
  deriveTradeFromDeltas,
  identifyTrader,
  WSOL_MINT,
  type TokenBalanceEntry,
} from '../trade-derivation';

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const BONK = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

const bal = (mint: string, owner: string, uiAmount: number | null): TokenBalanceEntry => ({
  mint,
  owner,
  uiTokenAmount: { uiAmount, decimals: 6 },
});

describe('netDeltasByMint', () => {
  it('nets a swap across both sides of the transaction', () => {
    // Trader gains 1000 BONK, pool loses 1000 BONK. Netting across accounts is
    // what leaves the flow that crossed the transaction boundary.
    const pre = [bal(BONK, 'trader', 0), bal(BONK, 'pool', 5000)];
    const post = [bal(BONK, 'trader', 1000), bal(BONK, 'pool', 4000)];

    const deltas = netDeltasByMint(pre, post);
    expect(deltas.get(BONK)).toBe(0);
  });

  it('reports a one-sided flow when only one account is in scope', () => {
    const deltas = netDeltasByMint([bal(BONK, 'trader', 0)], [bal(BONK, 'trader', 1000)]);
    expect(deltas.get(BONK)).toBe(1000);
  });

  it('ignores entries with a null or missing uiAmount rather than reading them as zero', () => {
    // A null balance is unknown. Treating it as 0 would invent a delta equal to
    // the whole of the other side.
    const deltas = netDeltasByMint([bal(BONK, 'trader', null)], [bal(BONK, 'trader', 1000)]);
    expect(deltas.get(BONK)).toBe(1000);

    const noMint = netDeltasByMint([], [{ uiTokenAmount: { uiAmount: 5 } }]);
    expect(noMint.size).toBe(0);
  });
});

describe('deriveTradeFromDeltas', () => {
  it('picks the non-quote token as the subject and prices it off a stablecoin leg', () => {
    const deltas = new Map([
      [BONK, 2_000],
      [USDC, -50],
    ]);

    const trade = deriveTradeFromDeltas(deltas, 100);
    expect(trade).not.toBeNull();
    expect(trade!.mint).toBe(BONK);
    expect(trade!.tokenAmount).toBe(2_000);
    expect(trade!.isBuy).toBe(true);
    expect(Number(trade!.volumeUsd)).toBe(50);
    // 50 USDC for 2000 BONK => 0.025 each.
    expect(Number(trade!.priceUsd)).toBeCloseTo(0.025, 12);
  });

  it('prices a SOL-paired trade using the measured SOL price', () => {
    const deltas = new Map([
      [BONK, 1_000],
      [WSOL_MINT, -2],
    ]);

    const trade = deriveTradeFromDeltas(deltas, 94.38);
    expect(Number(trade!.volumeUsd)).toBeCloseTo(188.76, 6);
    expect(Number(trade!.priceUsd)).toBeCloseTo(0.18876, 12);
  });

  it('still emits the trade, without USD fields, when SOL price is unknown', () => {
    // An unpriced trade is a real event. Pricing it at zero would not be.
    const deltas = new Map([
      [BONK, 1_000],
      [WSOL_MINT, -2],
    ]);

    const trade = deriveTradeFromDeltas(deltas, null);
    expect(trade).not.toBeNull();
    expect(trade!.mint).toBe(BONK);
    expect(trade!.volumeUsd).toBeUndefined();
    expect(trade!.priceUsd).toBeUndefined();
  });

  it('marks a sell when the subject token flows out', () => {
    const deltas = new Map([
      [BONK, -750],
      [WSOL_MINT, 1],
    ]);

    const trade = deriveTradeFromDeltas(deltas, 100);
    expect(trade!.isBuy).toBe(false);
    expect(trade!.tokenAmount).toBe(750);
  });

  it('returns null when every leg is a quote asset', () => {
    // A USDC/SOL route has no subject token; calling it a trade in USDC would
    // put a stablecoin in the feed as if it were the traded asset.
    const deltas = new Map([
      [USDC, -100],
      [WSOL_MINT, 1],
    ]);

    expect(deriveTradeFromDeltas(deltas, 100)).toBeNull();
  });

  it('returns null when there is no movement at all', () => {
    expect(deriveTradeFromDeltas(new Map(), 100)).toBeNull();
    expect(deriveTradeFromDeltas(new Map([[BONK, 0]]), 100)).toBeNull();
  });

  it('chooses the larger movement when several non-quote tokens move', () => {
    const other = 'So1aNaOtherMint111111111111111111111111111';
    const deltas = new Map([
      [BONK, 100],
      [other, -9_000],
      [WSOL_MINT, -1],
    ]);

    expect(deriveTradeFromDeltas(deltas, 100)!.mint).toBe(other);
  });

  it('prefers the stablecoin leg over the SOL leg for pricing', () => {
    // Both legs present (a routed swap). The stablecoin is a direct USD
    // measurement; the SOL leg needs a price that could itself be stale.
    const deltas = new Map([
      [BONK, 1_000],
      [USDC, -40],
      [WSOL_MINT, -5],
    ]);

    expect(Number(deriveTradeFromDeltas(deltas, 100)!.volumeUsd)).toBe(40);
  });
});

describe('identifyTrader', () => {
  it('prefers the fee payer', () => {
    // The first account key signed and paid, so on a swap it is the trader.
    expect(
      identifyTrader({ accountKeys: [{ pubkey: 'FeePayer111', signer: true }, { pubkey: 'Other' }] }, ['OwnerA']),
    ).toBe('FeePayer111');
  });

  it('accepts a plain string account key', () => {
    // Some nodes return bare strings rather than objects.
    expect(identifyTrader({ accountKeys: ['FeePayer222'] }, [])).toBe('FeePayer222');
  });

  it('falls back to a balance owner when the transaction section is absent', () => {
    expect(identifyTrader(undefined, [undefined, 'OwnerB'])).toBe('OwnerB');
  });

  it('returns undefined when nothing identifies the trader', () => {
    // A placeholder address would be worse than an empty tape — it would make
    // an unrelated wallet look like it traded.
    expect(identifyTrader(undefined, [])).toBeUndefined();
    expect(identifyTrader({ accountKeys: [] }, [undefined])).toBeUndefined();
  });
});

describe('deriveTradeFromDeltas — wallet', () => {
  const BONK_M = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

  it('carries the wallet when one was identified', () => {
    const deltas = new Map([[BONK_M, 1000], [WSOL_MINT, -2]]);
    expect(deriveTradeFromDeltas(deltas, 100, 'Trader111')?.wallet).toBe('Trader111');
  });

  it('omits the wallet entirely when unknown', () => {
    const deltas = new Map([[BONK_M, 1000], [WSOL_MINT, -2]]);
    const trade = deriveTradeFromDeltas(deltas, 100);
    expect(trade).not.toBeNull();
    expect('wallet' in trade!).toBe(false);
  });
});
