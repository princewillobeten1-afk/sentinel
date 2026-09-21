import 'server-only';

import {
  mapJupiterTx,
  mapGeckoTrade,
  type HistoricalTrade,
  type JupiterTx,
  type GeckoTrade,
} from './trade-history-mappers';

export type { HistoricalTrade } from './trade-history-mappers';

/**
 * A token's recent trade tape, from an indexer that has watched it all along.
 *
 * ## Why this exists
 *
 * The Trades and Top Traders tabs read only what this platform's own stream
 * captured, and that stream only watches a token while someone has it open —
 * so every page load started with an empty tape, and on a token that had just
 * migrated with hundreds of trades a minute it showed nothing at all.
 *
 * ## Sources, in order
 *
 * 1. **Jupiter's trade feed** (`datapi.jup.ag/v1/txs/{mint}`) — the feed
 *    jup.ag's own token pages use. Covers bonding-curve tokens *and* migrated
 *    pools, ~16 KB per 30-trade page. Undocumented, hence the fallback.
 * 2. **GeckoTerminal** (`api.geckoterminal.com`) — documented and public, but
 *    only for pools it has indexed (a fresh pump.fun curve usually is not yet),
 *    and ~180 KB per 300-trade call.
 *
 * Neither is fabricated into: a token neither source knows returns an empty
 * list with `source: null`, and the caller says so.
 *
 * ## Cost
 *
 * Cached per mint for a few seconds, and concurrent callers share one upstream
 * request — the Trades, Top Traders and Dev Activity tabs all ask at once on
 * page load, and without sharing that is three identical fetches.
 */

export interface TradeHistoryResult {
  trades: HistoricalTrade[];
  source: 'jupiter' | 'geckoterminal' | null;
  /** Set when every source failed, so the caller can tell "none" from "down". */
  error?: string;
}

const JUPITER_TXS = 'https://datapi.jup.ag/v1/txs';
const GECKO_BASE = 'https://api.geckoterminal.com/api/v2/networks/solana';
const REQUEST_TIMEOUT_MS = 8_000;
const HEADERS = { accept: 'application/json', 'user-agent': 'Mozilla/5.0 (compatible; SentinelTerminal/1.0)' };

/** Short: the tape is the thing on screen that must feel live. */
const FRESH_MS = 6_000;
/** Pools barely change; re-resolving them every refresh is wasted calls. */
const POOL_TTL_MS = 5 * 60_000;
const MAX_PAGES = 6;
const MAX_CACHE_ENTRIES = 200;

const cache = new Map<string, { at: number; pages: number; result: TradeHistoryResult }>();
const inflight = new Map<string, Promise<TradeHistoryResult>>();
const poolCache = new Map<string, { at: number; pool: string | null }>();

function num(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: HEADERS, cache: 'no-store', signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ── Jupiter ──

async function fromJupiter(mint: string, pages: number): Promise<HistoricalTrade[]> {
  const trades: HistoricalTrade[] = [];
  let offset: string | null = null;
  for (let page = 0; page < pages; page++) {
    const url = `${JUPITER_TXS}/${mint}?dir=desc${offset ? `&offset=${encodeURIComponent(offset)}` : ''}`;
    const body = (await getJson(url)) as { txs?: JupiterTx[]; next?: string };
    for (const tx of body.txs ?? []) {
      const trade = mapJupiterTx(tx);
      if (trade) trades.push(trade);
    }
    if (!body.next || !(body.txs?.length)) break;
    offset = body.next;
  }
  return trades;
}

// ── GeckoTerminal ──

async function topGeckoPool(mint: string): Promise<string | null> {
  const hit = poolCache.get(mint);
  if (hit && Date.now() - hit.at < POOL_TTL_MS) return hit.pool;

  const body = (await getJson(`${GECKO_BASE}/tokens/${mint}/pools?page=1`)) as {
    data?: Array<{ attributes?: { address?: string; reserve_in_usd?: string } }>;
  };
  const pools = (body.data ?? [])
    .map((p) => ({ address: p.attributes?.address, reserve: num(p.attributes?.reserve_in_usd) ?? 0 }))
    .filter((p): p is { address: string; reserve: number } => Boolean(p.address))
    .sort((x, y) => y.reserve - x.reserve);

  const pool = pools[0]?.address ?? null;
  poolCache.set(mint, { at: Date.now(), pool });
  return pool;
}

async function fromGecko(mint: string): Promise<HistoricalTrade[]> {
  const pool = await topGeckoPool(mint);
  if (!pool) return [];
  const body = (await getJson(`${GECKO_BASE}/pools/${pool}/trades`)) as { data?: GeckoTrade[] };
  return (body.data ?? [])
    .map((t) => mapGeckoTrade(t, mint))
    .filter((t): t is HistoricalTrade => t !== null);
}

// ── Public ──

async function load(mint: string, pages: number): Promise<TradeHistoryResult> {
  const errors: string[] = [];

  try {
    const trades = await fromJupiter(mint, pages);
    if (trades.length > 0) return { trades, source: 'jupiter' };
  } catch (err) {
    errors.push(`jupiter: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const trades = await fromGecko(mint);
    if (trades.length > 0) return { trades, source: 'geckoterminal' };
  } catch (err) {
    errors.push(`geckoterminal: ${err instanceof Error ? err.message : String(err)}`);
  }

  return errors.length === 2
    ? { trades: [], source: null, error: errors.join('; ') }
    : { trades: [], source: null };
}

/**
 * Recent trades for a mint, newest first.
 *
 * @param pages Jupiter pages of 30 to walk. One is ~seconds of history on a
 *   busy token; Top Traders asks for more to rank wallets over a real window.
 */
export async function getTradeHistory(mint: string, pages = 1): Promise<TradeHistoryResult> {
  const wanted = Math.min(MAX_PAGES, Math.max(1, Math.trunc(pages)));

  // Any entry at least as deep as asked for serves the request — a Top
  // Traders fetch of 5 pages also answers the tape's request for 1.
  const hit = cache.get(mint);
  if (hit && hit.pages >= wanted) {
    const age = Date.now() - hit.at;
    if (age < FRESH_MS) return hit.result;
    // Stale but recent: answer now and refresh behind it. Walking the cursor
    // is sequential (~0.9s a page), and a tape that waits two seconds on every
    // poll feels anything but live.
    if (age < STALE_SERVE_MS) {
      void refresh(mint, wanted).catch(() => {});
      return hit.result;
    }
  }

  return refresh(mint, wanted);
}

/** Longest a cached tape is served while a fresh one loads behind it. */
const STALE_SERVE_MS = 45_000;

function refresh(mint: string, wanted: number): Promise<TradeHistoryResult> {
  const key = `${mint}:${wanted}`;
  const pending = inflight.get(key);
  if (pending) return pending;

  const request = load(mint, wanted)
    .then((result) => {
      // Failures are not cached, so the next refresh retries immediately.
      if (!result.error) {
        if (cache.size >= MAX_CACHE_ENTRIES) {
          const oldest = cache.keys().next().value;
          if (oldest !== undefined) cache.delete(oldest);
        }
        cache.set(mint, { at: Date.now(), pages: wanted, result });
      }
      return result;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, request);
  return request;
}
