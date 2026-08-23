import { NextResponse } from 'next/server';
import { MarketRegimeClassifier, AnalyticsTimeframe } from '@/lib/analytics';
import { getMarketAggregates } from '@/lib/analytics/market-aggregates';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/analytics/market — market regime and volume decomposition.
 *
 * Both halves used to be fabricated. The regime was classified from four
 * literals under a comment reading "aggregate simulated market telemetry", and
 * the decomposition came from `decomposeVolume({ trades: [] })`, which
 * multiplies the total by fixed ratios when it has no trades — 52/48 buy/sell,
 * 18% wash. The Overview's "$110,891,000 · 74.8% organic" was that arithmetic,
 * byte-identical on every request.
 *
 * Both now read `realtime_tokens`. Fields that genuinely cannot be measured
 * from what is stored — creator-linked and insider-linked volume, unique-wallet
 * splits — are `null` instead of a fraction of the total, because a plausible
 * number is harder to catch than a missing one.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeframe = (searchParams.get('timeframe') as AnalyticsTimeframe) || '24h';

  const agg = await getMarketAggregates();

  const regime = MarketRegimeClassifier.classifyRegime({
    activeSolanaVolume24hUsd: agg.totalVolumeUsd ?? 0,
    newMintsCount24h: agg.newMintsCount24h,
    medianPoolDepthUsd: agg.medianPoolDepthUsd ?? 0,
    averageWashTradingPct: agg.washTradingProbabilityPct ?? 0,
    advanceDeclineRatio: agg.advanceDeclineRatio ?? 1,
    solanaPriceChange24hPct: agg.solanaPriceChange24hPct ?? 0,
  });

  return NextResponse.json({
    timeframe,
    marketRegime: {
      ...regime,
      // The measured inputs travel with the verdict, so a caller can see what
      // the classification was based on rather than taking it on faith.
      activeSolanaVolume24hUsd: agg.totalVolumeUsd,
      newMintsCount24h: agg.newMintsCount24h,
      medianPoolDepthUsd: agg.medianPoolDepthUsd,
      averageWashTradingPct: agg.washTradingProbabilityPct,
      advanceDeclineRatio: agg.advanceDeclineRatio,
      solanaPriceChange24hPct: agg.solanaPriceChange24hPct,
      updatedAt: agg.updatedAt,
    },
    volumeDecomposition: {
      timeframe,
      // Measured.
      totalVolumeUsd: agg.totalVolumeUsd,
      buyVolumeUsd: agg.buyVolumeUsd,
      sellVolumeUsd: agg.sellVolumeUsd,
      organicVolumeUsd: agg.organicVolumeUsd,
      organicVolumePct: agg.organicVolumePct,
      suspectedWashVolumeUsd: agg.suspectedWashVolumeUsd,
      washTradingProbabilityPct: agg.washTradingProbabilityPct,
      organicScore: agg.organicVolumePct === null ? null : Math.round(agg.organicVolumePct),
      traderCount24h: agg.traderCount24h,
      // Not measured. Attributing volume to creators, insiders or first-time
      // wallets requires per-trade wallet clustering, which nothing in this
      // table supports. Null until that path exists.
      creatorLinkedVolumeUsd: null,
      insiderLinkedVolumeUsd: null,
      newWalletVolumeUsd: null,
      repeatWalletVolumeUsd: null,
      uniqueBuyerVolumeUsd: null,
      uniqueSellerVolumeUsd: null,
    },
    coverage: {
      tokenCount: agg.tokenCount,
      totalLiquidityUsd: agg.totalLiquidityUsd,
      updatedAt: agg.updatedAt,
    },
    timestamp: new Date().toISOString(),
  });
}
