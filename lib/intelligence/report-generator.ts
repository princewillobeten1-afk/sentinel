/**
 * Intelligence Report Generator
 *
 * Deterministic report generator.
 * Input: Token + Market Data + Blockchain Data + Holder Data
 * Output: TokenIntelligenceReport
 *
 * The report is reproducible from the same data and methodology version.
 * Every report includes methodologyVersion and dataVersion.
 */

import type {
  InsiderDetectionReport,
  OrganicActivityAssessment,
} from '@/lib/activity/types';

import type {
  TokenIntelligenceReport,
  TokenIdentity,
  IntelligenceSignal,
  MissingDataEntry,
  RiskCategory,
  RiskDimension,
  IntelligenceTimelineEvent,
} from './types';

import {
  analyzeMarketHealth,
  analyzeLiquidity,
  analyzeOwnership,
  analyzeCreator,
  analyzeActivity,
  analyzeContract,
  analyzeExitability,
  evaluateTokenSecurity,
} from './engines';
import type {
  MarketHealthInput,
  LiquidityInput,
  OwnershipInput,
  CreatorInput,
  ActivityInput,
  ContractInput,
  ExitabilityInput,
  TokenSecurityInput,
} from './engines';

import { evaluateRiskRules } from './risk-rules';
import { aggregateScore } from './score-aggregator';
import { computeConfidence } from './confidence-engine';
import { computeDataFreshness } from './freshness';
import { generateExplanation } from './explanation';

const METHODOLOGY_VERSION = 'sentinel-intelligence-v1.0.0';
const DATA_VERSION = 'v1';

export interface ReportInput {
  token: TokenIdentity;
  market?: MarketHealthInput;
  liquidity?: LiquidityInput;
  ownership?: OwnershipInput;
  creator?: CreatorInput;
  activity?: ActivityInput;
  contract?: ContractInput;
  exitability?: ExitabilityInput;
  tokenSecurity?: TokenSecurityInput;
  organicActivity?: OrganicActivityAssessment;
  insiderReport?: InsiderDetectionReport;
  recentTimeline?: IntelligenceTimelineEvent[];
}

/**
 * Generate a complete intelligence report.
 * Deterministic: same input + same methodology version → same output.
 */
export function generateReport(input: ReportInput): TokenIntelligenceReport {
  const now = new Date().toISOString();
  const dimensions: Partial<Record<RiskCategory, RiskDimension>> = {};
  const allSignals: IntelligenceSignal[] = [];
  const allMissing: MissingDataEntry[] = [];
  const dataSources: { name: string; lastUpdated: string | null | undefined }[] = [];

  // ── Run Each Engine ──
  if (input.market) {
    const result = analyzeMarketHealth(input.market);
    dimensions.MARKET = result.dimension;
    allSignals.push(...result.signals);
    allMissing.push(...result.missingData);
    dataSources.push({ name: 'market_data', lastUpdated: input.market.dataTimestamp });
  } else {
    allMissing.push({ category: 'MARKET', description: 'Market data unavailable', impact: 'REDUCES_CONFIDENCE' });
    dataSources.push({ name: 'market_data', lastUpdated: null });
  }

  if (input.liquidity) {
    const result = analyzeLiquidity(input.liquidity);
    dimensions.LIQUIDITY = result.dimension;
    allSignals.push(...result.signals);
    allMissing.push(...result.missingData);
    dataSources.push({ name: 'pool_data', lastUpdated: input.liquidity.dataTimestamp });
  } else {
    allMissing.push({ category: 'LIQUIDITY', description: 'Liquidity data unavailable', impact: 'REDUCES_CONFIDENCE' });
    dataSources.push({ name: 'pool_data', lastUpdated: null });
  }

  if (input.ownership) {
    const ownershipResult = analyzeOwnership(input.ownership, input.token.id);
    dimensions.OWNERSHIP = ownershipResult.dimension;
    allSignals.push(...ownershipResult.signals);
    allMissing.push(...ownershipResult.missingData);
    dataSources.push({ name: 'holder_data', lastUpdated: input.ownership.dataTimestamp });
  } else {
    allMissing.push({ category: 'OWNERSHIP', description: 'Holder distribution data unavailable', impact: 'REDUCES_CONFIDENCE' });
    dataSources.push({ name: 'holder_data', lastUpdated: null });
  }

  if (input.creator) {
    const creatorResult = analyzeCreator(input.creator, input.token.id);
    dimensions.CREATOR = creatorResult.dimension;
    allSignals.push(...creatorResult.signals);
    allMissing.push(...creatorResult.missingData);
    dataSources.push({ name: 'creator_data', lastUpdated: input.creator.dataTimestamp });
  } else {
    allMissing.push({ category: 'CREATOR', description: 'Creator data unavailable', impact: 'REDUCES_CONFIDENCE' });
    dataSources.push({ name: 'creator_data', lastUpdated: null });
  }

  if (input.activity) {
    const actResult = analyzeActivity(input.activity);
    dimensions.ACTIVITY = actResult.dimension;
    allSignals.push(...actResult.signals);
    allMissing.push(...actResult.missingData);
    dataSources.push({ name: 'activity_data', lastUpdated: input.activity.dataTimestamp });
  } else {
    allMissing.push({ category: 'ACTIVITY', description: 'Activity data unavailable', impact: 'REDUCES_CONFIDENCE' });
    dataSources.push({ name: 'activity_data', lastUpdated: null });
  }

  if (input.contract) {
    const contractResult = analyzeContract(input.contract);
    dimensions.CONTRACT = contractResult.dimension;
    allSignals.push(...contractResult.signals);
    allMissing.push(...contractResult.missingData);
    dataSources.push({ name: 'blockchain', lastUpdated: input.contract.dataTimestamp });
  } else {
    allMissing.push({ category: 'CONTRACT', description: 'Contract metadata unavailable', impact: 'REDUCES_CONFIDENCE' });
    dataSources.push({ name: 'blockchain', lastUpdated: null });
  }

  // Honeypot/tax/transfer-restriction screening (Sprint 30 — Tier 5). Only
  // merges into an existing CONTRACT dimension, same guard style as the
  // organicActivity/insiderReport ACTIVITY merges below.
  if (input.tokenSecurity) {
    const tsecResult = evaluateTokenSecurity(input.tokenSecurity);
    dataSources.push({ name: 'token_security', lastUpdated: input.tokenSecurity.dataTimestamp });
    allSignals.push(...tsecResult.signals);
    allMissing.push(...tsecResult.missingData);
    if (dimensions.CONTRACT) {
      dimensions.CONTRACT.score = Math.max(0, Math.min(100, dimensions.CONTRACT.score + tsecResult.scoreAdjustment));
      dimensions.CONTRACT.evidence.push(...tsecResult.signals.flatMap((signal) => signal.evidence));
      dimensions.CONTRACT.signals.push(...tsecResult.signals);
    }
  }

  if (input.exitability) {
    const exitResult = analyzeExitability(input.exitability);
    dimensions.EXIT = exitResult.dimension;
    allSignals.push(...exitResult.signals);
    allMissing.push(...exitResult.missingData);
    // exitability uses pool_data source, already tracked
  } else {
    allMissing.push({ category: 'EXIT', description: 'Exitability data unavailable', impact: 'LIMITS_ANALYSIS' });
  }

  // ── Apply Risk Rules ──
  if (input.organicActivity) {
    dataSources.push({ name: 'organic_activity', lastUpdated: input.organicActivity.generatedAt });
    const organicSignals = input.organicActivity.signals.map((signal): IntelligenceSignal => ({
      id: `sig_org_${signal.type.toLowerCase()}_${input.organicActivity!.window}`,
      type: signal.type,
      category: 'ACTIVITY',
      severity: signal.severity,
      polarity: signal.dimension === 'ORGANIC' ? 'POSITIVE' : signal.dimension === 'UNKNOWN' ? 'INFO' : 'NEGATIVE',
      value: signal.value,
      confidence: signal.confidence,
      evidence: signal.evidence,
      observedAt: input.organicActivity!.generatedAt,
      methodologyVersion: input.organicActivity!.organicVolumeVersion,
      metadata: {
        window: input.organicActivity!.window,
        organicActivityScore: input.organicActivity!.score,
        confidence: input.organicActivity!.confidence,
      },
    }));
    allSignals.push(...organicSignals);
    if (dimensions.ACTIVITY) {
      dimensions.ACTIVITY.score = Math.round((dimensions.ACTIVITY.score + input.organicActivity.score) / 2);
      dimensions.ACTIVITY.confidence = Math.max(dimensions.ACTIVITY.confidence, input.organicActivity.confidence / 100);
      dimensions.ACTIVITY.evidence.push(...input.organicActivity.signals.flatMap((signal) => signal.evidence).slice(0, 5));
      dimensions.ACTIVITY.signals.push(...organicSignals);
    }
  }

  if (input.insiderReport) {
    dataSources.push({ name: 'insider_detection', lastUpdated: input.insiderReport.generatedAt });
    const insiderSignals = input.insiderReport.candidates.slice(0, 10).map((candidate): IntelligenceSignal => ({
      id: `sig_insider_${candidate.wallet}_${input.insiderReport!.tokenId}`,
      type: 'POTENTIAL_INSIDER_PATTERN',
      category: 'ACTIVITY',
      severity: candidate.score >= 80 ? 'HIGH' : candidate.score >= 60 ? 'MEDIUM' : 'LOW',
      polarity: candidate.score >= 55 ? 'NEGATIVE' : 'INFO',
      value: candidate.score,
      confidence: candidate.confidence / 100,
      evidence: candidate.evidence,
      observedAt: input.insiderReport!.generatedAt,
      methodologyVersion: input.insiderReport!.insiderDetectionVersion,
      metadata: {
        wallet: candidate.wallet,
        status: candidate.status,
        labels: candidate.labels,
        explanation: candidate.explanation,
      },
    }));
    allSignals.push(...insiderSignals);
    if (dimensions.ACTIVITY) {
      dimensions.ACTIVITY.signals.push(...insiderSignals);
      dimensions.ACTIVITY.evidence.push(...input.insiderReport.candidates.flatMap((candidate) => candidate.evidence).slice(0, 5));
    }
  }

  const ruleSignals = evaluateRiskRules(dimensions);
  allSignals.push(...ruleSignals);

  // Merge rule signals into their respective dimensions
  for (const sig of ruleSignals) {
    const dim = dimensions[sig.category];
    if (dim) {
      dim.signals.push(sig);
    }
  }

  // ── Aggregate Score ──
  const aggregation = aggregateScore(dimensions);

  // ── Compute Freshness ──
  const dataFreshness = computeDataFreshness(dataSources);

  // ── Compute Confidence ──
  const confidence = computeConfidence(dimensions, allMissing, dataFreshness);

  // ── Categorize Signals ──
  const warnings = allSignals.filter(s => s.polarity === 'NEGATIVE');
  const positives = allSignals.filter(s => s.polarity === 'POSITIVE');

  // ── Generate Explanation ──
  // Build a preliminary report for the explanation generator
  const report: TokenIntelligenceReport = {
    token: input.token,
    chain: input.token.chain,
    generatedAt: now,
    methodologyVersion: METHODOLOGY_VERSION,
    dataVersion: DATA_VERSION,
    dataFreshness,
    overallScore: aggregation.overallScore,
    riskLevel: aggregation.riskLevel,
    confidence,
    signals: allSignals,
    warnings,
    positives,
    missingData: allMissing,
    riskDimensions: dimensions as Record<RiskCategory, RiskDimension>,
    priceImpactEstimates: input.exitability
      ? analyzeExitability(input.exitability).priceImpactEstimates
      : [],
    holderSnapshot: input.ownership
      ? analyzeOwnership(input.ownership, input.token.id).holderSnapshot
      : undefined,
    contractObservation: input.contract
      ? analyzeContract(input.contract).contractObservation
      : undefined,
    creatorObservation: input.creator
      ? analyzeCreator(input.creator, input.token.id).creatorObservation
      : undefined,
    organicActivity: input.organicActivity,
    insiderReport: input.insiderReport,
    explanation: '', // Placeholder — filled below
    recentTimeline: input.recentTimeline || [],
  };

  // Generate explanation from the complete report
  report.explanation = generateExplanation(report);

  return report;
}
