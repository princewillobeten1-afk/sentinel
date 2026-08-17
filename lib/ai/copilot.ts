/**
 * Context-Aware Trader Copilot, Pre-Trade Check & Discovery Assistant (Sprint 37 §21-24, §30-31).
 *
 * Implements:
 *   1. Context-Aware Inquiries (Automatically knows active token/wallet from screen context)
 *   2. Multi-Token Comparison ("Compare these tokens on exitability and holder risk")
 *   3. Pre-Trade Risk Check & Human Confirmation Enforcer (§23-24, §72-73)
 *   4. Natural Language Search to Deterministic Filter Translator (§30)
 */

import {
  CopilotContext,
  EvidencePackage,
  PreTradeCheckRequest,
  PreTradeCheckResult,
  SearchFilterTranslation,
  StructuredAiResponse,
} from './types';
import { aiGateway } from './gateway';
import { EvidenceBuilder } from './evidence-builder';

export class TraderCopilot {
  /**
   * Evaluates contextual queries considering active page and token context (§21-22).
   */
  public static async handleContextualQuery(params: {
    query: string;
    context: CopilotContext;
    evidenceOverride?: EvidencePackage;
  }): Promise<StructuredAiResponse> {
    const { query, context } = params;

    // 1. Resolve active token
    const tokenAddress = context.activeTokenAddress || 'So11111111111111111111111111111111111111112';
    const evidence = params.evidenceOverride || EvidenceBuilder.buildEvidencePackage({ tokenAddress });

    const qLower = query.toLowerCase();

    // 2. Dispatch to appropriate feature
    if (qLower.includes('compare') || qLower.includes('versus') || qLower.includes('vs')) {
      const res = await aiGateway.execute({
        featureId: 'COPILOT_COMPARE',
        prompt: `Compare token ${evidence.symbol} against peers on exitability, holder concentration, and organic volume.`,
        evidencePackage: evidence,
      });
      return res.structured!;
    }

    const res = await aiGateway.execute({
      featureId: 'COPILOT_CHAT',
      prompt: `[CONTEXT: Page=${context.activePage || 'trade'}, Token=${evidence.symbol}] User asked: "${query}"`,
      evidencePackage: evidence,
    });

    return res.structured!;
  }

  /**
   * Pre-Trade Advisory Risk Check (§23-24, §72-73).
   * Note: NEVER automatically signs or executes. Explicitly mandates human confirmation.
   */
  public static evaluateTradeCheck(
    req: PreTradeCheckRequest,
    evidence: EvidencePackage
  ): PreTradeCheckResult {
    const warnings: string[] = [];
    const positives: string[] = [];
    const conflictDetails: string[] = [];

    // Calculate approximate price impact
    const baseLiq = evidence.liquidity.totalLiquidityUsd || 100_000;
    const impactRatio = (req.orderSizeUsd / (baseLiq * 0.5)) * 100;
    const estimatedPriceImpactPct = Number(Math.max(0.1, Math.min(99.0, impactRatio * 1.5)).toFixed(2));

    // Evaluate against token metrics
    if (estimatedPriceImpactPct > req.maxSlippagePct) {
      warnings.push(`Estimated price impact (${estimatedPriceImpactPct}%) exceeds configured max slippage (${req.maxSlippagePct}%).`);
    }

    if (evidence.exitability.exitabilityScore < 50) {
      warnings.push(`Token Exitability Score is low (${evidence.exitability.exitabilityScore}/100) — selling this position later may incur substantial slippage.`);
    } else {
      positives.push(`Exitability score is healthy (${evidence.exitability.exitabilityScore}/100).`);
    }

    if (evidence.holders.top10HoldersPct > 45) {
      warnings.push(`Top 10 holders control ${evidence.holders.top10HoldersPct}% of circulating supply.`);
    }

    if (evidence.volume.organicVolumePct > 60) {
      positives.push(`Organic volume is strong at ${evidence.volume.organicVolumePct}%.`);
    }

    // Evaluate personalized profile rules (§25-26)
    let conflictsWithPersonalRule = false;
    if (req.userProfile === 'CONSERVATIVE') {
      if (evidence.exitability.exitabilityScore < 60) {
        conflictsWithPersonalRule = true;
        conflictDetails.push('Conservative profile requires minimum exitability score of 60 (observed: ' + evidence.exitability.exitabilityScore + ').');
      }
      if (evidence.holders.top10HoldersPct > 35) {
        conflictsWithPersonalRule = true;
        conflictDetails.push('Conservative profile requires top 10 holders under 35% (observed: ' + evidence.holders.top10HoldersPct + '%).');
      }
    }

    const riskLevel: PreTradeCheckResult['riskLevel'] =
      warnings.length >= 2 || conflictsWithPersonalRule
        ? 'HIGH'
        : warnings.length === 1
          ? 'MEDIUM'
          : 'LOW';

    const summary = `TRADE CHECK: ${req.tradeType} $${req.orderSizeUsd.toLocaleString()} of ${evidence.symbol} | Risk: ${riskLevel} | Est. Impact: ${estimatedPriceImpactPct}% | Exitability: ${evidence.exitability.exitabilityScore}/100.`;

    return {
      allowedAdvisory: !conflictsWithPersonalRule,
      riskLevel,
      estimatedPriceImpactPct,
      liquidityUsd: evidence.liquidity.totalLiquidityUsd,
      exitabilityScore: evidence.exitability.exitabilityScore,
      conflictsWithPersonalRule,
      conflictDetails: conflictDetails.length > 0 ? conflictDetails : undefined,
      warnings,
      positives,
      summary,
      requiresExplicitConfirmation: true, // Structural guarantee
    };
  }

  /**
   * Translates natural language search queries into deterministic filters (§30).
   */
  public static translateSearchQuery(rawQuery: string): SearchFilterTranslation {
    const lower = rawQuery.toLowerCase();
    const filters: SearchFilterTranslation['filters'] = {};
    const rankingCriteria: string[] = [];

    // Parse Liquidity
    const liqMatch = lower.match(/(at\s+least|\>|over|min(imum)?)\s*\$?([0-9]+)k?/i);
    if (liqMatch) {
      const num = parseInt(liqMatch[3], 10);
      filters.minLiquidityUsd = lower.includes('k') ? num * 1000 : num >= 1000 ? num : num * 1000;
    } else if (lower.includes('liquid') || lower.includes('liquidity')) {
      filters.minLiquidityUsd = 50_000;
    }

    // Parse Age / New launches
    if (lower.includes('new') || lower.includes('recent') || lower.includes('just launched')) {
      filters.maxAgeHours = 24;
      rankingCriteria.push('launch_time_desc');
    }

    // Parse Organic Volume
    if (lower.includes('organic') || lower.includes('real volume')) {
      filters.minOrganicVolumePct = 60;
      rankingCriteria.push('organic_volume_desc');
    }

    // Parse Insider / Safe
    if (lower.includes('safe') || lower.includes('low risk') || lower.includes('low insider')) {
      filters.maxInsiderConcentrationPct = 30;
      filters.minExitabilityScore = 60;
      filters.maxRiskScore = 40;
      rankingCriteria.push('exitability_desc');
    }

    return {
      rawQuery,
      interpretedIntent: `Filtered discovery search with criteria: ${Object.entries(filters).map(([k, v]) => `${k}=${v}`).join(', ') || 'standard parameters'}`,
      filters,
      rankingCriteria: rankingCriteria.length > 0 ? rankingCriteria : ['volume_24h_desc'],
      confidence: 'HIGH',
    };
  }
}
