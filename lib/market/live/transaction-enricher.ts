import 'server-only';

import { env } from '@/lib/server/env';
import { logger } from '@/lib/server/logger';
import { dbPool } from '@/lib/server/db/pool';
import { getSolPriceUsd as getCanonicalSolPriceUsd } from '@/lib/market/canonical-price';
import {
  WSOL_MINT,
  traderDeltasByMint,
  nativeSolDeltas,
  deriveTradeFromDeltas,
  pickTrader,
  isCreationTransaction,
  STABLE_MINTS,
  type EnrichedTrade,
  type TokenBalanceEntry,
} from './trade-derivation';
import { createBatcher, type JsonRpcRequest } from './rpc-batch';

/**
 * Recovers the mint and trade size that `logsSubscribe` cannot provide.
 *
 * ## The gap this closes
 *
 * A `logsNotification` carries `{signature, logs}` and nothing else — no
 * instruction data, no accounts, no amounts. `helius-log-matchers.ts` can tell
 * a swap from an add-liquidity by reading the "Program log: Instruction: X"
 * lines, but it cannot say *which token* moved, and it deliberately leaves
 * `mint` undefined rather than guess. `normalizeHeliusLogMatch` then drops
 * every such match (`if (!match.mint) return null`).
 *
 * The net effect before this module: the stream connected, classified swaps,
 * and persisted **zero** of them. `realtime_trades` had not gained a row in a
 * day while the socket sat there reporting itself healthy.
 *
 * ## What actually limits capture
 *
 * One call per match capped the feed at ~144 trades/minute against mainnet DEX
 * volume many times that.
 *
 * Batching looked like the way out — one HTTP request carrying many
 * `getTransaction` calls at the same request rate. **It is not, on this
 * account.** Measured directly against the endpoint with real signatures,
 * 12-second trials:
 *
 *     4 req/s x 1 call    ->  3.7 calls/s ok,   0x 429
 *     8 req/s x 1 call    ->  7.3 calls/s ok,   2x 429   <- best
 *    15 req/s x 1 call    ->  6.1 calls/s ok,  90x 429
 *     2 req/s x 10 calls  ->  2.5 calls/s ok,  21x 429
 *     1 req/s x 25 calls  ->  0.0 calls/s ok,  12x 429
 *
 * Two findings, both counter-intuitive enough to be worth recording so nobody
 * re-attempts this: a burst of calls inside one request trips the limiter far
 * harder than the same calls spread out — 25-call batches succeeded **zero**
 * times — and pushing past ~8 requests/second *lowers* net throughput, because
 * rejected calls still spend budget.
 *
 * So `HELIUS_ENRICH_BATCH` defaults to **1**: one call per request, 8 per
 * second, which measured as this plan's ceiling. The batching machinery in
 * `rpc-batch.ts` is kept because it carries the bounded queue, the backoff and
 * the counters, and because a larger plan may tolerate real batches — but the
 * default is the measured optimum, not the hoped-for one.
 *
 * Raising capture beyond ~8 calls/s therefore needs a larger plan, or spending
 * those calls on signatures likelier to yield a trade (today ~44% of fetched
 * transactions yield none). It does not come from cleverer packaging.
 *
 * Work is still dropped when the buffer saturates, and every drop is counted
 * and reported by `getEnricherStats()` rather than hidden — a feed that
 * quietly samples a fraction of trades while presenting itself as complete is
 * exactly the kind of comforting lie this codebase keeps having to remove.
 */

const RPC_TIMEOUT_MS = 15_000;

function envInt(key: string, fallback: number, min: number, max: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

/**
 * Throughput knobs, tunable without a code change.
 *
 * `HELIUS_ENRICH_RPS` is the request budget (and therefore the spend ceiling);
 * `HELIUS_ENRICH_BATCH` is how many transactions ride along in each request.
 * Capture rate is roughly the product of the two.
 */
const MAX_QUEUE = envInt('HELIUS_ENRICH_QUEUE', 5_000, 10, 100_000);
const MAX_CONCURRENCY = envInt('HELIUS_ENRICH_CONCURRENCY', 4, 1, 64);

/**
 * Credit budget, and the rate that actually fits inside it.
 *
 * The rate ceiling and the *sustainable* rate are different limits, and only
 * the first was modelled here before. Measured: this plan tolerates ~9 calls/s
 * before rejecting. But 8 calls/s sustained is 8 x 86,400 = 691,200 calls/day,
 * which burns a 1,000,000-credit month in **1.4 days** — which is exactly how
 * the previous key reached "max usage reached".
 *
 * `HELIUS_ENRICH_RPS` alone cannot express the fix: as an integer with a floor
 * of 1 its slowest setting is 86,400 calls/day, still 2.6x over a 1M month. So
 * the budget is declared directly and the rate is derived from it:
 *
 *     rate = monthlyCredits / (30 days x hoursРerDay x 3600)
 *
 * `HELIUS_ENRICH_HOURS_PER_DAY` is the duty cycle — a server that only runs
 * during trading hours may spend its budget faster while running. The
 * effective rate is the lower of the budget rate and the configured ceiling,
 * so the ceiling still caps bursts and the budget still caps the month.
 *
 * Set `HELIUS_ENRICH_MONTHLY_CREDITS=0` to disable budget pacing and run at
 * the raw ceiling — appropriate only on a plan whose allowance is effectively
 * unbounded for this workload.
 */
const MONTHLY_CREDITS = envInt('HELIUS_ENRICH_MONTHLY_CREDITS', 1_000_000, 0, 10_000_000_000);
const HOURS_PER_DAY = envInt('HELIUS_ENRICH_HOURS_PER_DAY', 24, 1, 24);
const RATE_CEILING = envInt('HELIUS_ENRICH_RPS', 8, 1, 1_000);

/** Calls per second the monthly allowance actually supports. */
const budgetRps =
  MONTHLY_CREDITS > 0 ? MONTHLY_CREDITS / (30 * HOURS_PER_DAY * 3600) : Number.POSITIVE_INFINITY;

const ENRICH_RPS = Math.min(RATE_CEILING, budgetRps);
// 1 = one call per request, which measured as this plan's ceiling (see the
// trial table above). Raise it only against a plan known to tolerate bursts.
const BATCH_SIZE = envInt('HELIUS_ENRICH_BATCH', 1, 1, 1_000);
const BATCH_WAIT_MS = envInt('HELIUS_ENRICH_BATCH_WAIT_MS', 50, 1, 5_000);
/**
 * Milliseconds of budget per RPC call — the batcher charges one per call.
 * Rounds *up*, so a fractional budget rate never quietly becomes a faster one.
 */
const MIN_INTERVAL_MS = Math.max(1, Math.ceil(1000 / ENRICH_RPS));

/** How long a signature stays remembered for dedup. */
const SEEN_TTL_MS = 120_000;
/** SOL price is re-read from the enrichment table at most this often. */
const SOL_PRICE_TTL_MS = 60_000;

let droppedNoMint = 0;

const seen = new Map<string, number>();

function rememberSignature(signature: string): boolean {
  const now = Date.now();
  // Opportunistic sweep — cheap, and keeps the map from growing without bound
  // on a long-running process.
  if (seen.size > 20_000) {
    for (const [sig, at] of seen) {
      if (now - at > SEEN_TTL_MS) seen.delete(sig);
    }
  }
  const prev = seen.get(signature);
  if (prev !== undefined && now - prev < SEEN_TTL_MS) return false;
  seen.set(signature, now);
  return true;
}

/** Mainnet RPC endpoint for transaction lookups. */
function rpcUrl(): string | null {
  const explicit = process.env.HELIUS_RPC_URL?.trim();
  if (explicit) return explicit;
  const key = env.HELIUS_API_KEY?.trim();
  if (!key) return null;
  return `https://mainnet.helius-rpc.com/?api-key=${key}`;
}

let solPriceUsd: number | null = null;
let solPriceAt = 0;

/**
 * SOL price for pricing enriched trades — a real measurement, refreshed at most
 * once a minute. Returns null when unknown, and the derivation then omits the
 * USD fields entirely rather than pricing a trade at zero.
 *
 * The canonical price source comes first: it is the one every other SOL figure
 * on the site uses, so trade USD values agree with the status bar and the
 * cards. This used to read *only* the `realtime_tokens` table, and with
 * Postgres down (`ECONNREFUSED`) it stayed null permanently — every trade then
 * carried no `priceUsd`, and since `token.price` only fires for a priced event,
 * no live price update reached any card. The table stays as a fallback.
 */
async function getSolPriceUsd(): Promise<number | null> {
  const now = Date.now();
  if (solPriceUsd !== null && now - solPriceAt < SOL_PRICE_TTL_MS) return solPriceUsd;

  try {
    const canonical = await getCanonicalSolPriceUsd();
    if (canonical !== null && Number.isFinite(canonical) && canonical > 0) {
      solPriceUsd = canonical;
      solPriceAt = now;
      return solPriceUsd;
    }
  } catch {
    // Fall through to the table.
  }

  try {
    const { rows } = await dbPool.query<{ price_usd: string | null }>(
      `SELECT price_usd FROM realtime_tokens WHERE mint = $1 AND price_usd IS NOT NULL LIMIT 1`,
      [WSOL_MINT],
    );
    const n = rows[0]?.price_usd ? Number(rows[0].price_usd) : NaN;
    solPriceUsd = Number.isFinite(n) && n > 0 ? n : null;
    solPriceAt = now;
  } catch {
    // Leave the previous value (possibly null) in place; a DB blip must not
    // turn into a fabricated price.
    solPriceAt = now;
  }
  return solPriceUsd;
}

interface TransactionResult {
  meta?: {
    preTokenBalances?: TokenBalanceEntry[];
    postTokenBalances?: TokenBalanceEntry[];
    /** Lamports per account key, before and after. Where the SOL leg shows. */
    preBalances?: number[];
    postBalances?: number[];
    /** Program logs, read only to recognise a launch transaction. */
    logMessages?: string[];
    err?: unknown;
  };
  /**
   * Read purely to identify the trader. Already present in the response this
   * module fetches — only `meta` was being used — so the wallet costs no extra
   * RPC call.
   */
  transaction?: {
    message?: { accountKeys?: Array<{ pubkey?: string; signer?: boolean } | string> };
  };
}

/** Turns one batch slot into a trade, or null when it isn't one. */
async function decodeSlot(result: unknown): Promise<EnrichedTrade | null> {
  const meta = (result as TransactionResult | null)?.meta;
  if (!meta || meta.err) {
    droppedNoMint++;
    return null;
  }

  const parsed = result as TransactionResult | null;
  const wallet = pickTrader(
    parsed?.transaction?.message?.accountKeys,
    meta.preTokenBalances ?? [],
    meta.postTokenBalances ?? [],
  );

  // Without a trader the two sides of the swap cannot be told apart, and
  // netting them together is what produced prices off by nine orders of
  // magnitude. Skip rather than guess.
  if (!wallet) {
    droppedNoMint++;
    return null;
  }

  const deltas = traderDeltasByMint(meta.preTokenBalances ?? [], meta.postTokenBalances ?? [], wallet);
  if (deltas.size === 0) {
    droppedNoMint++;
    return null;
  }

  const counterpartySol = nativeSolDeltas(
    parsed?.transaction?.message?.accountKeys,
    meta.preBalances,
    meta.postBalances,
    wallet,
  );

  const trade = deriveTradeFromDeltas(deltas, await getSolPriceUsd(), wallet, counterpartySol);

  // A launch transaction's SOL flows include the new accounts' rent, so a
  // SOL-priced launch trade is real but its price is not — emit it unpriced
  // rather than let a launch-skewed figure become the card's price. Rent is
  // paid in SOL, so a launch priced off a stablecoin leg (pump.fun now quotes
  // some curves in USDC) is exact and keeps its price.
  const stablePriced = [...deltas].some(([mint, delta]) => STABLE_MINTS.has(mint) && delta !== 0);
  if (trade && !stablePriced && isCreationTransaction(meta.logMessages)) {
    delete trade.volumeUsd;
    delete trade.priceUsd;
  }
  if (!trade) droppedNoMint++;
  return trade;
}

async function transport(body: JsonRpcRequest[]): Promise<{ status: number; body: unknown }> {
  const url = rpcUrl();
  if (!url) {
    if (!process.env.QUICKNODE_SOLANA_RPC_URL?.trim()) return { status: 0, body: null };
    const { quickNodeService } = await import('@/lib/server/quicknode');
    return quickNodeService.request(body.length === 1 ? body[0] : body, RPC_TIMEOUT_MS);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      // A single call goes as a bare object rather than a one-element array:
      // that is the exact request shape measured at 7.3 calls/s, and it avoids
      // relying on the node treating a batch-of-one identically.
      body: JSON.stringify(body.length === 1 ? body[0] : body),
    });

    // A rate limit answers with a plain-text body, so parsing is guarded and
    // the status is what the batcher actually keys off.
    let parsed: unknown = null;
    try {
      parsed = await res.json();
    } catch {
      parsed = null;
    }
    if ((res.status === 429 || res.status >= 500) && process.env.QUICKNODE_SOLANA_RPC_URL?.trim()) {
      try {
        const { quickNodeService } = await import('@/lib/server/quicknode');
        return await quickNodeService.request(body.length === 1 ? body[0] : body, RPC_TIMEOUT_MS);
      } catch { /* Keep the original provider response for the batcher's backoff. */ }
    }
    return { status: res.status, body: parsed };
  } catch {
    if (process.env.QUICKNODE_SOLANA_RPC_URL?.trim()) {
      const { quickNodeService } = await import('@/lib/server/quicknode');
      return quickNodeService.request(body.length === 1 ? body[0] : body, RPC_TIMEOUT_MS);
    }
    throw new Error('Transaction RPC transport unavailable.');
  } finally {
    clearTimeout(timer);
  }
}

const batcher = createBatcher<EnrichedTrade>({
  transport,
  decode: decodeSlot,
  batchSize: BATCH_SIZE,
  waitMs: BATCH_WAIT_MS,
  minIntervalMs: MIN_INTERVAL_MS,
  maxConcurrency: MAX_CONCURRENCY,
  maxQueue: MAX_QUEUE,
});

let loggedSaturation = 0;

/**
 * Enriches one classified signature, or resolves null.
 *
 * Fire-and-forget from the socket handler: the WebSocket callback must stay
 * synchronous and must never wait on an RPC round-trip.
 */
export async function enrichSignature(signature: string): Promise<EnrichedTrade | null> {
  if (!rememberSignature(signature)) return null;

  const trade = await batcher.submit(signature);

  const dropped = batcher.stats().droppedQueueFull;
  if (dropped > 0 && dropped - loggedSaturation >= 1_000) {
    loggedSaturation = dropped;
    logger.warn('[tx-enricher] buffer saturated — dropping signatures', {
      dropped,
      maxQueue: MAX_QUEUE,
      batchSize: BATCH_SIZE,
      requestsPerSecond: ENRICH_RPS,
    });
  }

  return trade;
}

export interface EnricherStats {
  queued: number;
  inFlightBatches: number;
  /** Batched requests sent. */
  batches: number;
  /** Transactions asked for. */
  fetched: number;
  /** Transactions that yielded a usable trade. */
  decoded: number;
  failed: number;
  /** Batches refused with 429 — expected, since we run at the ceiling. */
  rateLimited: number;
  /** Signatures never fetched because the buffer was saturated. */
  droppedQueueFull: number;
  /** Fetched, but no subject mint could be derived — skipped, not guessed. */
  droppedNoMint: number;
  solPriceUsd: number | null;
  /** Effective calls/sec — the lower of the rate ceiling and the budget rate. */
  requestsPerSecond: number;
  /** Rate the monthly allowance supports, before the ceiling is applied. */
  budgetRequestsPerSecond: number;
  /** Configured monthly credit allowance; 0 means budget pacing is off. */
  monthlyCredits: number;
  /** Projected calls/month at the effective rate and duty cycle. */
  projectedMonthlyCalls: number;
  batchSize: number;
  maxQueue: number;
  /** Current inter-batch delay; above the floor means backoff is engaged. */
  currentIntervalMs: number;
}

export function getEnricherStats(): EnricherStats {
  const s = batcher.stats();
  return {
    queued: s.queued,
    inFlightBatches: s.inFlightBatches,
    batches: s.batches,
    fetched: s.fetched,
    decoded: s.decoded,
    failed: s.failed,
    rateLimited: s.rateLimited,
    droppedQueueFull: s.droppedQueueFull,
    droppedNoMint,
    solPriceUsd,
    requestsPerSecond: Number(ENRICH_RPS.toFixed(4)),
    budgetRequestsPerSecond: Number.isFinite(budgetRps) ? Number(budgetRps.toFixed(4)) : -1,
    monthlyCredits: MONTHLY_CREDITS,
    projectedMonthlyCalls: Math.round(ENRICH_RPS * 30 * HOURS_PER_DAY * 3600),
    batchSize: BATCH_SIZE,
    maxQueue: MAX_QUEUE,
    currentIntervalMs: s.currentIntervalMs,
  };
}

/** Test seam — resets counters and dedup state. */
export function __resetEnricherForTests(): void {
  batcher.reset();
  droppedNoMint = 0;
  loggedSaturation = 0;
  seen.clear();
  solPriceUsd = null;
  solPriceAt = 0;
}
