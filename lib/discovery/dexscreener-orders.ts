/**
 * "Dex Paid" — whether the team paid DexScreener to enhance the listing.
 *
 * ## Why this is separate from boosts
 *
 * `dexscreener-boosts.ts` used to set `isDexPaid: true` for anything with an
 * active boost. They are two different purchases. A boost is paid promotion
 * that pushes a token up DexScreener's own feeds; a token profile is the
 * listing enhancement — icon, header, socials, description. A token can have
 * either, both, or neither, and the earlier conflation meant every boosted
 * token advertised a listing nobody had checked.
 *
 * The real signal is `/orders/v1/{chain}/{mint}`, which returns one entry per
 * purchase:
 *
 *     {"orders":[{"chainId":"solana","tokenAddress":"HTGTT…pump",
 *                 "type":"tokenProfile","status":"approved",
 *                 "paymentTimestamp":1788472477988}], "boosts":[…]}
 *
 * `paymentTimestamp` is what makes the age Axiom renders beside the badge
 * ("DS 2d") a measured figure rather than a guess.
 *
 * ## Cost
 *
 * This endpoint takes **one mint per request** — unlike `latest/dex/tokens`,
 * which accepts 30. A feed of 50 rows would therefore cost 50 requests per
 * refresh, so results are cached and callers queue rather than fetch per
 * render. Absence is cached too: "no order" is the common answer and is just
 * as valid as a hit, so re-asking every cycle would spend the whole budget
 * re-confirming nothing.
 */

export const DEXSCREENER_ORDERS_BASE = 'https://api.dexscreener.com/orders/v1';

export interface DexOrder {
  chainId?: string;
  tokenAddress?: string;
  /** e.g. `tokenProfile`, `communityTakeover`, `tokenAd`, `trendingBarAd`. */
  type?: string;
  /** e.g. `approved`, `processing`, `rejected`, `cancelled`. */
  status?: string;
  paymentTimestamp?: number;
}

export interface DexPaidStatus {
  /** True only when an order is present and approved. */
  isDexPaid: boolean;
  /** Epoch ms of the earliest approved payment, when reported. */
  paidAt: number | null;
  /** Order types that were approved, for the tooltip. */
  types: string[];
  /** When this answer was obtained. */
  checkedAt: number;
}

interface CacheEntry {
  status: DexPaidStatus;
  at: number;
}

/** Long, because a listing purchase is close to permanent once approved. */
const HIT_TTL_MS = 60 * 60 * 1000;
/** Shorter, because a token can be paid for at any time. */
const MISS_TTL_MS = 15 * 60 * 1000;

const globalForOrders = globalThis as unknown as {
  sentinelDexOrderCache?: Map<string, CacheEntry>;
  sentinelDexOrderInflight?: Map<string, Promise<DexPaidStatus | null>>;
};

const cache: Map<string, CacheEntry> = (globalForOrders.sentinelDexOrderCache ??= new Map());
const inflight: Map<string, Promise<DexPaidStatus | null>> = (globalForOrders.sentinelDexOrderInflight ??=
  new Map());

/**
 * Reduces an order list to a single verdict.
 *
 * Only `approved` counts. A `processing` or `rejected` order means somebody
 * *tried* to pay, which is not the same as a paid listing and must not render
 * the badge.
 */
export function summariseOrders(orders: DexOrder[] | null | undefined): DexPaidStatus {
  const checkedAt = Date.now();
  if (!Array.isArray(orders) || orders.length === 0) {
    return { isDexPaid: false, paidAt: null, types: [], checkedAt };
  }

  const approved = orders.filter((order) => order.status?.toLowerCase() === 'approved');
  if (approved.length === 0) {
    return { isDexPaid: false, paidAt: null, types: [], checkedAt };
  }

  const stamps = approved
    .map((order) => order.paymentTimestamp)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);

  return {
    isDexPaid: true,
    // Earliest approved payment: the age question is "how long has this been
    // paid for", and a later top-up should not reset that to today.
    paidAt: stamps.length > 0 ? Math.min(...stamps) : null,
    types: [...new Set(approved.map((order) => order.type).filter((t): t is string => !!t))],
    checkedAt,
  };
}

/** Cached lookup. Returns null only when the request itself failed. */
export async function fetchDexPaidStatus(
  mint: string,
  chain = 'solana',
  timeoutMs = 8_000,
): Promise<DexPaidStatus | null> {
  if (!mint) return null;

  const key = `${chain}:${mint}`;
  const cached = cache.get(key);
  if (cached) {
    const ttl = cached.status.isDexPaid ? HIT_TTL_MS : MISS_TTL_MS;
    if (Date.now() - cached.at < ttl) return cached.status;
  }

  // One request per mint, however many callers ask at once.
  const existing = inflight.get(key);
  if (existing) return existing;

  const request = (async (): Promise<DexPaidStatus | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${DEXSCREENER_ORDERS_BASE}/${chain}/${mint}`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!res.ok) return null;

      const body = await res.json();
      // The endpoint has returned both a bare array and `{orders: [...]}`.
      const orders: DexOrder[] = Array.isArray(body) ? body : (body?.orders ?? []);
      const status = summariseOrders(orders);
      cache.set(key, { status, at: Date.now() });
      return status;
    } catch {
      // A failed check is not a negative answer, so nothing is cached and the
      // caller renders "unknown" rather than "not paid".
      return null;
    } finally {
      clearTimeout(timer);
      inflight.delete(key);
    }
  })();

  inflight.set(key, request);
  return request;
}

/** Synchronous read of an already-known verdict, for render paths. */
export function getCachedDexPaid(mint: string, chain = 'solana'): DexPaidStatus | null {
  const cached = cache.get(`${chain}:${mint}`);
  if (!cached) return null;
  const ttl = cached.status.isDexPaid ? HIT_TTL_MS : MISS_TTL_MS;
  return Date.now() - cached.at < ttl ? cached.status : null;
}

/** Test seam. */
export function __resetDexPaidCache(): void {
  cache.clear();
  inflight.clear();
}
