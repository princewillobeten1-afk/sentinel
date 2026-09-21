import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { getAudit, isAuditPending, queueAudit } from '@/lib/market/enrichment/audit-worker';
import { queueSecurityTarget } from '@/lib/market/enrichment/security-worker';
import { getTokenCardPatch } from '@/lib/market/live/card-cache';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/tokens/:chain/:address/audit
 *
 * ## What this replaced
 *
 * Every field on this route was a literal, identical for every token that has
 * ever been requested: `riskScore: 14`, `"24.5% Cluster Top 10"`, `"92.4%
 * Authentic"`, `"0/12 Rugged (Credible)"`, `"Max Safe Order: 45.0 SOL"`, and a
 * security checklist where mint authority, freeze authority, LP burn status
 * and honeypot tax were all asserted `true`/`0%` unconditionally. The
 * frontend never even called this route — the Audit tab rendered these same
 * strings directly, so the two fabrications matched exactly.
 *
 * ## What is real now
 *
 * - `mintAuthorityDisabled` / `freezeAuthorityDisabled` — Jupiter's own audit
 *   of the mint account. A real security fact, not a rating.
 * - `top10HoldersPct` — Jupiter's computed top-holder concentration.
 * - `devMints` / `devMigrations` / `migrationRatePct` — the deployer's history
 *   across their launches, same source as `/dev-activity`.
 * - `organicScore` / `organicScoreLabel` — Jupiter's own wash-trading filter,
 *   the real substitute for the invented "92.4% Authentic".
 * - `snipersPct` / `insidersPct` / `bundlersPct` — Birdeye's holder-profile
 *   audit, the same measurement already behind the Discover cards' audit
 *   pills. Rate-limited to ~0.5 req/s across the whole app, so a token this
 *   route has not seen before reports `auditPending: true` rather than a
 *   number, and resolves on a subsequent request.
 *
 * ## What is absent, and why
 *
 * LP-burn status and a honeypot/tax check both need a check this platform
 * does not perform — neither is asserted. There is no computed risk score:
 * every prior score was a single rating standing in for facts that are shown
 * individually below instead.
 */

const JUPITER_SEARCH = 'https://lite-api.jup.ag/tokens/v2/search';
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; payload: unknown }>();

interface JupiterSearchToken {
  id?: string;
  symbol?: string;
  dev?: string;
  organicScore?: number;
  organicScoreLabel?: string;
  audit?: {
    mintAuthorityDisabled?: boolean;
    freezeAuthorityDisabled?: boolean;
    topHoldersPercentage?: number;
    devBalancePercentage?: number;
    devMints?: number;
    devMigrations?: number;
  };
}

export async function GET(
  _request: Request,
  { params }: { params: { chain: string; address: string } },
) {
  try {
    const { chain, address } = params;
    if (chain.toLowerCase() !== 'solana') {
      throw new ApiError('Token-card audit evidence is currently available for Solana only', 400);
    }
    if (!address || address.length < 32) {
      throw new ApiError('A token mint address is required', 400);
    }

    queueAudit([address]);
    queueSecurityTarget(address);
    const holderAudit = getAudit(address);
    const liveCard = getTokenCardPatch(address);
    const live = liveCard?.changedFields;

    const cached = cache.get(address);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return jsonResponse({
        ...(cached.payload as Record<string, unknown>),
        snipersPct: live?.sniperPercentage ?? holderAudit?.snipersPct ?? null,
        insidersPct: live?.insiderHoldingsPct ?? holderAudit?.insidersPct ?? null,
        bundlersPct: live?.bundlerPercentage ?? holderAudit?.bundlersPct ?? null,
        holderTop10Pct: live?.top10HoldingsPct ?? holderAudit?.top10Pct ?? null,
        totalHolders: live?.holdersCount ?? holderAudit?.totalHolders ?? null,
        holderAuditPending: live?.auditPending ?? (!holderAudit && isAuditPending(address)),
        rugRisk: live?.rugRisk ?? null,
        ownershipEvidence: live?.ownershipEvidence ?? null,
        securityEvidence: live?.securityEvidence ?? null,
        creatorEvidence: live?.creatorEvidence ?? null,
        lastAuditedAt: liveCard?.observedAt ?? null,
      });
    }

    // Prioritizes this mint on the Birdeye audit queue if it is not already
    // cached — see `queueAudit`'s docs: this is exactly the "token detail
    // view" caller it exists for.

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    let token: JupiterSearchToken | null = null;
    try {
      const res = await fetch(`${JUPITER_SEARCH}?query=${encodeURIComponent(address)}`, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
      if (res.ok) {
        const body = await res.json();
        const list: JupiterSearchToken[] = Array.isArray(body) ? body : (body?.tokens ?? []);
        token = list.find((t) => t.id === address) ?? list[0] ?? null;
      }
    } finally {
      clearTimeout(timer);
    }

    const audit = token?.audit;
    const devMints = typeof audit?.devMints === 'number' ? audit.devMints : null;
    const devMigrations = typeof audit?.devMigrations === 'number' ? audit.devMigrations : null;

    const payload = {
      token: address,
      chain: chain.toLowerCase(),
      symbol: token?.symbol ?? null,
      creatorAddress: live?.devAddress ?? token?.dev ?? null,

      // Contract security — real, from Jupiter's own read of the mint account.
      mintAuthorityDisabled: live?.isMintRenounced ?? audit?.mintAuthorityDisabled ?? null,
      freezeAuthorityDisabled: live?.isFreezeDisabled ?? audit?.freezeAuthorityDisabled ?? null,
      // Neither is checked by anything this platform runs. `null`, not `true`.
      lpTokensBurned: null,
      liquidityLocked: live?.isLiquidityLocked ?? null,
      honeypotTaxZero: null,

      // Ownership concentration — Jupiter's computed figure, same source the
      // holders tab's chain read would largely agree with.
      top10HoldersPct: live?.top10HoldingsPct ?? (typeof audit?.topHoldersPercentage === 'number'
        ? Number(audit.topHoldersPercentage.toFixed(2))
        : null),
      devBalancePct: live?.devHoldingsPct ?? (typeof audit?.devBalancePercentage === 'number'
        ? Number(audit.devBalancePercentage.toFixed(4))
        : null),

      // Wash-trading filter — Jupiter's own model, the real substitute for
      // the invented "92.4% Authentic".
      organicScore: typeof token?.organicScore === 'number'
        ? Number(token.organicScore.toFixed(1))
        : null,
      organicScoreLabel: token?.organicScoreLabel ?? null,

      // Deployer history — same figures as `/dev-activity`.
      devMints,
      devMigrations,
      migrationRatePct:
        devMints && devMints > 0 && devMigrations !== null
          ? Number(((devMigrations / devMints) * 100).toFixed(3))
          : null,

      // Holder-profile audit — Birdeye, the same source behind the Discover
      // cards' audit pills.
      snipersPct: live?.sniperPercentage ?? holderAudit?.snipersPct ?? null,
      insidersPct: live?.insiderHoldingsPct ?? holderAudit?.insidersPct ?? null,
      bundlersPct: live?.bundlerPercentage ?? holderAudit?.bundlersPct ?? null,
      holderTop10Pct: live?.top10HoldingsPct ?? holderAudit?.top10Pct ?? null,
      totalHolders: live?.holdersCount ?? holderAudit?.totalHolders ?? null,
      // True while the Birdeye lookup above is queued but has not resolved
      // yet — lets the UI show "pending" rather than treat an unresolved
      // lookup as "checked, nothing found".
      holderAuditPending: live?.auditPending ?? (!holderAudit && isAuditPending(address)),
      rugRisk: live?.rugRisk ?? null,
      auditVersion: live?.auditVersion ?? null,
      marketEvidence: live?.marketEvidence ?? null,
      ownershipEvidence: live?.ownershipEvidence ?? null,
      securityEvidence: live?.securityEvidence ?? null,
      creatorEvidence: live?.creatorEvidence ?? null,
      lifecycleEvidence: live?.lifecycleEvidence ?? null,

      coverage:
        'Contract facts and deployer history from Jupiter; ownership concentration also from Birdeye where available. LP-burn status and honeypot/tax behavior are not checked by this platform.',
      lastAuditedAt: liveCard?.observedAt ?? null,
    };

    // Do not pin a pending answer for a minute; the worker broadcasts within
    // seconds and the next detail refresh should see it immediately.
    cache.set(address, { at: Date.now() - (payload.holderAuditPending ? CACHE_TTL_MS - 2_000 : 0), payload });
    return jsonResponse(payload);
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch token audit', 500));
  }
}
