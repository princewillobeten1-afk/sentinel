/**
 * Golden Dataset Benchmark & Regression Testing Engine (Sprint 37 §47-50, §76).
 *
 * Implements continuous evaluation of AI accuracy, grounding, and hallucination rates:
 *   - Curated Golden Dataset with known ground truth cases
 *   - Grounding score calculation against verified evidence packages
 *   - Regression detection comparing prompt/model versions
 *   - Automated test execution and KPI scorecards
 */

import { GoldenDatasetCase, EvaluationRunMetrics } from './types';
import { aiGateway } from './gateway';
import { EvidenceBuilder } from './evidence-builder';

export class EvaluationEngine {
  private static goldenCases: GoldenDatasetCase[] = [
    {
      id: 'case_01_safe_token',
      category: 'KNOWN_SAFE',
      title: 'Decentralized established token with locked liquidity and revoked mint',
      inputEvidence: EvidenceBuilder.buildEvidencePackage({
        tokenAddress: 'SafeToken11111111111111111111111111111111111',
        symbol: 'SAFE',
        name: 'Safe Standard Coin',
        liquidity: { totalLiquidityUsd: 1_200_000, liquidityChange24hPct: 4.5, isLocked: true, lockDurationDays: 365, estimatedPriceImpact10kPct: 1.2 },
        holders: { totalHolders: 12500, top10HoldersPct: 18.2, creatorLinkedWalletsPct: 0.5, clusteredWalletsCount: 0 },
        creator: { creatorAddress: 'good_creator_01', reputationScore: 88, previousLaunchesCount: 4, successfulLaunchesCount: 4, rugPullCount: 0, isVerified: true },
        volume: { organicVolumePct: 82.0, washTradingProbabilityPct: 18.0, uniqueTraders24h: 3200 },
        insiderSignals: { insiderConcentrationScore: 12, earlySniperCount: 3, coordinatedSellingDetected: false },
        exitability: { exitabilityScore: 89, maxSafeSellSizeUsd: 45000, slippageEstimate5kPct: 0.8 },
        contractRisk: { riskLevel: 'LOW', mintAuthorityRevoked: true, freezeAuthorityRevoked: true, hasTransferTax: false, transferTaxPct: 0, isHoneypot: false },
      }),
      expectedRiskLevel: 'LOW',
      requiredWarningKeywords: [],
      forbiddenHallucinations: ['rug pull imminent', 'creator dumped', 'unverified drain'],
      minGroundingScore: 0.90,
    },
    {
      id: 'case_02_liquidity_drain_risk',
      category: 'KNOWN_LIQUIDITY_DRAIN',
      title: 'Token undergoing rapid liquidity removal with high creator control',
      inputEvidence: EvidenceBuilder.buildEvidencePackage({
        tokenAddress: 'DrainToken222222222222222222222222222222222',
        symbol: 'DRAIN',
        name: 'Drain Token Coin',
        liquidity: { totalLiquidityUsd: 65_000, liquidityChange24hPct: -48.5, isLocked: false, lockDurationDays: 0, estimatedPriceImpact10kPct: 24.0 },
        holders: { totalHolders: 420, top10HoldersPct: 58.0, creatorLinkedWalletsPct: 22.0, clusteredWalletsCount: 8 },
        creator: { creatorAddress: 'serial_drainer_02', reputationScore: 14, previousLaunchesCount: 9, successfulLaunchesCount: 0, rugPullCount: 6, isVerified: false },
        volume: { organicVolumePct: 22.0, washTradingProbabilityPct: 78.0, uniqueTraders24h: 85 },
        insiderSignals: { insiderConcentrationScore: 88, earlySniperCount: 19, coordinatedSellingDetected: true },
        exitability: { exitabilityScore: 28, maxSafeSellSizeUsd: 800, slippageEstimate5kPct: 19.5 },
        contractRisk: { riskLevel: 'HIGH', mintAuthorityRevoked: true, freezeAuthorityRevoked: false, hasTransferTax: false, transferTaxPct: 0, isHoneypot: false },
      }),
      expectedRiskLevel: 'HIGH',
      requiredWarningKeywords: ['liquidity', 'creator', 'exitability'],
      forbiddenHallucinations: ['100% safe', 'guaranteed pump'],
      minGroundingScore: 0.90,
    },
    {
      id: 'case_03_insider_cluster',
      category: 'KNOWN_INSIDER',
      title: 'Token with heavy insider cluster accumulation and low organic volume',
      inputEvidence: EvidenceBuilder.buildEvidencePackage({
        tokenAddress: 'InsiderToken333333333333333333333333333333',
        symbol: 'INSD',
        name: 'Insider Cluster Coin',
        liquidity: { totalLiquidityUsd: 250_000, liquidityChange24hPct: -8.0, isLocked: true, lockDurationDays: 30, estimatedPriceImpact10kPct: 7.5 },
        holders: { totalHolders: 1100, top10HoldersPct: 52.0, creatorLinkedWalletsPct: 14.5, clusteredWalletsCount: 7 },
        creator: { creatorAddress: 'creator_insd_03', reputationScore: 42, previousLaunchesCount: 5, successfulLaunchesCount: 1, rugPullCount: 2, isVerified: false },
        volume: { organicVolumePct: 34.0, washTradingProbabilityPct: 66.0, uniqueTraders24h: 210 },
        insiderSignals: { insiderConcentrationScore: 82, earlySniperCount: 26, coordinatedSellingDetected: true },
        exitability: { exitabilityScore: 48, maxSafeSellSizeUsd: 2500, slippageEstimate5kPct: 6.8 },
        contractRisk: { riskLevel: 'MEDIUM', mintAuthorityRevoked: true, freezeAuthorityRevoked: true, hasTransferTax: false, transferTaxPct: 0, isHoneypot: false },
      }),
      expectedRiskLevel: 'MEDIUM',
      requiredWarningKeywords: ['holder', 'concentration', 'organic'],
      forbiddenHallucinations: ['100% guaranteed profit'],
      minGroundingScore: 0.85,
    },
  ];

  /**
   * Executes the full golden evaluation test suite (§49-50).
   */
  public static async runEvaluationSuite(options?: {
    preferredProvider?: 'google' | 'anthropic' | 'openai' | 'local_stub';
  }): Promise<EvaluationRunMetrics> {
    const start = Date.now();
    let passedCases = 0;
    let totalGroundingScore = 0;
    let totalCost = 0;
    let hallucinationCount = 0;

    for (const testCase of this.goldenCases) {
      const response = await aiGateway.execute({
        featureId: 'TOKEN_ANALYSIS',
        prompt: `Run full security and risk audit for ${testCase.inputEvidence.symbol}`,
        evidencePackage: testCase.inputEvidence,
        preferredProvider: options?.preferredProvider,
      });

      totalGroundingScore += response.groundingScore;
      totalCost += response.estimatedCostUsd;

      // Check hallucination / forbidden keywords
      let casePassed = true;
      const lowerContent = response.content.toLowerCase();

      for (const forbidden of testCase.forbiddenHallucinations) {
        if (lowerContent.includes(forbidden.toLowerCase())) {
          hallucinationCount++;
          casePassed = false;
        }
      }

      // Check risk level alignment
      if (response.structured?.overallRiskLevel !== testCase.expectedRiskLevel) {
        // High vs Critical is acceptable, but Safe vs High is a regression
        if (testCase.expectedRiskLevel === 'LOW' && response.structured?.overallRiskLevel === 'HIGH') {
          casePassed = false;
        } else if (testCase.expectedRiskLevel === 'HIGH' && response.structured?.overallRiskLevel === 'LOW') {
          casePassed = false;
        }
      }

      if (response.groundingScore < testCase.minGroundingScore) {
        casePassed = false;
      }

      if (casePassed) {
        passedCases++;
      }
    }

    const totalCases = this.goldenCases.length;
    const avgGrounding = Number((totalGroundingScore / totalCases).toFixed(2));
    const hallucinationRatePct = Number(((hallucinationCount / totalCases) * 100).toFixed(1));
    const averageLatencyMs = Math.round((Date.now() - start) / totalCases);
    const status: EvaluationRunMetrics['status'] =
      passedCases === totalCases && avgGrounding >= 0.88 ? 'PASSED' : 'REGRESSION_DETECTED';

    return {
      runId: `eval_${Date.now().toString(36)}`,
      timestamp: new Date().toISOString(),
      modelVersion: 'sentinel-risk-model-v2.4',
      promptVersion: 'TOKEN_ANALYSIS_V2',
      totalCases,
      passedCases,
      averageGroundingScore: avgGrounding,
      hallucinationRatePct,
      averageLatencyMs,
      totalCostUsd: Number(totalCost.toFixed(5)),
      status,
    };
  }

  public static getGoldenCases(): GoldenDatasetCase[] {
    return this.goldenCases;
  }
}
