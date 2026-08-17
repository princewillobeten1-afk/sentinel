/**
 * AI Feature Registry & Policy Configuration (Sprint 37 §6).
 *
 * Enforces controlled AI feature usage, latency SLAs, token budgets,
 * caching policies, and priority routing across all product surfaces.
 */

import { AiFeatureDefinition, AiFeatureId } from './types';

export class AiFeatureRegistry {
  private static instance: AiFeatureRegistry;
  private features: Map<AiFeatureId, AiFeatureDefinition> = new Map();

  private constructor() {
    this.registerDefaultFeatures();
  }

  public static getInstance(): AiFeatureRegistry {
    if (!AiFeatureRegistry.instance) {
      AiFeatureRegistry.instance = new AiFeatureRegistry();
    }
    return AiFeatureRegistry.instance;
  }

  private registerDefaultFeatures() {
    const defaults: AiFeatureDefinition[] = [
      {
        featureId: 'TOKEN_SUMMARY',
        name: 'Token Executive Summary',
        description: 'Rapid natural-language overview of token metrics and risk indicators',
        modelCategory: 'FAST_MODEL',
        modelPolicy: 'TOKEN_SUMMARY_V2',
        maxLatencyMs: 2000,
        maxCostUsd: 0.005,
        maxTokens: 300,
        cacheTtlSeconds: 300,
        supportsStreaming: true,
        priority: 'P1_RISK_EXPLANATION',
        enabled: true,
      },
      {
        featureId: 'TOKEN_ANALYSIS',
        name: 'Deep Token AI Analyst',
        description: 'Comprehensive multi-factor evidence explanation, ownership audit, and exitability check',
        modelCategory: 'REASONING_MODEL',
        modelPolicy: 'TOKEN_ANALYSIS_V2',
        maxLatencyMs: 5000,
        maxCostUsd: 0.02,
        maxTokens: 1200,
        cacheTtlSeconds: 180,
        supportsStreaming: true,
        priority: 'P0_INTERACTIVE',
        enabled: true,
      },
      {
        featureId: 'WHAT_CHANGED',
        name: '"What Changed?" Delta Inspector',
        description: 'Compares previous state vs current state over 15m/1h/24h and highlights critical deltas',
        modelCategory: 'FAST_MODEL',
        modelPolicy: 'WHAT_CHANGED_V1',
        maxLatencyMs: 2000,
        maxCostUsd: 0.005,
        maxTokens: 400,
        cacheTtlSeconds: 60,
        supportsStreaming: false,
        priority: 'P0_INTERACTIVE',
        enabled: true,
      },
      {
        featureId: 'ANOMALY_EXPLANATION',
        name: 'AI Anomaly Synthesizer',
        description: 'Translates statistical anomaly metrics into plain-English explanation without fabricating signals',
        modelCategory: 'FAST_MODEL',
        modelPolicy: 'ANOMALY_EXPLAINER_V1',
        maxLatencyMs: 2000,
        maxCostUsd: 0.004,
        maxTokens: 350,
        cacheTtlSeconds: 120,
        supportsStreaming: false,
        priority: 'P1_RISK_EXPLANATION',
        enabled: true,
      },
      {
        featureId: 'COPILOT_CHAT',
        name: 'Trader Contextual Copilot',
        description: 'Interactive natural-language trading assistant grounded in active screen context',
        modelCategory: 'REASONING_MODEL',
        modelPolicy: 'COPILOT_V2',
        maxLatencyMs: 4000,
        maxCostUsd: 0.015,
        maxTokens: 800,
        cacheTtlSeconds: 30,
        supportsStreaming: true,
        priority: 'P0_INTERACTIVE',
        enabled: true,
      },
      {
        featureId: 'COPILOT_COMPARE',
        name: 'Multi-Token Comparison Copilot',
        description: 'Side-by-side comparative analysis of multiple tokens on exitability, volume, and insider risk',
        modelCategory: 'REASONING_MODEL',
        modelPolicy: 'TOKEN_COMPARE_V1',
        maxLatencyMs: 5000,
        maxCostUsd: 0.025,
        maxTokens: 1000,
        cacheTtlSeconds: 120,
        supportsStreaming: true,
        priority: 'P0_INTERACTIVE',
        enabled: true,
      },
      {
        featureId: 'TRADE_CHECK',
        name: 'Pre-Trade Risk & Impact Check',
        description: 'Advisory analysis of slippage, exitability, and personal risk rule compliance before swap',
        modelCategory: 'FAST_MODEL',
        modelPolicy: 'TRADE_CHECK_V1',
        maxLatencyMs: 1500,
        maxCostUsd: 0.003,
        maxTokens: 250,
        cacheTtlSeconds: 15,
        supportsStreaming: false,
        priority: 'P0_INTERACTIVE',
        enabled: true,
      },
      {
        featureId: 'CREATOR_ANALYSIS',
        name: 'Creator History & Reputation Analyst',
        description: 'Synthesizes past launches, outcome track record, and connected deployer wallets',
        modelCategory: 'FAST_MODEL',
        modelPolicy: 'CREATOR_ANALYSIS_V1',
        maxLatencyMs: 3000,
        maxCostUsd: 0.008,
        maxTokens: 500,
        cacheTtlSeconds: 600,
        supportsStreaming: true,
        priority: 'P1_RISK_EXPLANATION',
        enabled: true,
      },
      {
        featureId: 'WALLET_ANALYSIS',
        name: 'Wallet Behavioral Profiler',
        description: 'Analyzes trading patterns, entry timing, and cluster links with clear fact-vs-inference labels',
        modelCategory: 'FAST_MODEL',
        modelPolicy: 'WALLET_ANALYSIS_V1',
        maxLatencyMs: 3000,
        maxCostUsd: 0.008,
        maxTokens: 500,
        cacheTtlSeconds: 600,
        supportsStreaming: true,
        priority: 'P1_RISK_EXPLANATION',
        enabled: true,
      },
      {
        featureId: 'PORTFOLIO_ANALYSIS',
        name: 'Portfolio Risk & Exitability Analyst',
        description: 'Reviews user open positions for concentration risk and deteriorating liquidity depth',
        modelCategory: 'REASONING_MODEL',
        modelPolicy: 'PORTFOLIO_ANALYSIS_V1',
        maxLatencyMs: 4500,
        maxCostUsd: 0.018,
        maxTokens: 900,
        cacheTtlSeconds: 180,
        supportsStreaming: true,
        priority: 'P0_INTERACTIVE',
        enabled: true,
      },
      {
        featureId: 'DISCOVERY_SEARCH',
        name: 'Natural Language Discovery Search',
        description: 'Translates colloquial trader intent into deterministic token discovery query filters',
        modelCategory: 'FAST_MODEL',
        modelPolicy: 'NL_SEARCH_V1',
        maxLatencyMs: 1500,
        maxCostUsd: 0.003,
        maxTokens: 200,
        cacheTtlSeconds: 300,
        supportsStreaming: false,
        priority: 'P0_INTERACTIVE',
        enabled: true,
      },
      {
        featureId: 'ALERT_SYNTHESIS',
        name: 'Smart Alert Narrative Synthesizer',
        description: 'Transforms multi-event trigger conditions into concise, actionable alert warnings',
        modelCategory: 'FAST_MODEL',
        modelPolicy: 'ALERT_SYNTHESIS_V1',
        maxLatencyMs: 2000,
        maxCostUsd: 0.004,
        maxTokens: 250,
        cacheTtlSeconds: 60,
        supportsStreaming: false,
        priority: 'P1_RISK_EXPLANATION',
        enabled: true,
      },
      {
        featureId: 'TRADE_JOURNAL',
        name: 'AI Post-Trade Review & Journal',
        description: 'Constructive review of completed trade execution, timing, and risk conditions for trader learning',
        modelCategory: 'FAST_MODEL',
        modelPolicy: 'TRADE_JOURNAL_V1',
        maxLatencyMs: 3000,
        maxCostUsd: 0.008,
        maxTokens: 600,
        cacheTtlSeconds: 86400,
        supportsStreaming: false,
        priority: 'P2_BACKGROUND_SUMMARY',
        enabled: true,
      },
    ];

    for (const feat of defaults) {
      this.features.set(feat.featureId, feat);
    }
  }

  public getFeature(featureId: AiFeatureId): AiFeatureDefinition {
    const feat = this.features.get(featureId);
    if (!feat) {
      throw new Error(`Unregistered AI feature requested: ${featureId}`);
    }
    return feat;
  }

  public getAllFeatures(): AiFeatureDefinition[] {
    return Array.from(this.features.values());
  }

  public updateFeature(featureId: AiFeatureId, update: Partial<AiFeatureDefinition>): void {
    const existing = this.getFeature(featureId);
    this.features.set(featureId, { ...existing, ...update });
  }
}

export const aiFeatureRegistry = AiFeatureRegistry.getInstance();
