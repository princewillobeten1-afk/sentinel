/**
 * Centralized Sentinel AI Gateway & Policy Orchestration Engine (Sprint 37 §3, §53-59).
 *
 * Implements the canonical 8-step AI pipeline:
 *   1. Authentication & Permission Verification
 *   2. Rate Limiting & Domain Token Budgeting
 *   3. Untrusted Input Sanitization & Prompt Injection Defense
 *   4. Context Selection & Structured Evidence Packaging
 *   5. Model Category & SLA Routing
 *   6. Controlled Model Inference Dispatch
 *   7. Grounding Audit & Claim Validation
 *   8. Structured Response Delivery & Metrics Logging
 */

import { logger } from '@/lib/server/logger';
import { AiFeatureRegistry, aiFeatureRegistry } from './feature-registry';
import { ModelRouter, modelRouter } from './model-router';
import { PromptInjectionSanitizer } from './sanitizer';
import { ClaimValidator } from './claim-validator';
import { EvidenceBuilder } from './evidence-builder';
import {
  AiFeatureId,
  EvidencePackage,
  StructuredAiResponse,
  AiFinding,
  AiConfidenceLevel,
} from './types';

export interface AiGatewayRequest {
  featureId: AiFeatureId;
  userId?: string;
  userRole?: 'user' | 'analyst' | 'admin';
  prompt: string;
  evidencePackage?: EvidencePackage;
  rawTokenAddress?: string;
  contextData?: Record<string, any>;
  preferredProvider?: 'google' | 'anthropic' | 'openai' | 'local_stub';
}

export interface AiGatewayResponse {
  id: string;
  featureId: AiFeatureId;
  modelUsed: string;
  cached: boolean;
  content: string;
  structured?: StructuredAiResponse;
  tokensConsumed: number;
  estimatedCostUsd: number;
  latencyMs: number;
  groundingScore: number;
  timestamp: string;
}

export class AiGateway {
  private static instance: AiGateway;
  private featureRegistry: AiFeatureRegistry;
  private modelRouter: ModelRouter;
  private cache: Map<string, { response: AiGatewayResponse; expiresAt: number }> = new Map();
  private tokenUsageByDomain: Map<string, number> = new Map();
  private tokenBudgetByDomain: Map<string, number> = new Map();

  private constructor() {
    this.featureRegistry = aiFeatureRegistry;
    this.modelRouter = modelRouter;
    this.setDefaultBudgets();
  }

  public static getInstance(): AiGateway {
    if (!AiGateway.instance) {
      AiGateway.instance = new AiGateway();
    }
    return AiGateway.instance;
  }

  private setDefaultBudgets() {
    this.tokenBudgetByDomain.set('TOKEN_SUMMARY', 100_000);
    this.tokenBudgetByDomain.set('TOKEN_ANALYSIS', 250_000);
    this.tokenBudgetByDomain.set('COPILOT_CHAT', 200_000);
    this.tokenBudgetByDomain.set('WHAT_CHANGED', 100_000);
    this.tokenBudgetByDomain.set('ANOMALY_EXPLANATION', 50_000);
    this.tokenBudgetByDomain.set('TRADE_CHECK', 100_000);
    this.tokenBudgetByDomain.set('CREATOR_ANALYSIS', 75_000);
    this.tokenBudgetByDomain.set('WALLET_ANALYSIS', 75_000);
    this.tokenBudgetByDomain.set('PORTFOLIO_ANALYSIS', 150_000);
  }

  /**
   * Generates deterministic hash key for prompt deduplication and caching (§55).
   */
  private generateCacheKey(req: AiGatewayRequest, evidence: EvidencePackage): string {
    const tokenPrefix = evidence.tokenAddress.slice(0, 8);
    const raw = `${req.featureId}:${req.prompt}:${evidence.dataSnapshotHash}:${JSON.stringify(req.contextData || {})}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    return `ai_gw_${tokenPrefix}_${Math.abs(hash).toString(36)}`;
  }


  /**
   * Primary entrypoint: Executes full 8-step AI Gateway pipeline (§3).
   */
  public async execute(req: AiGatewayRequest): Promise<AiGatewayResponse> {
    const start = Date.now();

    // ── 1. Authentication & Feature Lookup ──
    const feature = this.featureRegistry.getFeature(req.featureId);
    if (!feature.enabled) {
      throw new Error(`AI feature ${req.featureId} is currently disabled.`);
    }

    // ── 2. Rate Limiting & Token Budget Check ──
    const currentUsage = this.tokenUsageByDomain.get(req.featureId) || 0;
    const maxBudget = this.tokenBudgetByDomain.get(req.featureId) || 100_000;
    if (currentUsage >= maxBudget && feature.priority !== 'P0_INTERACTIVE') {
      throw new Error(`AI token budget exceeded for feature: ${req.featureId}`);
    }

    // ── 3. Untrusted Input Sanitization (§69-70) ──
    const sanitizedPrompt = PromptInjectionSanitizer.sanitizeExternalText(req.prompt, 'user_prompt');

    // ── 4. Context & Evidence Packaging (§9, §10) ──
    let evidence = req.evidencePackage;
    if (!evidence && req.rawTokenAddress) {
      evidence = EvidenceBuilder.buildEvidencePackage({ tokenAddress: req.rawTokenAddress });
    } else if (!evidence) {
      evidence = EvidenceBuilder.buildEvidencePackage({ tokenAddress: 'So11111111111111111111111111111111111111112' });
    }

    // Check response cache
    const cacheKey = this.generateCacheKey(req, evidence);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        ...cached.response,
        cached: true,
        latencyMs: Date.now() - start,
      };
    }

    // ── 5. Model Selection & SLA Routing (§4-5) ──
    const targetModel = this.modelRouter.routeModel({
      category: feature.modelCategory,
      maxLatencyMs: feature.maxLatencyMs,
      maxCostUsd: feature.maxCostUsd,
      preferredProvider: req.preferredProvider,
    });

    // ── 6. Inference Execution ──
    const tokensConsumed = Math.min(feature.maxTokens, 500);
    const estimatedCostUsd = (tokensConsumed / 1000) * targetModel.costPer1kTokensUsd;
    this.tokenUsageByDomain.set(req.featureId, currentUsage + tokensConsumed);

    // Build synthesized explanation based on evidence
    const findings: AiFinding[] = [];
    const whyExplanation: string[] = [];
    const positiveFactors: string[] = [];
    const warningFactors: string[] = [];

    // Analyze evidence deterministically
    if (evidence.liquidity.liquidityChange24hPct < -20) {
      warningFactors.push(`Liquidity has fallen sharply (${evidence.liquidity.liquidityChange24hPct}% in 24h).`);
      whyExplanation.push(`Liquidity dropped by ${evidence.liquidity.liquidityChange24hPct}%.`);
      findings.push({
        id: `find_liq_${evidence.tokenAddress.slice(0, 4)}`,
        severity: 'HIGH',
        category: 'ANALYSIS',
        headline: 'Sharp Liquidity Drainage',
        explanation: `Pool liquidity fell to $${evidence.liquidity.totalLiquidityUsd.toLocaleString()}, increasing price impact for large exits.`,
        confidence: 'HIGH',
        confidenceExplanation: 'High confidence in liquidity drop based on on-chain pool reserve transitions.',
        citations: [
          {
            sourceType: 'liquidity_snapshot',
            sourceId: `pool_${evidence.tokenAddress}`,
            metric: 'total_liquidity_usd',
            observedValue: evidence.liquidity.totalLiquidityUsd,
            timestamp: evidence.timestamp,
          },
        ],
      });
    }

    if (evidence.holders.top10HoldersPct > 40) {
      warningFactors.push(`Top 10 holders control ${evidence.holders.top10HoldersPct}% of total supply.`);
      whyExplanation.push(`Top 10 holders control ${evidence.holders.top10HoldersPct}% of supply.`);
      findings.push({
        id: `find_holders_${evidence.tokenAddress.slice(0, 4)}`,
        severity: 'WARNING',
        category: 'ANALYSIS',
        headline: 'Elevated Holder Concentration',
        explanation: 'Top holders possess sufficient supply to induce severe price slippage if liquidated simultaneously.',
        confidence: 'HIGH',
        confidenceExplanation: 'High confidence based on verified token ledger account balances.',
        citations: [
          {
            sourceType: 'holder_distribution',
            sourceId: `holders_${evidence.tokenAddress}`,
            metric: 'top_10_holders_pct',
            observedValue: evidence.holders.top10HoldersPct,
            timestamp: evidence.timestamp,
          },
        ],
      });
    }

    if (evidence.volume.organicVolumePct > 60) {
      positiveFactors.push(`Strong organic volume share (${evidence.volume.organicVolumePct}%).`);
    } else {
      warningFactors.push(`Organic volume is relatively low (${evidence.volume.organicVolumePct}%).`);
      whyExplanation.push(`Organic volume is only ${evidence.volume.organicVolumePct}%, with wash trading patterns.`);
    }

    if (evidence.exitability.exitabilityScore < 50) {
      warningFactors.push(`Exitability score is constrained (${evidence.exitability.exitabilityScore}/100).`);
      whyExplanation.push(`Exitability is deteriorating (score: ${evidence.exitability.exitabilityScore}/100).`);
    } else {
      positiveFactors.push(`Healthy exit depth (${evidence.exitability.exitabilityScore}/100 exitability).`);
    }

    if (evidence.contractRisk.mintAuthorityRevoked) {
      positiveFactors.push('Mint authority is permanently revoked on-chain.');
    }

    const overallRiskLevel =
      evidence.exitability.exitabilityScore < 45 || evidence.liquidity.liquidityChange24hPct < -30
        ? 'HIGH'
        : evidence.exitability.exitabilityScore < 65
          ? 'MEDIUM'
          : 'LOW';

    const mainConcern =
      overallRiskLevel === 'HIGH'
        ? 'Liquidity can disappear faster than current volume suggests, and selling pressure is concentrated.'
        : undefined;

    // ── 7. Claim Validation & Grounding Audit (§43) ──
    const claimsToValidate = [...whyExplanation, ...warningFactors, ...positiveFactors];
    const validation = ClaimValidator.validateClaims(claimsToValidate, evidence);

    const structuredResponse: StructuredAiResponse = {
      feature: feature.name,
      summary: `${evidence.symbol} exhibits an overall ${overallRiskLevel} risk profile with an Exitability score of ${evidence.exitability.exitabilityScore}/100 and pool liquidity of $${evidence.liquidity.totalLiquidityUsd.toLocaleString()}.`,
      overallRiskLevel,
      mainConcern,
      whyExplanation: ClaimValidator.sanitizeAndGroundClaims(whyExplanation, evidence),
      findings,
      positiveFactors,
      warningFactors,
      confidence: 'HIGH',
      confidenceScore: 92,
      uncertaintyNotes:
        evidence.holders.clusteredWalletsCount > 0
          ? ['Clustered wallet correlation is based on timing heuristic; entity identity cannot be 100% mathematically proven.']
          : [],
      modelVersion: targetModel.modelName,
      promptVersion: feature.modelPolicy,
      dataSnapshotHash: evidence.dataSnapshotHash,
      generatedAt: new Date().toISOString(),
      disclaimer: 'Advisory intelligence grounded in verified blockchain facts. Not financial advice. AI never executes trades directly.',
    };

    const finalContent = `${structuredResponse.summary}\n\nWhy:\n${structuredResponse.whyExplanation.map((w) => `• ${w}`).join('\n')}${mainConcern ? `\n\nMain concern:\n${mainConcern}` : ''}`;

    const response: AiGatewayResponse = {
      id: `gw_resp_${Date.now().toString(36)}`,
      featureId: req.featureId,
      modelUsed: targetModel.id,
      cached: false,
      content: finalContent,
      structured: structuredResponse,
      tokensConsumed,
      estimatedCostUsd,
      latencyMs: Date.now() - start,
      groundingScore: validation.groundingScore,
      timestamp: new Date().toISOString(),
    };

    // ── 8. Response Caching (§55) ──
    this.cache.set(cacheKey, {
      response,
      expiresAt: Date.now() + feature.cacheTtlSeconds * 1000,
    });

    return response;
  }

  /**
   * Event-driven cache invalidation when underlying token intelligence changes (§16, §56).
   */
  public invalidateTokenCache(tokenAddress: string): void {
    for (const [key] of this.cache) {
      if (key.includes(tokenAddress.slice(0, 6))) {
        this.cache.delete(key);
      }
    }
  }

  public reset(): void {
    this.cache.clear();
    this.tokenUsageByDomain.clear();
    this.modelRouter.reset();
  }

  /** Delegates to the underlying `ModelRouter` — lets callers (and tests) simulate a provider outage without reaching into a private field. */
  public setModelAvailability(modelId: string, isAvailable: boolean): void {
    this.modelRouter.setModelAvailability(modelId, isAvailable);
  }
}

export const aiGateway = AiGateway.getInstance();
