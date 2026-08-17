/**
 * Portfolio Cache Strategy (spec §54, §55)
 *
 * Performance targets:
 *   Portfolio overview      near-instant from cache
 *   Position updates        near real-time
 *   P&L recalculation       incremental
 *   Historical analytics    asynchronous
 *   Cross-chain aggregation parallelised
 *
 * The rule the rest of the system relies on: we never recompute the whole
 * portfolio on every block. Writes invalidate a narrow scope, and dependent
 * scopes cascade explicitly rather than by dropping the entire namespace.
 */

export type CacheScope =
  | 'PORTFOLIO_OVERVIEW'
  | 'POSITIONS'
  | 'POSITION'
  | 'PRICE'
  | 'EXITABILITY'
  | 'RISK'
  | 'EXPOSURE'
  | 'PERFORMANCE';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  storedAt: number;
}

/** TTLs in milliseconds, tuned to how fast each input actually moves. */
export const CACHE_TTL_MS: Record<CacheScope, number> = {
  PORTFOLIO_OVERVIEW: 15_000,
  POSITIONS: 15_000,
  POSITION: 10_000,
  PRICE: 10_000,
  EXITABILITY: 60_000,
  RISK: 60_000,
  EXPOSURE: 60_000,
  PERFORMANCE: 300_000,
};

/**
 * Invalidating a scope also invalidates everything derived from it, so a price
 * change correctly refreshes valuation-dependent analytics without a blanket
 * flush.
 */
const CASCADE: Record<CacheScope, CacheScope[]> = {
  PRICE: ['POSITION', 'POSITIONS', 'PORTFOLIO_OVERVIEW', 'RISK', 'EXPOSURE'],
  EXITABILITY: ['POSITION', 'POSITIONS', 'PORTFOLIO_OVERVIEW', 'RISK', 'EXPOSURE'],
  POSITION: ['POSITIONS', 'PORTFOLIO_OVERVIEW', 'RISK', 'EXPOSURE', 'PERFORMANCE'],
  POSITIONS: ['PORTFOLIO_OVERVIEW', 'RISK', 'EXPOSURE', 'PERFORMANCE'],
  RISK: ['PORTFOLIO_OVERVIEW'],
  EXPOSURE: ['PORTFOLIO_OVERVIEW', 'RISK'],
  PERFORMANCE: [],
  PORTFOLIO_OVERVIEW: [],
};

const store = new Map<string, CacheEntry<unknown>>();

export function cacheKey(scope: CacheScope, portfolioId: string, suffix?: string): string {
  return suffix ? `${scope}:${portfolioId}:${suffix}` : `${scope}:${portfolioId}`;
}

export function readCache<T>(scope: CacheScope, portfolioId: string, suffix?: string): T | null {
  const key = cacheKey(scope, portfolioId, suffix);
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function writeCache<T>(scope: CacheScope, portfolioId: string, value: T, suffix?: string): T {
  const now = Date.now();
  store.set(cacheKey(scope, portfolioId, suffix), {
    value,
    storedAt: now,
    expiresAt: now + CACHE_TTL_MS[scope],
  });
  return value;
}

/** Invalidates a scope for one portfolio and cascades to derived scopes. */
export function invalidate(scope: CacheScope, portfolioId: string): CacheScope[] {
  const affected = new Set<CacheScope>([scope, ...(CASCADE[scope] ?? [])]);
  for (const key of [...store.keys()]) {
    const [keyScope, keyPortfolio] = key.split(':');
    if (keyPortfolio === portfolioId && affected.has(keyScope as CacheScope)) {
      store.delete(key);
    }
  }
  return [...affected];
}

export function invalidatePortfolio(portfolioId: string): void {
  for (const key of [...store.keys()]) {
    if (key.split(':')[1] === portfolioId) store.delete(key);
  }
}

export function cacheStats(): { entries: number; scopes: Record<string, number> } {
  const scopes: Record<string, number> = {};
  for (const key of store.keys()) {
    const scope = key.split(':')[0];
    scopes[scope] = (scopes[scope] ?? 0) + 1;
  }
  return { entries: store.size, scopes };
}

/** Test helper. Not used by request paths. */
export function resetCache(): void {
  store.clear();
}

// ────────────────────────────────────────────────────────────────────────────
// Incremental recomputation planning (spec §54)
// ────────────────────────────────────────────────────────────────────────────

export type PortfolioMutation =
  | 'NEW_TRADE'
  | 'TRADE_CONFIRMED'
  | 'PRICE_TICK'
  | 'EXITABILITY_REFRESH'
  | 'REORG'
  | 'WALLET_ADDED';

export interface RecomputePlan {
  mutation: PortfolioMutation;
  /** Work that must complete before the user's next read. */
  synchronous: CacheScope[];
  /** Work that can lag without misleading the user. */
  asynchronous: CacheScope[];
  /** True when derived state must be rebuilt from the event log. */
  fullRebuild: boolean;
  rationale: string;
}

/**
 * Decides how much work a given mutation actually requires. Trade confirmations
 * must land immediately (spec §49); historical analytics may lag.
 */
export function planRecompute(mutation: PortfolioMutation): RecomputePlan {
  switch (mutation) {
    case 'NEW_TRADE':
    case 'TRADE_CONFIRMED':
      return {
        mutation,
        synchronous: ['POSITION', 'POSITIONS', 'PORTFOLIO_OVERVIEW'],
        asynchronous: ['RISK', 'EXPOSURE', 'PERFORMANCE'],
        fullRebuild: false,
        rationale: 'Trade confirmation must be reflected immediately; analytics can settle behind it.',
      };
    case 'PRICE_TICK':
      return {
        mutation,
        synchronous: ['POSITION', 'PORTFOLIO_OVERVIEW'],
        asynchronous: ['EXPOSURE', 'RISK'],
        fullRebuild: false,
        rationale: 'Valuation is re-marked incrementally; cost basis and lots are untouched by a price move.',
      };
    case 'EXITABILITY_REFRESH':
      return {
        mutation,
        synchronous: ['POSITION'],
        asynchronous: ['RISK', 'EXPOSURE', 'PORTFOLIO_OVERVIEW'],
        fullRebuild: false,
        rationale: 'Exitability changes executable value and risk, but not quantity or basis.',
      };
    case 'REORG':
      return {
        mutation,
        synchronous: ['POSITION', 'POSITIONS', 'PORTFOLIO_OVERVIEW'],
        asynchronous: ['RISK', 'EXPOSURE', 'PERFORMANCE'],
        fullRebuild: true,
        rationale:
          'A reorg invalidates derived position state, so positions are rebuilt from the event log and a correction is recorded.',
      };
    case 'WALLET_ADDED':
    default:
      return {
        mutation,
        synchronous: ['POSITIONS', 'PORTFOLIO_OVERVIEW'],
        asynchronous: ['RISK', 'EXPOSURE', 'PERFORMANCE'],
        fullRebuild: true,
        rationale: 'A new wallet changes which transfers count as internal, so classification must run again.',
      };
  }
}
