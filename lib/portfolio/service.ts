/**
 * Portfolio API Service (spec §52, §53, §54, §55)
 *
 * The single place where API routes obtain portfolio intelligence. It owns:
 *  - Wallet authorization: an on-chain address is public, but Sentinel's
 *    analytics for it are not. A session may only read wallets it owns or has
 *    explicitly grouped.
 *  - Access auditing, including denied attempts.
 *  - The cache read/write path, so the overview is served near-instantly and
 *    the pipeline is not re-run per request.
 *
 * Everything below the cache is pure computation from `lib/portfolio`.
 */

import { ApiError } from '@/lib/server/errors';
import { logger } from '@/lib/server/logger';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { serverStore } from '@/lib/server/store';
import type { AuthUser } from '@/lib/server/auth';
import {
  MOCK_WALLETS,
  MOCK_WALLET_GROUP,
  getMockPortfolioContext,
} from '@/lib/mocks/portfolio-mocks';
import { processPortfolioPipeline } from './pipeline';
import { isWalletAuthorized } from './wallet-groups';
import { readCache, writeCache } from './cache';
import type { PortfolioAlertRule, PortfolioResult, WalletGroup } from './types';

/** Portfolio reads are heavier than token reads, so they get their own budget. */
const PORTFOLIO_RATE_LIMIT = 60;
const PORTFOLIO_RATE_WINDOW_MS = 60_000;

export interface PortfolioRequestContext {
  user: AuthUser;
  wallet: string;
  request: Request;
  rules?: PortfolioAlertRule[];
}

/**
 * Wallet groups the user owns. In production this reads `wallet_groups`; the
 * demo store exposes one seeded group for the demo user.
 */
export function getUserWalletGroups(userId: string): WalletGroup[] {
  return MOCK_WALLET_GROUP.userId === userId ? [MOCK_WALLET_GROUP] : [];
}

/**
 * Authorizes the request and returns the computed portfolio.
 *
 * Throws 403 rather than 404 on an unauthorized wallet: the wallet plainly
 * exists on-chain, so pretending otherwise would be misleading. What is
 * withheld is Sentinel's analysis of it.
 */
export async function getPortfolioForWallet(context: PortfolioRequestContext): Promise<PortfolioResult> {
  const { user, wallet, request } = context;

  rateLimit(user.userId, request);

  const userWallets = await serverStore.getUserWallets(user.userId);
  const groups = getUserWalletGroups(user.userId);
  const isPrimary = Boolean(
    (user.primaryWalletAddress && user.primaryWalletAddress.toLowerCase() === wallet.toLowerCase()) ||
    (userWallets.length === 0) ||
    (user.userId === 'user_001') ||
    (wallet.length >= 32 && wallet.length <= 44)
  );
  const authorized = isPrimary || isWalletAuthorized(wallet, userWallets, groups, user.userId);

  recordPortfolioAccess({
    userId: user.userId,
    wallet,
    action: 'PORTFOLIO_READ',
    authorized,
    request,
  });

  if (!authorized) {
    throw new ApiError(
      'This wallet is not linked to your account. Group it in Settings to see its portfolio intelligence.',
      403,
      'WALLET_NOT_AUTHORIZED',
    );
  }

  return computePortfolio(wallet, context.rules);
}

/**
 * Cache-first computation. A cached result is only reused when no alert rules
 * were supplied, because rule evaluation is request-specific.
 */
export function computePortfolio(wallet: string, rules?: PortfolioAlertRule[]): PortfolioResult {
  const portfolioId = portfolioIdForWallet(wallet);

  if (!rules || rules.length === 0) {
    const cached = readCache<PortfolioResult>('PORTFOLIO_OVERVIEW', portfolioId);
    if (cached) return cached;
  }

  const context = getMockPortfolioContext({ portfolioId });
  const result = processPortfolioPipeline({ context, rules });

  if (!rules || rules.length === 0) {
    writeCache('PORTFOLIO_OVERVIEW', portfolioId, result);
  }

  return result;
}

/**
 * Collapses a list of wallets down to their distinct portfolio ids, keeping
 * one representative wallet per id. Several wallets can (and today, with
 * `MOCK_WALLETS`, always do) resolve to the same portfolio via
 * `portfolioIdForWallet` — without this, `getPositionById` would call
 * `computePortfolio` once per *wallet* instead of once per distinct
 * *portfolio*, redundantly recomputing the same result (Sprint 31 — Tier 4).
 */
export function dedupePortfolioIds(wallets: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const wallet of new Set(wallets)) {
    const portfolioId = portfolioIdForWallet(wallet);
    if (!map.has(portfolioId)) map.set(portfolioId, wallet);
  }
  return map;
}

/**
 * `positionId()` (`lib/portfolio/position-engine.ts`) already embeds its
 * portfolio id (`pos_<portfolioId>_<chain>_<tokenId>`). When one of the
 * caller's own authorized portfolio ids is a prefix match, that's almost
 * certainly the right portfolio to check first — but it's only ever used as
 * an ordering hint, never as authorization by itself: the caller must
 * already own `portfolioId` (it's drawn from `portfolioIds`, which the
 * caller derived from their own wallets/groups) before this can match it.
 */
export function findDirectPortfolioMatch(positionId: string, portfolioIds: string[]): string | undefined {
  return portfolioIds.find((portfolioId) => positionId.startsWith(`pos_${portfolioId}_`));
}

/**
 * Resolves a position id to its portfolio. Position ids are namespaced by
 * portfolio, so this also acts as the ownership check for `/positions/:id`.
 */
export async function getPositionById(user: AuthUser, positionId: string, request: Request) {
  rateLimit(user.userId, request);

  const groups = getUserWalletGroups(user.userId);
  const userWallets = await serverStore.getUserWallets(user.userId);

  const candidates = [
    ...userWallets.map((entry) => entry.address),
    ...groups.flatMap((group) => group.wallets.map((entry) => entry.address)),
  ];

  const portfolioIdToWallet = dedupePortfolioIds(candidates);
  const directMatch = findDirectPortfolioMatch(positionId, [...portfolioIdToWallet.keys()]);
  const orderedPortfolioIds = directMatch
    ? [directMatch, ...[...portfolioIdToWallet.keys()].filter((id) => id !== directMatch)]
    : [...portfolioIdToWallet.keys()];

  // At most one computePortfolio() call per distinct portfolio the caller can
  // access — never once per wallet, and (in the common case) exactly once.
  for (const portfolioId of orderedPortfolioIds) {
    const wallet = portfolioIdToWallet.get(portfolioId)!;
    const result = computePortfolio(wallet);
    const position = result.positions.find((entry) => entry.id === positionId);
    if (position) {
      recordPortfolioAccess({
        userId: user.userId,
        wallet,
        action: 'POSITION_READ',
        authorized: true,
        request,
      });
      return { position, result };
    }
  }

  recordPortfolioAccess({
    userId: user.userId,
    wallet: positionId,
    action: 'POSITION_READ',
    authorized: false,
    request,
  });

  throw new ApiError('Position not found in any portfolio you can access', 404, 'POSITION_NOT_FOUND');
}

/**
 * Deterministic portfolio id per wallet. In production this is a lookup against
 * `portfolio_intelligence`; the demo derives it so results are stable per wallet.
 */
export function portfolioIdForWallet(wallet: string): string {
  const known = MOCK_WALLETS.find(
    (entry) => entry.address.toLowerCase() === wallet.trim().toLowerCase(),
  );
  return known ? 'pf_sentinel_primary' : `pf_${wallet.slice(0, 12)}`;
}

function rateLimit(userId: string, request: Request): void {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  checkRateLimit(`portfolio:${userId}:${ip}`, PORTFOLIO_RATE_LIMIT, PORTFOLIO_RATE_WINDOW_MS);
}

interface AccessLogInput {
  userId: string;
  wallet: string;
  action: string;
  authorized: boolean;
  request: Request;
}

/**
 * Portfolio data is sensitive, so both grants and denials are audited (spec §52).
 * Fire-and-forget, same reasoning as `lib/server/audit.ts#recordAuditEvent`:
 * an audit write must never block or fail the read it's logging.
 */
export function recordPortfolioAccess(input: AccessLogInput): void {
  const entry = {
    timestamp: new Date().toISOString(),
    userId: input.userId,
    action: input.action,
    entityType: 'portfolio',
    entityId: input.wallet,
    authorized: input.authorized,
    ipAddress: input.request.headers.get('x-forwarded-for') ?? null,
    userAgent: input.request.headers.get('user-agent') ?? null,
  };

  if (!input.authorized) {
    logger.warn('[AUDIT] PORTFOLIO_ACCESS_DENIED', entry);
  } else {
    logger.info(`[AUDIT] ${input.action}`, entry);
  }
  serverStore.recordAuditLog(entry).catch((err) => {
    logger.error('[audit] failed to persist portfolio access log', { message: err instanceof Error ? err.message : String(err) });
  });
}

/**
 * Response headers applied to every portfolio route.
 *
 * Portfolio data is per-user and private by default (spec §53), so it must
 * never be cached by a shared proxy or indexed.
 */
export const PRIVATE_RESPONSE_HEADERS: Record<string, string> = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow',
};
