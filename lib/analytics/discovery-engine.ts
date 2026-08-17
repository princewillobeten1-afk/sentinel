/**
 * Multi-Mode Token Discovery & Composite Ranking Engine (Sprint 38 §38-40).
 *
 * Avoids single universal rankings by supporting diverse trader opportunity modes:
 *   - TRENDING
 *   - SAFEST
 *   - FASTEST_GROWTH
 *   - HIGHEST_ORGANIC_VOLUME
 *   - BEST_EXITABILITY
 *   - NEW_LAUNCHES
 *   - SMART_MONEY
 *   - HIGH_CONVICTION
 *   - UNDERVALUED_SIGNALS
 */

import { DiscoveryRankingMode, DiscoveryTokenRankItem } from './types';

export interface TokenDiscoveryCandidate {
  tokenAddress: string;
  symbol: string;
  name: string;
  priceUsd: number;
  marketCapUsd: number;
  volume24hUsd: number;
  priceChange24hPct: number;
  organicVolumePct: number;
  exitabilityScore: number;
  liquidityHealthScore: number;
  creatorReputationScore: number;
  holderGrowth24hPct: number;
  smartMoneyInflowUsd?: number;
  riskPenaltyPoints?: number;
}

export class DiscoveryEngine {
  /**
   * Ranks token discovery candidates according to selected discovery mode.
   */
  public static rankCandidates(params: {
    candidates: TokenDiscoveryCandidate[];
    mode: DiscoveryRankingMode;
    limit?: number;
  }): DiscoveryTokenRankItem[] {
    const { candidates, mode, limit = 20 } = params;

    const scored = candidates.map((c) => {
      let compositeScore = 0;
      const riskFlags: string[] = [];

      if (c.exitabilityScore < 45) riskFlags.push('Low Exitability');
      if (c.organicVolumePct < 40) riskFlags.push('High Wash Trading');
      if (c.creatorReputationScore < 30) riskFlags.push('Creator Prior Drains');

      switch (mode) {
        case 'SAFEST':
          // Prioritize high exitability, creator reputation, and liquidity health
          compositeScore =
            c.exitabilityScore * 0.35 +
            c.creatorReputationScore * 0.35 +
            c.liquidityHealthScore * 0.2 +
            c.organicVolumePct * 0.1 -
            (c.riskPenaltyPoints || 0);
          break;

        case 'HIGHEST_ORGANIC_VOLUME':
          compositeScore =
            c.organicVolumePct * 0.5 +
            (c.volume24hUsd > 100000 ? 25 : 10) +
            c.exitabilityScore * 0.25;
          break;

        case 'BEST_EXITABILITY':
          compositeScore = c.exitabilityScore * 0.7 + c.liquidityHealthScore * 0.3;
          break;

        case 'SMART_MONEY':
          compositeScore =
            (c.smartMoneyInflowUsd ? Math.min(50, c.smartMoneyInflowUsd / 1000) : 0) +
            c.organicVolumePct * 0.3 +
            c.exitabilityScore * 0.2;
          break;

        case 'FASTEST_GROWTH':
          compositeScore =
            c.holderGrowth24hPct * 0.4 +
            c.priceChange24hPct * 0.4 +
            c.organicVolumePct * 0.2;
          break;

        case 'TRENDING':
        default:
          // Composite balanced formula (§38)
          compositeScore =
            (c.priceChange24hPct > 0 ? Math.min(30, c.priceChange24hPct * 0.5) : 0) +
            c.organicVolumePct * 0.25 +
            c.liquidityHealthScore * 0.2 +
            c.creatorReputationScore * 0.15 +
            c.exitabilityScore * 0.2 -
            (c.riskPenaltyPoints || 0);
          break;
      }

      return {
        tokenAddress: c.tokenAddress,
        symbol: c.symbol,
        name: c.name,
        priceUsd: c.priceUsd,
        marketCapUsd: c.marketCapUsd,
        volume24hUsd: c.volume24hUsd,
        organicVolumePct: c.organicVolumePct,
        exitabilityScore: c.exitabilityScore,
        liquidityHealthScore: c.liquidityHealthScore,
        creatorReputationScore: c.creatorReputationScore,
        compositeDiscoveryScore: Number(compositeScore.toFixed(1)),
        rankMode: mode,
        riskFlags,
      };
    });

    // Sort descending by composite discovery score
    scored.sort((a, b) => b.compositeDiscoveryScore - a.compositeDiscoveryScore);

    return scored.slice(0, limit);
  }
}
