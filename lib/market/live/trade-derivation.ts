/**
 * Pure trade-derivation maths for the parsed-transaction enricher.
 *
 * Split out of `transaction-enricher.ts` because that file carries
 * `import 'server-only'`, which throws outside Next's bundler and so cannot be
 * unit-tested directly. Everything here is a pure function over plain data and
 * is covered by `__tests__/trade-derivation.test.ts`.
 */

/** Wrapped SOL — the counter-asset in most Solana pairs. */
export const WSOL_MINT = 'So11111111111111111111111111111111111111112';

/** Stablecoins whose balance delta is already a USD amount. */
export const STABLE_MINTS = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
]);

export interface TokenBalanceEntry {
  mint?: string;
  owner?: string;
  uiTokenAmount?: { uiAmount?: number | null; amount?: string; decimals?: number };
  accountIndex?: number;
}

export interface EnrichedTrade {
  mint: string;
  /** Absolute token amount that moved, in UI units. */
  tokenAmount: number;
  /** USD value of the trade, when the counter-leg could be priced. */
  volumeUsd?: string;
  /** Implied unit price, when both legs are known. */
  priceUsd?: string;
  /** True when the subject token's balance rose (a buy of that token). */
  isBuy: boolean;
  /**
   * The trading wallet, when it could be identified.
   *
   * `realtime_trades` accumulated 22,253 real captures with **zero** wallets,
   * because nothing threaded one through — which left the top-traders endpoint
   * grouping by a column that was always null. Undefined stays undefined; a
   * placeholder address would be worse than an empty tape.
   */
  wallet?: string;
}

/** The parts of a parsed transaction needed to identify the trader. */
export interface TransactionIdentity {
  /**
   * Account keys from `transaction.message`. The first is the fee payer, which
   * on a swap is the trader. This costs nothing extra to obtain: the enricher
   * already fetches the whole jsonParsed transaction and reads only `meta`.
   */
  accountKeys?: Array<{ pubkey?: string; signer?: boolean } | string>;
}

/**
 * Identifies the trading wallet.
 *
 * Prefers the fee payer — the first account key, and the account that signed
 * and paid — because it is unambiguous. Falls back to the owner recorded on the
 * subject mint's balance entries when the transaction section is absent, which
 * is a weaker signal: a swap touches both the trader's and the pool's accounts,
 * so it is only used when the fee payer is unavailable.
 */
export function identifyTrader(
  identity: TransactionIdentity | undefined,
  subjectOwners: Array<string | undefined>,
): string | undefined {
  const first = identity?.accountKeys?.[0];
  const feePayer = typeof first === 'string' ? first : first?.pubkey;
  if (feePayer) return feePayer;

  return subjectOwners.find((owner): owner is string => Boolean(owner));
}

/**
 * Nets each mint's balance change across the whole transaction.
 *
 * Summing across every account is deliberate: a swap moves the token out of
 * the pool's account and into the trader's. Tracking a single account would
 * see only one side; netting across the transaction leaves the flow that
 * crossed its boundary, which is the trade itself.
 */
export function netDeltasByMint(
  pre: TokenBalanceEntry[],
  post: TokenBalanceEntry[],
): Map<string, number> {
  const totals = new Map<string, number>();

  const add = (entry: TokenBalanceEntry, sign: 1 | -1) => {
    const mint = entry.mint;
    const amount = entry.uiTokenAmount?.uiAmount;
    if (!mint || typeof amount !== 'number' || !Number.isFinite(amount)) return;
    totals.set(mint, (totals.get(mint) ?? 0) + sign * amount);
  };

  for (const entry of post) add(entry, 1);
  for (const entry of pre) add(entry, -1);

  return totals;
}

/**
 * Picks the traded token and prices it from the counter-leg.
 *
 * The subject is the largest non-quote movement: a SOL or USDC leg is what the
 * token was bought *with*, not what was traded. When every leg is a quote asset
 * there is no subject token, and the transaction is skipped rather than
 * reported as a trade in USDC.
 *
 * `volumeUsd` and `priceUsd` are omitted entirely when no leg can be priced —
 * an unpriced trade is still a real event worth emitting, but pricing it at
 * zero would be a fabrication.
 */
export function deriveTradeFromDeltas(
  deltas: Map<string, number>,
  solPriceUsd: number | null,
  /** Identified trading wallet, when known. Threaded through unchanged. */
  wallet?: string,
): EnrichedTrade | null {
  let subjectMint: string | null = null;
  let subjectDelta = 0;

  for (const [mint, delta] of deltas) {
    if (mint === WSOL_MINT || STABLE_MINTS.has(mint)) continue;
    if (Math.abs(delta) > Math.abs(subjectDelta)) {
      subjectMint = mint;
      subjectDelta = delta;
    }
  }

  if (!subjectMint || subjectDelta === 0) return null;

  let volumeUsd: number | null = null;
  for (const [mint, delta] of deltas) {
    if (STABLE_MINTS.has(mint) && delta !== 0) {
      volumeUsd = Math.abs(delta);
      break;
    }
  }
  if (volumeUsd === null && solPriceUsd !== null && solPriceUsd > 0) {
    const solDelta = deltas.get(WSOL_MINT);
    if (typeof solDelta === 'number' && solDelta !== 0) {
      volumeUsd = Math.abs(solDelta) * solPriceUsd;
    }
  }

  const tokenAmount = Math.abs(subjectDelta);
  const result: EnrichedTrade = {
    mint: subjectMint,
    tokenAmount,
    ...(wallet ? { wallet } : {}),
    // The subject token flowing *in* across the transaction boundary means it
    // was bought out of the pool.
    isBuy: subjectDelta > 0,
  };

  if (volumeUsd !== null && volumeUsd > 0) {
    result.volumeUsd = volumeUsd.toFixed(6);
    if (tokenAmount > 0) result.priceUsd = (volumeUsd / tokenAmount).toFixed(18);
  }

  return result;
}
