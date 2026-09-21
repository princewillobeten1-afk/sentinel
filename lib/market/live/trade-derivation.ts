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
  /** SOL side of the trade when the counter-leg was native/wrapped SOL. */
  amountSol?: number;
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

/** Log lines of the instructions that create the pair a transaction then trades in. */
const CREATION_LOG_LINES = new Set([
  'Program log: Instruction: Create',
  'Program log: Instruction: CreateV2',
  'Program log: Instruction: CreatePool',
]);

/**
 * Whether a transaction creates the pair it trades in.
 *
 * A pump.fun launch and its first buy are one transaction, and its SOL flows
 * are not a price. The bonding-curve account is created in the same
 * transaction, so its lamport gain includes its own rent-exempt deposit —
 * measured on a real CreateV2 buy: 0.031226 SOL into the curve for a trade
 * pump.fun's own TradeEvent records as 0.029630. Another launch's TradeEvent
 * recorded `sol_amount` 0 for the creator's initial 21.99M tokens.
 *
 * Matched on the exact Anchor instruction line, so an associated-token
 * program's "CreateIdempotent" or a metadata initialiser does not count.
 */
export function isCreationTransaction(logs: string[] | undefined): boolean {
  return (logs ?? []).some((line) => CREATION_LOG_LINES.has(line.trim()));
}

/**
 * Picks the wallet whose side of the swap is visible in the balances.
 *
 * The fee payer is the trader on an ordinary swap. It is not when a relayer or
 * trading bot pays the fee on the user's behalf: the fee payer then holds none
 * of the traded token, its deltas are empty, and the trade was dropped —
 * measured against pump.fun's own TradeEvents, 4 of 24 real trades vanished
 * this way. A user must sign to move tokens they own, so the first signer that
 * actually holds a changed non-quote balance is the trader.
 *
 * Returns undefined when no signer qualifies. The caller skips the trade:
 * without the trader's side, the two legs cannot be told apart.
 */
export function pickTrader(
  accountKeys: Array<{ pubkey?: string; signer?: boolean } | string> | undefined,
  pre: TokenBalanceEntry[],
  post: TokenBalanceEntry[],
): string | undefined {
  const signers: string[] = [];
  (accountKeys ?? []).forEach((key, index) => {
    const pubkey = typeof key === 'string' ? key : key?.pubkey;
    // A bare-string key list carries no signer flags; only the fee payer (the
    // first key) is known to have signed.
    const signed = typeof key === 'string' ? index === 0 : (key?.signer ?? index === 0);
    if (pubkey && signed) signers.push(pubkey);
  });

  for (const signer of signers) {
    for (const [mint, delta] of traderDeltasByMint(pre, post, signer)) {
      if (delta !== 0 && mint !== WSOL_MINT && !STABLE_MINTS.has(mint)) return signer;
    }
  }
  return undefined;
}

/**
 * Each mint's balance change across the accounts one wallet owns.
 *
 * ## Why not net the whole transaction
 *
 * This used to sum every account's change, on the premise that netting leaves
 * "the flow that crossed the transaction boundary, which is the trade itself".
 * In a swap nothing crosses the boundary: the token moves from the trader's
 * account into the pool's *within* the transaction, so the two sides cancel and
 * the token leg nets to a rounding residue — measured on a real sell, 21,412.38
 * tokens out and 21,412.38 in left about 6e-8. The SOL leg survived only because
 * the trader was paid in native SOL, which token balances never show. Dividing
 * a real dollar amount by that residue priced a $1.97 trade at over $165,000 a
 * token, and a $0.25 buy at $4.1M.
 *
 * Scoping to the trader's own accounts keeps the side of the swap that is
 * actually theirs.
 */
export function traderDeltasByMint(
  pre: TokenBalanceEntry[],
  post: TokenBalanceEntry[],
  trader: string,
): Map<string, number> {
  const mine = (entry: TokenBalanceEntry) => entry.owner === trader;
  return netDeltasByMint(pre.filter(mine), post.filter(mine));
}

/**
 * Sums each mint's balance change across the given entries.
 *
 * Only meaningful over one side of a trade — see `traderDeltasByMint`. Over a
 * whole swap transaction the two sides cancel.
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
 * Native SOL movement on every account except the trader's, in SOL.
 *
 * This is where the SOL leg of a swap is visible. A pump.fun bonding curve
 * holds native SOL, and an AMM's wSOL vault is a token account whose lamports
 * track its wrapped balance — so either venue's side of the trade shows here as
 * a lamport change. The trader's own account is excluded: its change mixes the
 * trade with the network fee, rent for new accounts and any tip.
 */
export function nativeSolDeltas(
  accountKeys: Array<{ pubkey?: string } | string> | undefined,
  preBalances: number[] | undefined,
  postBalances: number[] | undefined,
  trader: string,
): Map<string, number> {
  const out = new Map<string, number>();
  if (!accountKeys || !preBalances || !postBalances) return out;

  accountKeys.forEach((key, index) => {
    const pubkey = typeof key === 'string' ? key : key?.pubkey;
    if (!pubkey || pubkey === trader) return;
    const pre = preBalances[index];
    const post = postBalances[index];
    if (typeof pre !== 'number' || typeof post !== 'number') return;
    const delta = (post - pre) / 1e9;
    if (delta !== 0) out.set(pubkey, delta);
  });
  return out;
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
  /** The trader's own per-mint deltas — see `traderDeltasByMint`. */
  deltas: Map<string, number>,
  solPriceUsd: number | null,
  /** Identified trading wallet, when known. Threaded through unchanged. */
  wallet?: string,
  /**
   * Native SOL deltas on every other account — see `nativeSolDeltas`. When
   * given, the SOL leg is read from the counterparty, which is exact; the
   * trader's own wSOL delta is only the fallback.
   */
  counterpartySol?: Map<string, number>,
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
  const isBuy = subjectDelta > 0;

  const solMoved = counterpartySolMoved(counterpartySol, isBuy) ?? Math.abs(deltas.get(WSOL_MINT) ?? 0);
  if (volumeUsd === null && solPriceUsd !== null && solPriceUsd > 0) {
    if (solMoved > 0) volumeUsd = solMoved * solPriceUsd;
  }

  const tokenAmount = Math.abs(subjectDelta);
  const result: EnrichedTrade = {
    mint: subjectMint,
    tokenAmount,
    ...(wallet ? { wallet } : {}),
    // The subject token flowing into the trader's accounts means they bought.
    isBuy,
    ...(solMoved > 0 ? { amountSol: solMoved } : {}),
  };

  if (volumeUsd !== null && volumeUsd > 0) {
    result.volumeUsd = volumeUsd.toFixed(6);
    if (tokenAmount > 0) result.priceUsd = (volumeUsd / tokenAmount).toFixed(18);
  }

  return result;
}

/**
 * The SOL the counterparty moved, read from the largest lamport change in the
 * direction the swap implies.
 *
 * On a buy the trader pays, so the pool or curve *gains* SOL; on a sell it pays
 * out, so it *loses* SOL. Taking only that direction matters: fee and tip
 * accounts gain SOL on every trade, and on a sell they move opposite to the
 * pool, so they cannot be mistaken for it. On a buy they are much smaller than
 * the amount the pool receives.
 */
function counterpartySolMoved(counterpartySol: Map<string, number> | undefined, isBuy: boolean): number | null {
  if (!counterpartySol) return null;
  let best = 0;
  for (const delta of counterpartySol.values()) {
    if (isBuy ? delta > 0 : delta < 0) best = Math.max(best, Math.abs(delta));
  }
  return best > 0 ? best : null;
}
