import { PublicKey } from '@solana/web3.js';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { fetchJupiterTokensByMint, mapJupiterToken } from '@/lib/discovery/jupiter-feed';
import { mergeTokenCardSnapshot } from '@/lib/discovery/card-snapshot';
import { fetchDexPaidStatus } from '@/lib/discovery/dexscreener-orders';
import { getTokenCardPatch, hydrateTokenCards } from '@/lib/market/live/card-cache';
import { queueAudit, ensureAudit } from '@/lib/market/enrichment/audit-worker';
import { queueSecurityTarget } from '@/lib/market/enrichment/security-worker';
import type { TradeSidebarSnapshot } from '@/lib/trading/sidebar-model';
import { queueSidebarEnrichment, enrichSidebar } from '@/lib/trading/sidebar-enrichment';
import { getLiquidityLock } from '@/lib/trading/rugcheck-liquidity';

export const dynamic = 'force-dynamic';
const snapshots = new Map<string, { at: number; data: TradeSidebarSnapshot }>();

export async function GET(
  _request: Request,
  context: { params: { chain: string; address: string } | Promise<{ chain: string; address: string }> }
) {
  try {
    const params = await Promise.resolve(context.params);
    if (params.chain !== 'solana') throw new ApiError('Only Solana token cards are supported', 400);
    let mint: string;
    try { mint = new PublicKey(params.address).toBase58(); } catch { throw new ApiError('Invalid mint address', 400); }
    queueAudit([mint]);
    queueSecurityTarget(mint);
    await hydrateTokenCards([mint]);
    const cached = snapshots.get(mint);
    let data: TradeSidebarSnapshot;
    let jupTop10: number | undefined;
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
      jupTop10 = token?.audit?.topHoldersPercentage;
      let mapped = token ? mapJupiterToken(token) : null;

      if (!mapped) {
        try {
          const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
            signal: AbortSignal.timeout(3500),
            cache: 'no-store',
          });
          if (dexRes.ok) {
            const dexData = await dexRes.json();
            const pair = Array.isArray(dexData?.pairs) && dexData.pairs.length > 0
              ? dexData.pairs.reduce((prev: any, curr: any) => ((curr.volume?.h24 ?? 0) > (prev.volume?.h24 ?? 0) ? curr : prev))
              : null;
            if (pair) {
              const priceUsd = pair.priceUsd ? String(pair.priceUsd) : undefined;
              const mcapUsd = pair.marketCap ? String(pair.marketCap) : pair.fdv ? String(pair.fdv) : undefined;
              const liqUsd = pair.liquidity?.usd ? String(pair.liquidity.usd) : undefined;
              mapped = {
                id: mint,
                mint,
                name: pair.baseToken?.name || mint.slice(0, 6),
                symbol: pair.baseToken?.symbol || mint.slice(0, 4).toUpperCase(),
                chain: 'solana',
                source: pair.dexId || 'DexScreener',
                priceUsd,
                marketCapUsd: mcapUsd,
                liquidityUsd: liqUsd,
                volume24hUsd: pair.volume?.h24 ? String(pair.volume.h24) : undefined,
                volume5mUsd: pair.volume?.m5 ? String(pair.volume.m5) : undefined,
                buysCount5m: pair.txns?.m5?.buys,
                sellsCount5m: pair.txns?.m5?.sells,
                logoURI: pair.info?.imageUrl,
                liquidityPoolAddress: pair.pairAddress,
                marketEvidence: {
                  status: 'measured',
                  source: 'dexscreener-api',
                  observedAt: new Date().toISOString(),
                },
              } as any;
            }
          }
        } catch {
          // Degrades gracefully
        }
      }

      let auditFields: Partial<TradeSidebarSnapshot> = {};
      if (typeof ensureAudit === 'function') {
        const auditProfile = await ensureAudit(mint, mapped?.devAddress, token?.audit?.topHoldersPercentage);
        if (auditProfile) {
          const totalHolders = auditProfile.totalHolders ?? mapped?.holdersCount;
          const clampHolders = (c: number | null | undefined) => typeof c === 'number' && typeof totalHolders === 'number' ? Math.min(c, totalHolders) : (c ?? null);
          let top10Pct = auditProfile.top10Pct;
          const jupTop10 = token?.audit?.topHoldersPercentage;
          if ((mapped?.bondingStatus === 'bonding' || mint.endsWith('pump')) && typeof jupTop10 === 'number' && jupTop10 >= 0 && (top10Pct === null || (top10Pct >= 80 && jupTop10 < 80))) {
            top10Pct = Number(jupTop10.toFixed(2));
          }
          auditFields = {
            top10HoldingsPct: top10Pct,
            holdersCount: totalHolders,
            sniperPercentage: auditProfile.snipersPct,
            insiderHoldingsPct: auditProfile.insidersPct,
            bundlerPercentage: auditProfile.bundlersPct,
            devHoldingsPct: auditProfile.devPct ?? mapped?.devHoldingsPct,
            sniperCount: clampHolders(auditProfile.sniperCount),
            bundlerCount: clampHolders(auditProfile.bundlerCount),
            insiderCount: clampHolders(auditProfile.insiderCount),
            devCount: clampHolders(auditProfile.devCount),
            proTradersCount: clampHolders(auditProfile.proTraders),
            kolsCount: clampHolders(auditProfile.kols),
            ownershipEvidence: {
              status: 'measured',
              source: auditProfile.source ?? 'birdeye-holder-profile',
              observedAt: new Date(auditProfile.fetchedAt).toISOString(),
            },
          };
        }
      }

      const extras = typeof enrichSidebar === 'function'
        ? await enrichSidebar(mint, mapped?.devAddress, mapped?.logoURI)
        : queueSidebarEnrichment(mint, mapped?.devAddress, mapped?.logoURI);

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
        isDexPaid: paid?.isDexPaid ?? false,
        ...(lock ? { lpLockedPct: lock.lpLockedPct, liquidityEvidence: lock.evidence } : {}),
        ...extras,
        ...auditFields,
      };
      if (snapshots.size >= 200) snapshots.delete(snapshots.keys().next().value!);
      snapshots.set(mint, { at: Date.now(), data });
    }
    const patch = getTokenCardPatch(mint);
    const merged = patch ? mergeTokenCardSnapshot(data as import('@/lib/discovery/types').DiscoveryToken, patch) : data;
    const finalToken = { ...data, ...merged };
    if ((finalToken.bondingStatus === 'bonding' || mint.endsWith('pump')) && typeof jupTop10 === 'number' && jupTop10 >= 0 && (finalToken.top10HoldingsPct === null || finalToken.top10HoldingsPct === undefined || (finalToken.top10HoldingsPct >= 80 && jupTop10 < 80))) {
      finalToken.top10HoldingsPct = Number(jupTop10.toFixed(2));
    }
    return jsonResponse({ token: finalToken }, 200, { 'Cache-Control': 'no-store' });
  } catch (error) { return errorResponse(error instanceof Error ? error : new ApiError('Token card unavailable', 500)); }
}
