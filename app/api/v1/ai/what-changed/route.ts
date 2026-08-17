import { jsonResponse, errorResponse } from '@/lib/server/api';
import { WhatChangedEngine } from '@/lib/ai/what-changed';
import { EvidenceBuilder } from '@/lib/ai/evidence-builder';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      tokenAddress = 'So11111111111111111111111111111111111111112',
      timeframe = '15m',
      previousSnapshot,
    } = body;

    const currentEvidence = EvidenceBuilder.buildEvidencePackage({ tokenAddress });

    // If no previous snapshot is supplied, simulate an earlier snapshot to observe delta
    const previous = previousSnapshot || {
      liquidity: {
        totalLiquidityUsd: currentEvidence.liquidity.totalLiquidityUsd * 1.25,
        liquidityChange24hPct: currentEvidence.liquidity.liquidityChange24hPct + 15,
      },
      holders: {
        top10HoldersPct: currentEvidence.holders.top10HoldersPct - 4.5,
        creatorLinkedWalletsPct: currentEvidence.holders.creatorLinkedWalletsPct + 2.0,
      },
      volume: {
        uniqueTraders24h: Math.round(currentEvidence.volume.uniqueTraders24h * 0.85),
      },
      exitability: {
        exitabilityScore: currentEvidence.exitability.exitabilityScore + 18,
      },
    };

    const deltaAnalysis = WhatChangedEngine.compareSnapshots({
      previous,
      current: currentEvidence,
      timeframe,
    });

    return jsonResponse({
      type: 'what_changed_analysis',
      analysis: deltaAnalysis,
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err : new Error(String(err)));
  }
}
