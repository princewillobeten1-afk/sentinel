import { PublicKey } from '@solana/web3.js';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { fetchJupiterTokensByMint, mapJupiterToken } from '@/lib/discovery/jupiter-feed';
import { mergeTokenCardSnapshot } from '@/lib/discovery/card-snapshot';
import { fetchDexPaidStatus } from '@/lib/discovery/dexscreener-orders';
import { getTokenCardPatch, hydrateTokenCards } from '@/lib/market/live/card-cache';
import { queueAudit } from '@/lib/market/enrichment/audit-worker';
import { queueSecurityTarget } from '@/lib/market/enrichment/security-worker';
import type { TradeSidebarSnapshot } from '@/lib/trading/sidebar-model';
import { queueSidebarEnrichment } from '@/lib/trading/sidebar-enrichment';
import { getLiquidityLock } from '@/lib/trading/rugcheck-liquidity';

export const dynamic = 'force-dynamic';
const snapshots = new Map<string, { at: number; data: TradeSidebarSnapshot }>();

export async function GET(_request: Request, { params }: { params: { chain: string; address: string } }) {
  try {
    if (params.chain !== 'solana') throw new ApiError('Only Solana token cards are supported', 400);
    let mint: string;
    try { mint = new PublicKey(params.address).toBase58(); } catch { throw new ApiError('Invalid mint address', 400); }
    queueAudit([mint]);
    queueSecurityTarget(mint);
    await hydrateTokenCards([mint]);
    const cached = snapshots.get(mint);
    let data: TradeSidebarSnapshot;
    if (cached && Date.now() - cached.at < 15_000) data = cached.data;
    else {
      const [tokensResult, paidResult, lockResult] = await Promise.allSettled([
        fetchJupiterTokensByMint([mint]),
        fetchDexPaidStatus(mint),
        getLiquidityLock(mint),
      ]);
      const tokens = tokensResult.status === 'fulfilled' ? tokensResult.value : [];
      const paid = paidResult.status === 'fulfilled' ? paidResult.value : null;
      const lock = lockResult.status === 'fulfilled' ? lockResult.value : null;
      const token = tokens.find(token => token.id === mint);
      const mapped = token ? mapJupiterToken(token) : null;
      const extras = queueSidebarEnrichment(mint, mapped?.devAddress, mapped?.logoURI);
      const activityMeasured = token?.stats5m && [token.stats5m.buyVolume, token.stats5m.sellVolume, token.stats5m.numBuys, token.stats5m.numSells]
        .some(value => typeof value === 'number' && Number.isFinite(value));
      const observedAt = new Date().toISOString();
      data = {
        ...(mapped ?? {}), mint,
        buyVolume5mUsd: token?.stats5m?.buyVolume ?? null,
        sellVolume5mUsd: token?.stats5m?.sellVolume ?? null,
        ...(activityMeasured ? { activityEvidence: {
          status: 'measured' as const,
          source: 'jupiter-token-api:5m',
          observedAt,
          expiresAt: new Date(Date.now() + 30_000).toISOString(),
        } } : {}),
        isDexPaid: paid?.isDexPaid,
        ...(lock ? { lpLockedPct: lock.lpLockedPct, liquidityEvidence: lock.evidence } : {}),
        ...extras,
      };
      if (snapshots.size >= 200) snapshots.delete(snapshots.keys().next().value!);
      snapshots.set(mint, { at: Date.now(), data });
    }
    const patch = getTokenCardPatch(mint);
    const merged = patch ? mergeTokenCardSnapshot(data as import('@/lib/discovery/types').DiscoveryToken, patch) : data;
    return jsonResponse({ token: { ...data, ...merged } });
  } catch (error) { return errorResponse(error instanceof Error ? error : new ApiError('Token card unavailable', 500)); }
}
