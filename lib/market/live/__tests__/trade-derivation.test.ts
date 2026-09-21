import { describe, it, expect } from 'vitest';
import {
  netDeltasByMint,
  traderDeltasByMint,
  nativeSolDeltas,
  pickTrader,
  isCreationTransaction,
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
  it('cancels to zero over both sides of a swap — which is why it is not used on one', () => {
    // Trader gains 1000 BONK, pool loses 1000 BONK. Summed over the whole
    // transaction the legs cancel. This was the enricher's input, and it is
    // what priced real trades at a residue: see `traderDeltasByMint`.
    const pre = [bal(BONK, 'trader', 0), bal(BONK, 'pool', 5000)];
    const post = [bal(BONK, 'trader', 1000), bal(BONK, 'pool', 4000)];

    expect(netDeltasByMint(pre, post).get(BONK)).toBe(0);
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

describe('traderDeltasByMint', () => {
  it("keeps the trader's side of a swap instead of cancelling it", () => {
    const pre = [bal(BONK, 'trader', 0), bal(BONK, 'pool', 5000)];
    const post = [bal(BONK, 'trader', 1000), bal(BONK, 'pool', 4000)];
    expect(traderDeltasByMint(pre, post, 'trader').get(BONK)).toBe(1000);
  });

  it('ignores accounts the trader does not own', () => {
    const deltas = traderDeltasByMint([bal(BONK, 'pool', 10)], [bal(BONK, 'pool', 0)], 'trader');
    expect(deltas.size).toBe(0);
  });
});

describe('nativeSolDeltas', () => {
  it("reports every account's lamport change in SOL, except the trader's", () => {
    const deltas = nativeSolDeltas(
      [{ pubkey: 'trader' }, { pubkey: 'curve' }, 'feeRecipient'],
      [5_000_000_000, 1_000_000_000, 0],
      [3_970_000_000, 3_000_000_000, 20_000_000],
      'trader',
    );
    expect(deltas.has('trader')).toBe(false);
    expect(deltas.get('curve')).toBeCloseTo(2, 9);
    expect(deltas.get('feeRecipient')).toBeCloseTo(0.02, 9);
  });

  it('returns nothing when balances are missing', () => {
    expect(nativeSolDeltas(undefined, [1], [2], 'trader').size).toBe(0);
    expect(nativeSolDeltas(['a'], undefined, [2], 'trader').size).toBe(0);
  });
});

describe('deriveTradeFromDeltas — real swap shapes', () => {
  const FISH = '3j5JjNkpuzKcwq28W2rJeRGKsYPPDdZTTpe2BTu8HWL6';
  const TRADER = '8javGTLj9odD4U2AvEKwU236zGcGtq8VBw8WySFNLcHX';
  const POOL = 'FhVo3mPoolOwner11111111111111111111111111111';

  it('prices the sell that was reported at $165,473 correctly', () => {
    // Mainnet signature yEA74MZS…: the trader sold 21,412.383699 FISH into a
    // Meteora DBC pool and was paid 0.019796602 SOL, natively. The pool's wSOL
    // vault is the only place the SOL leg shows. At SOL $99.67 the true price
    // is ~$0.0000921 and the trade ~$1.97.
    const pre = [bal(FISH, TRADER, 21_412.383699), bal(FISH, POOL, 1_000_000)];
    const post = [bal(FISH, TRADER, 0), bal(FISH, POOL, 1_021_412.383699)];

    const deltas = traderDeltasByMint(pre, post, TRADER);
    const counterparty = nativeSolDeltas(
      [TRADER, 'poolWsolVault', 'protocolFee'],
      [1_000_000_000, 50_000_000_000, 0],
      [1_019_796_602, 49_980_203_398, 0],
      TRADER,
    );

    const trade = deriveTradeFromDeltas(deltas, 99.67, TRADER, counterparty)!;
    expect(trade.isBuy).toBe(false);
    expect(trade.tokenAmount).toBeCloseTo(21_412.383699, 6);
    expect(Number(trade.volumeUsd)).toBeCloseTo(1.9731, 3);
    expect(Number(trade.priceUsd)).toBeCloseTo(0.0000921, 6);
  });

  it('reads a pump.fun buy off the curve, not off the fee or tip', () => {
    // The trader pays 1 SOL into the curve; a fee recipient and a tip account
    // also gain SOL. The curve's gain is the trade.
    const deltas = new Map([[BONK, 35_000]]);
    const counterparty = new Map([
      ['curve', 1.0],
      ['feeRecipient', 0.01],
      ['jitoTip', 0.001],
    ]);
    const trade = deriveTradeFromDeltas(deltas, 100, 'trader', counterparty)!;
    expect(Number(trade.volumeUsd)).toBeCloseTo(100, 6);
    expect(Number(trade.priceUsd)).toBeCloseTo(100 / 35_000, 12);
  });

  it('reads a sell off the account that paid out, not the fee that was paid in', () => {
    // On a sell the pool loses SOL while fee accounts still gain it. A larger
    // fee-side gain must not be mistaken for the trade.
    const deltas = new Map([[BONK, -10_000]]);
    const counterparty = new Map([
      ['poolVault', -0.5],
      ['bigFeeSink', 0.8],
    ]);
    const trade = deriveTradeFromDeltas(deltas, 100, 'trader', counterparty)!;
    expect(Number(trade.volumeUsd)).toBeCloseTo(50, 6);
  });

  it("falls back to the trader's wSOL leg when no counterparty moved SOL", () => {
    const deltas = new Map([
      [BONK, 1_000],
      [WSOL_MINT, -2],
    ]);
    const trade = deriveTradeFromDeltas(deltas, 100, 'trader', new Map())!;
    expect(Number(trade.volumeUsd)).toBeCloseTo(200, 6);
  });

  it('emits the trade unpriced when no SOL leg is visible anywhere', () => {
    const trade = deriveTradeFromDeltas(new Map([[BONK, 1_000]]), 100, 'trader', new Map())!;
    expect(trade).not.toBeNull();
    expect(trade.priceUsd).toBeUndefined();
  });
});

describe('pickTrader', () => {
  const TOKEN = 'DQrj44SiTiMxpDUdRJBx219oTpWTHpHfmVFbAAxvpump';

  it('is the fee payer on an ordinary swap', () => {
    const keys = [{ pubkey: 'user', signer: true }, { pubkey: 'curve', signer: false }];
    const pre = [bal(TOKEN, 'user', 0), bal(TOKEN, 'curve', 5000)];
    const post = [bal(TOKEN, 'user', 1000), bal(TOKEN, 'curve', 4000)];
    expect(pickTrader(keys, pre, post)).toBe('user');
  });

  it('skips a relayer fee payer that holds none of the token', () => {
    // The relayer paid the fee; the user signed and received the tokens. Taking
    // the fee payer left the deltas empty and the trade was dropped.
    const keys = [
      { pubkey: 'relayer', signer: true },
      { pubkey: 'user', signer: true },
      { pubkey: 'curve', signer: false },
    ];
    const pre = [bal(TOKEN, 'user', 0), bal(TOKEN, 'curve', 5000)];
    const post = [bal(TOKEN, 'user', 1000), bal(TOKEN, 'curve', 4000)];
    expect(pickTrader(keys, pre, post)).toBe('user');
  });

  it('never picks a non-signer, even one whose balance moved most', () => {
    // The pool's account always moves by as much as the trader's. It cannot
    // sign, so it can never be taken for the trader.
    const keys = [{ pubkey: 'relayer', signer: true }, { pubkey: 'curve', signer: false }];
    const pre = [bal(TOKEN, 'someoneElse', 0), bal(TOKEN, 'curve', 5000)];
    const post = [bal(TOKEN, 'someoneElse', 1000), bal(TOKEN, 'curve', 4000)];
    expect(pickTrader(keys, pre, post)).toBeUndefined();
  });

  it('ignores a signer that only moved a quote asset', () => {
    const keys = [{ pubkey: 'router', signer: true }, { pubkey: 'user', signer: true }];
    const pre = [bal(WSOL_MINT, 'router', 5), bal(TOKEN, 'user', 0)];
    const post = [bal(WSOL_MINT, 'router', 0), bal(TOKEN, 'user', 700)];
    expect(pickTrader(keys, pre, post)).toBe('user');
  });

  it('treats only the first bare-string key as a signer', () => {
    const pre = [bal(TOKEN, 'first', 0)];
    const post = [bal(TOKEN, 'first', 10)];
    expect(pickTrader(['first', 'second'], pre, post)).toBe('first');
    expect(pickTrader(['other', 'first'], pre, post)).toBeUndefined();
  });
});

describe('isCreationTransaction', () => {
  it('recognises a pump.fun launch-and-buy', () => {
    expect(isCreationTransaction([
      'Program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P invoke [1]',
      'Program log: Instruction: CreateV2',
      'Program log: Instruction: Buy',
    ])).toBe(true);
  });

  it('recognises the older create and a pool creation', () => {
    expect(isCreationTransaction(['Program log: Instruction: Create'])).toBe(true);
    expect(isCreationTransaction(['Program log: Instruction: CreatePool'])).toBe(true);
  });

  it('does not mistake an ordinary swap that opens a token account for a launch', () => {
    // Buying into a token for the first time creates an associated token
    // account; that is not a launch and the trade must stay priced.
    expect(isCreationTransaction([
      'Program log: CreateIdempotent',
      'Program log: Instruction: InitializeAccount3',
      'Program log: Instruction: Buy',
    ])).toBe(false);
  });

  it('handles missing logs', () => {
    expect(isCreationTransaction(undefined)).toBe(false);
    expect(isCreationTransaction([])).toBe(false);
  });
});
