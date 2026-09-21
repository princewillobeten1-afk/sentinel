import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { queueSecurityTarget } from '@/lib/market/enrichment/security-worker';
import { getTokenCardPatch } from '@/lib/market/live/card-cache';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/tokens/:chain/:address/dev-activity
 *
 * What is actually known about the token's deployer.
 *
 * ## What this replaced
 *
 * The route attempted Birdeye — whose quota is exhausted, so it always failed —
 * and then fell through to constants: `price = 0.0425`, `devHoldingPct =
 * '0.85%'`, `isLpBurned = true`, a genesis date of 2026-08-13, and a timeline
 * of invented events ("Dev Accumulation Buy +15.00 SOL", impact "+1.8% Pump").
 * On the Wrapped SOL page it reported launches by "Solana Sentinel" with a
 * 98/100 Tier 1 Verified trust score.
 *
 * ## What is real now
 *
 * Jupiter publishes the deployer address and, more usefully, that deployer's
 * history: `devMints` (how many tokens they have minted) and `devMigrations`
 * (how many reached a real pool). A wallet that has minted thousands of tokens
 * and graduated a handful is the strongest cheap signal in this category, and
 * it is a measurement rather than a rating.
 *
 * ## What is absent, and why
 *
 * There is no event timeline. Reconstructing the deployer's buys and sells
 * needs a signature-history walk per wallet, which this endpoint does not do.
 * `isLpBurned` is likewise not asserted — it was hardcoded `true`, a safety
 * claim about tokens nothing had checked.
 */

const JUPITER_SEARCH = 'https://lite-api.jup.ag/tokens/v2/search';
const CACHE_TTL_MS = 120_000;
const cache = new Map<string, { at: number; payload: unknown }>();

interface JupiterSearchToken {
  id?: string;
  symbol?: string;
  name?: string;
  dev?: string;
  audit?: {
    devMints?: number;
    devMigrations?: number;
    mintAuthorityDisabled?: boolean;
    freezeAuthorityDisabled?: boolean;
    devBalancePercentage?: number;
  };
  firstPool?: { createdAt?: string };
}

export async function GET(
  _request: Request,
  { params }: { params: { chain: string; address: string } },
) {
  try {
    const { chain, address } = params;
    if (chain.toLowerCase() !== 'solana') {
      throw new ApiError('Creator evidence is currently available for Solana only', 400);
    }
    if (!address || address.length < 32) {
      throw new ApiError('A token mint address is required', 400);
    }

    queueSecurityTarget(address);
    const live = getTokenCardPatch(address)?.changedFields;

    const cached = cache.get(address);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return jsonResponse({
        ...(cached.payload as Record<string, unknown>),
        creatorAddress: live?.devAddress ?? (cached.payload as Record<string, unknown>).creatorAddress ?? null,
        devWalletAge: live?.devWalletAge ?? null,
        creatorEvidence: live?.creatorEvidence ?? null,
        devBalancePct: live?.devHoldingsPct ?? (cached.payload as Record<string, unknown>).devBalancePct ?? null,
      });
    }

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
      devWalletAge: live?.devWalletAge ?? null,
      creatorEvidence: live?.creatorEvidence ?? null,
      /** Tokens this deployer has minted, across all of their launches. */
      devMints,
      /** How many of those reached a real pool. */
      devMigrations,
      /**
       * Share of mints that graduated. A deployer with 4,984 mints and 7
       * migrations sits at 0.14% — that ratio is the signal, and it is
       * computed, not scored.
       */
      migrationRatePct:
        devMints && devMints > 0 && devMigrations !== null
          ? Number(((devMigrations / devMints) * 100).toFixed(3))
          : null,
      launchedAt: token?.firstPool?.createdAt ?? null,
      mintAuthorityDisabled: audit?.mintAuthorityDisabled ?? null,
      freezeAuthorityDisabled: audit?.freezeAuthorityDisabled ?? null,
      /**
       * Share of supply the deployer still holds, from Jupiter's own read of
       * the dev wallet's balance against total supply. Real, not derived from
       * a stale price — the field the frontend's `currentHoldingSupplyPct`
       * has been sending `null` for since nothing supplied it.
       */
      devBalancePct: live?.devHoldingsPct ?? (typeof audit?.devBalancePercentage === 'number'
        ? Number(audit.devBalancePercentage.toFixed(4))
        : null),
      // Deliberately empty. See the module header — a deployer timeline needs a
      // signature-history walk, and the previous entries were narrative.
      events: [] as unknown[],
      // Not asserted. This was hardcoded `true` for every token.
      isLpBurned: null,
      // No trust score. "98/100 Tier 1 Verified" was a rating nothing computed.
      trustScore: null,
      coverage:
        'Deployer identity and mint history from Jupiter. Per-wallet transaction timeline is not reconstructed.',
      timestamp: new Date().toISOString(),
    };

    cache.set(address, { at: Date.now(), payload });
    return jsonResponse(payload);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new ApiError('Failed to fetch deployer activity', 500),
    );
  }
}
