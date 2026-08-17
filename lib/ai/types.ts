/**
 * Sprint 37 — AI System Type Definitions & Data Contracts
 *
 * Core architectural principle:
 *   AI does not replace intelligence engines. AI explains, combines,
 *   prioritizes, and assists using verified underlying data.
 */

// ── 1. Confidence & Fact Taxonomy ──

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type AiConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Strict epistemic categorization for AI claims (§41)
 */
export type FactCategory = 'FACT' | 'ANALYSIS' | 'ESTIMATE' | 'PREDICTION';

/**
 * Audience persona for adaptive explanation depth (§60-62)
 */
export type AiAudiencePersona = 'BEGINNER' | 'ADVANCED' | 'QUANT';

/**
 * Severity hierarchy for AI findings and alerts (§28)
 */
export type AiSeverity = 'INFO' | 'WATCH' | 'WARNING' | 'HIGH' | 'CRITICAL';

// ── 2. Evidence Layer Schemas (§9, §10, §46) ──

export interface EvidenceCitation {
  sourceType:
    | 'blockchain_state'
    | 'liquidity_snapshot'
    | 'holder_distribution'
    | 'creator_history'
    | 'insider_signals'
    | 'exitability_engine'
    | 'contract_analysis'
    | 'volume_quality'
    | 'order_book';
  sourceId: string;
  metric: string;
  observedValue: string | number | boolean;
  unit?: string;
  timestamp: string;
  slot?: number;
  txHash?: string;
}

export interface VerifiedBlockchainFact {
  factId: string;
  category:
    | 'LIQUIDITY_LEVEL'
    | 'LIQUIDITY_CHANGE'
    | 'TOP_HOLDERS'
    | 'CREATOR_ALLOCATION'
    | 'CREATOR_HISTORY'
    | 'ORGANIC_VOLUME'
    | 'EXITABILITY'
    | 'CONTRACT_SECURITY'
    | 'INSIDER_TRANSFERS'
    | 'WALLET_FUNDING';
  statement: string;
  evidence: EvidenceCitation;
}

export interface EvidencePackage {
  tokenAddress: string;
  symbol: string;
  name: string;
  timestamp: string;
  dataSnapshotHash: string;
  market: {
    priceUsd: number;
    marketCapUsd: number;
    volume24hUsd: number;
    priceChange24hPct: number;
  };
  liquidity: {
    totalLiquidityUsd: number;
    liquidityChange24hPct: number;
    isLocked: boolean;
    lockDurationDays?: number;
    estimatedPriceImpact10kPct: number;
  };
  holders: {
    totalHolders: number;
    top10HoldersPct: number;
    creatorLinkedWalletsPct: number;
    clusteredWalletsCount: number;
  };
  creator: {
    creatorAddress: string;
    reputationScore: number; // 0 - 100
    previousLaunchesCount: number;
    successfulLaunchesCount: number;
    rugPullCount: number;
    isVerified: boolean;
  };
  volume: {
    organicVolumePct: number; // 0 - 100
    washTradingProbabilityPct: number; // 0 - 100
    uniqueTraders24h: number;
  };
  insiderSignals: {
    insiderConcentrationScore: number; // 0 - 100
    earlySniperCount: number;
    coordinatedSellingDetected: boolean;
  };
  exitability: {
    exitabilityScore: number; // 0 - 100
    maxSafeSellSizeUsd: number;
    slippageEstimate5kPct: number;
  };
  contractRisk: {
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    mintAuthorityRevoked: boolean;
    freezeAuthorityRevoked: boolean;
    hasTransferTax: boolean;
    transferTaxPct: number;
    isHoneypot: boolean;
  };
  historicalChanges?: {
    timeframe: '15m' | '1h' | '24h';
    liquidityDeltaPct: number;
    holderCountDeltaPct: number;
    exitabilityDelta: number;
    largeSalesCount: number;
  };
}

// ── 3. Claim Validation & Evidence Checking (§42-44) ──

export interface ClaimVerificationItem {
  claimText: string;
  category: FactCategory;
  isSupported: boolean;
  confidence: AiConfidenceLevel;
  citedEvidence?: EvidenceCitation;
  rejectionReason?: string;
  revisedText?: string;
}

export interface ClaimValidationResult {
  isValid: boolean;
  groundingScore: number; // 0.0 - 1.0
  totalClaimsCount: number;
  supportedClaimsCount: number;
  unsupportedClaimsCount: number;
  verifiedClaims: ClaimVerificationItem[];
}

// ── 4. Structured AI Output Schema (§45) ──

export interface AiFinding {
  id: string;
  severity: AiSeverity;
  category: FactCategory;
  headline: string;
  explanation: string;
  confidence: AiConfidenceLevel;
  confidenceExplanation: string; // "Confidence in analysis reliability given available evidence" (§12)
  citations: EvidenceCitation[];
}

export interface StructuredAiResponse {
  feature: string;
  summary: string;
  overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  mainConcern?: string;
  whyExplanation: string[];
  findings: AiFinding[];
  positiveFactors: string[];
  warningFactors: string[];
  confidence: AiConfidenceLevel;
  confidenceScore: number; // 0 - 100
  uncertaintyNotes: string[];
  modelVersion: string;
  promptVersion: string;
  dataSnapshotHash: string;
  generatedAt: string;
  disclaimer: string;
}

// ── 5. AI Features & Model Routing (§4-6) ──

export type AiFeatureId =
  | 'TOKEN_SUMMARY'
  | 'TOKEN_ANALYSIS'
  | 'WHAT_CHANGED'
  | 'ANOMALY_EXPLANATION'
  | 'COPILOT_CHAT'
  | 'COPILOT_COMPARE'
  | 'TRADE_CHECK'
  | 'CREATOR_ANALYSIS'
  | 'WALLET_ANALYSIS'
  | 'PORTFOLIO_ANALYSIS'
  | 'DISCOVERY_SEARCH'
  | 'ALERT_SYNTHESIS'
  | 'TRADE_JOURNAL';

export type ModelCategory =
  | 'FAST_MODEL'
  | 'REASONING_MODEL'
  | 'EMBEDDING_MODEL'
  | 'CLASSIFICATION_MODEL'
  | 'SPECIALIZED_MODEL';

export interface AiFeatureDefinition {
  featureId: AiFeatureId;
  name: string;
  description: string;
  modelCategory: ModelCategory;
  modelPolicy: string;
  maxLatencyMs: number;
  maxCostUsd: number;
  maxTokens: number;
  cacheTtlSeconds: number;
  supportsStreaming: boolean;
  priority: 'P0_INTERACTIVE' | 'P1_RISK_EXPLANATION' | 'P2_BACKGROUND_SUMMARY';
  enabled: boolean;
}

export interface ModelProviderConfig {
  id: string;
  provider: 'google' | 'anthropic' | 'openai' | 'local_stub';
  modelName: string;
  category: ModelCategory;
  costPer1kTokensUsd: number;
  maxContextTokens: number;
  averageLatencyMs: number;
  accuracyScore: number; // 0 - 100 benchmark
  isAvailable: boolean;
}

// ── 6. Domain-Specific AI Engines (§7-20, §30-36, §63-66) ──

// What Changed (§17-18)
export interface WhatChangedItem {
  type: 'WARNING' | 'POSITIVE' | 'NEUTRAL';
  metric: string;
  previousValue: string | number;
  currentValue: string | number;
  deltaDescription: string;
  severity: AiSeverity;
}

export interface WhatChangedAnalysis {
  tokenAddress: string;
  timeframe: '15m' | '1h' | '24h';
  overallRiskTrend: 'INCREASED' | 'STABLE' | 'DECREASED';
  summary: string;
  changes: WhatChangedItem[];
  generatedAt: string;
}

// Anomaly Detection (§19-20)
export interface AnomalyEvidence {
  metric: string;
  expectedBaseline: number;
  observedValue: number;
  standardDeviations: number;
  sampleSize: number;
}

export interface AnomalyExplanation {
  anomalyDetected: boolean;
  anomalyType?: 'VOLUME_SPIKE' | 'LIQUIDITY_DRAIN' | 'INSIDER_ACCUMULATION' | 'PRICE_IMPACT_DIVERGENCE';
  severity: AiSeverity;
  evidence: AnomalyEvidence[];
  statisticalSummary: string;
  plainEnglishExplanation: string;
  confidence: AiConfidenceLevel;
}

// Context-Aware Copilot & Trade Check (§21-24)
export interface CopilotContext {
  activePage?: 'trade' | 'discovery' | 'portfolio' | 'wallet' | 'creator';
  activeTokenAddress?: string;
  activeWalletAddress?: string;
  activeCreatorAddress?: string;
  userRiskProfile?: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' | 'CUSTOM';
  recentQueries?: string[];
}

export interface PreTradeCheckRequest {
  tokenAddress: string;
  tradeType: 'BUY' | 'SELL';
  orderSizeUsd: number;
  maxSlippagePct: number;
  userProfile?: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' | 'CUSTOM';
}

export interface PreTradeCheckResult {
  allowedAdvisory: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  estimatedPriceImpactPct: number;
  liquidityUsd: number;
  exitabilityScore: number;
  conflictsWithPersonalRule: boolean;
  conflictDetails?: string[];
  warnings: string[];
  positives: string[];
  summary: string;
  requiresExplicitConfirmation: true; // Hard safety boundary (§72-73)
}

// Natural Language Search (§30)
export interface SearchFilterTranslation {
  rawQuery: string;
  interpretedIntent: string;
  filters: {
    minLiquidityUsd?: number;
    maxAgeHours?: number;
    minOrganicVolumePct?: number;
    maxInsiderConcentrationPct?: number;
    minExitabilityScore?: number;
    maxRiskScore?: number;
  };
  rankingCriteria: string[];
  confidence: AiConfidenceLevel;
}

// Creator & Wallet Analyst (§32-34)
export interface CreatorProfileAnalysis {
  creatorAddress: string;
  reputationScore: number;
  observedFacts: string[];
  inferences: string[];
  historicalOutcomes: {
    totalLaunches: number;
    graduatedOrLiquidLaunches: number;
    liquidityDrainCount: number;
  };
  overallVerdict: 'TRUSTED' | 'MODERATE_RISK' | 'HIGH_RISK' | 'KNOWN_BAD_ACTOR';
  confidence: AiConfidenceLevel;
}

export interface WalletBehavioralSummary {
  walletAddress: string;
  observedFacts: string[];
  inferences: string[];
  patterns: string[];
  frequentEntryTiming: string;
  associatedClusterSize: number;
  creatorLinkProbabilityPct: number;
  confidence: AiConfidenceLevel;
}

// Portfolio Analyst (§63-64)
export interface PortfolioAiAnalysis {
  portfolioRiskRating: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  topRiskContributors: Array<{
    tokenAddress: string;
    symbol: string;
    allocationPct: number;
    exitabilityScore: number;
    primaryConcern: string;
  }>;
  lowLiquidityExposurePct: number;
  deterioratingExitabilityCount: number;
  actionableInsights: string[];
  summary: string;
}

// Post-Trade Journal (§65-66)
export interface TradeJournalEntry {
  tradeId: string;
  tokenSymbol: string;
  entryPriceUsd: number;
  exitPriceUsd: number;
  pnlPct: number;
  netPnlUsd: number;
  feesPaidUsd: number;
  holdDurationMinutes: number;
  whatWentWell: string[];
  whatCouldImprove: string[];
  learningSummary: string;
  generatedAt: string;
}

// Personalized Risk Profile (§25-26)
export interface PersonalizedRiskProfile {
  id: string;
  userId: string;
  profileType: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' | 'CUSTOM';
  minExitabilityScore: number;
  maxInsiderConcentrationPct: number;
  maxTop10HolderPct: number;
  maxPriceImpactPct: number;
  requireMintRevoked: boolean;
  customRules: string[];
}

// ── 7. Evaluation & Regression Benchmarking (§47-50, §76) ──

export interface GoldenDatasetCase {
  id: string;
  category: 'KNOWN_SAFE' | 'KNOWN_RISKY' | 'KNOWN_INSIDER' | 'KNOWN_LIQUIDITY_DRAIN' | 'KNOWN_ANOMALY';
  title: string;
  inputEvidence: EvidencePackage;
  expectedRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requiredWarningKeywords: string[];
  forbiddenHallucinations: string[];
  minGroundingScore: number;
}

export interface EvaluationRunMetrics {
  runId: string;
  timestamp: string;
  modelVersion: string;
  promptVersion: string;
  totalCases: number;
  passedCases: number;
  averageGroundingScore: number;
  hallucinationRatePct: number;
  averageLatencyMs: number;
  totalCostUsd: number;
  status: 'PASSED' | 'REGRESSION_DETECTED' | 'FAILED';
}
