/**
 * Multi-Category, Provider-Agnostic Model Router (Sprint 37 §4-5).
 *
 * Dynamically selects optimal models based on:
 *   - Category requirements (FAST_MODEL, REASONING_MODEL, EMBEDDING_MODEL, CLASSIFICATION_MODEL, SPECIALIZED_MODEL)
 *   - Latency SLAs (<2s simple, <5s complex)
 *   - Cost constraints & Context token requirements
 *   - Provider availability & Automatic fallback routing
 */

import { ModelCategory, ModelProviderConfig } from './types';

export class ModelRouter {
  private static instance: ModelRouter;
  private models: Map<string, ModelProviderConfig> = new Map();

  private constructor() {
    this.registerDefaultModels();
  }

  public static getInstance(): ModelRouter {
    if (!ModelRouter.instance) {
      ModelRouter.instance = new ModelRouter();
    }
    return ModelRouter.instance;
  }

  private registerDefaultModels() {
    // 1. FAST_MODEL category (Low latency, high throughput)
    this.models.set('gemini-1.5-flash', {
      id: 'gemini-1.5-flash',
      provider: 'google',
      modelName: 'gemini-1.5-flash-latest',
      category: 'FAST_MODEL',
      costPer1kTokensUsd: 0.00015,
      maxContextTokens: 1_000_000,
      averageLatencyMs: 450,
      accuracyScore: 88,
      isAvailable: true,
    });
    this.models.set('claude-3-5-haiku', {
      id: 'claude-3-5-haiku',
      provider: 'anthropic',
      modelName: 'claude-3-5-haiku-20241022',
      category: 'FAST_MODEL',
      costPer1kTokensUsd: 0.0008,
      maxContextTokens: 200_000,
      averageLatencyMs: 520,
      accuracyScore: 89,
      isAvailable: true,
    });

    // 2. REASONING_MODEL category (Deep multi-factor analysis, logic)
    this.models.set('claude-3-5-sonnet', {
      id: 'claude-3-5-sonnet',
      provider: 'anthropic',
      modelName: 'claude-3-5-sonnet-20241022',
      category: 'REASONING_MODEL',
      costPer1kTokensUsd: 0.003,
      maxContextTokens: 200_000,
      averageLatencyMs: 1400,
      accuracyScore: 96,
      isAvailable: true,
    });
    this.models.set('gemini-1.5-pro', {
      id: 'gemini-1.5-pro',
      provider: 'google',
      modelName: 'gemini-1.5-pro-latest',
      category: 'REASONING_MODEL',
      costPer1kTokensUsd: 0.0035,
      maxContextTokens: 2_000_000,
      averageLatencyMs: 1600,
      accuracyScore: 95,
      isAvailable: true,
    });

    // 3. EMBEDDING_MODEL category (Semantic search & token similarity)
    this.models.set('text-embedding-004', {
      id: 'text-embedding-004',
      provider: 'google',
      modelName: 'text-embedding-004',
      category: 'EMBEDDING_MODEL',
      costPer1kTokensUsd: 0.000025,
      maxContextTokens: 8_192,
      averageLatencyMs: 120,
      accuracyScore: 92,
      isAvailable: true,
    });

    // 4. CLASSIFICATION_MODEL category (Fast binary / enum risk tagging)
    this.models.set('fast-classifier-v1', {
      id: 'fast-classifier-v1',
      provider: 'local_stub',
      modelName: 'sentinel-classifier-v1',
      category: 'CLASSIFICATION_MODEL',
      costPer1kTokensUsd: 0.0,
      maxContextTokens: 16_000,
      averageLatencyMs: 50,
      accuracyScore: 94,
      isAvailable: true,
    });

    // 5. SPECIALIZED_MODEL / DETERMINISTIC STUB (Zero-hallucination rule fallback)
    this.models.set('deterministic-stub', {
      id: 'deterministic-stub',
      provider: 'local_stub',
      modelName: 'sentinel-rule-engine-v1',
      category: 'SPECIALIZED_MODEL',
      costPer1kTokensUsd: 0.0,
      maxContextTokens: 64_000,
      averageLatencyMs: 10,
      accuracyScore: 100,
      isAvailable: true,
    });
  }

  /**
   * Selects best model matching target category, SLA constraints, and provider health.
   */
  public routeModel(criteria: {
    category: ModelCategory;
    maxLatencyMs?: number;
    maxCostUsd?: number;
    preferredProvider?: 'google' | 'anthropic' | 'openai' | 'local_stub';
  }): ModelProviderConfig {
    const candidates = Array.from(this.models.values()).filter(
      (m) => m.category === criteria.category && m.isAvailable
    );

    if (candidates.length === 0) {
      // Graceful fallback to deterministic local stub (§59)
      const stub = this.models.get('deterministic-stub');
      if (stub) return stub;
      throw new Error(`No available model found for category ${criteria.category} and no fallback available.`);
    }

    // Filter by max latency SLA if provided
    let filtered = candidates;
    if (criteria.maxLatencyMs) {
      const withinLatency = candidates.filter((m) => m.averageLatencyMs <= (criteria.maxLatencyMs || 5000));
      if (withinLatency.length > 0) filtered = withinLatency;
    }

    // Prioritize preferred provider if requested and available
    if (criteria.preferredProvider) {
      const preferred = filtered.find((m) => m.provider === criteria.preferredProvider);
      if (preferred) return preferred;
    }

    // Rank candidates by composite score: Accuracy / (Latency * Cost weight)
    filtered.sort((a, b) => {
      const scoreA = a.accuracyScore / (1 + a.averageLatencyMs / 1000 + a.costPer1kTokensUsd * 100);
      const scoreB = b.accuracyScore / (1 + b.averageLatencyMs / 1000 + b.costPer1kTokensUsd * 100);
      return scoreB - scoreA;
    });

    return filtered[0];
  }

  public setModelAvailability(modelId: string, isAvailable: boolean): void {
    const m = this.models.get(modelId);
    if (m) {
      m.isAvailable = isAvailable;
    }
  }

  public getModel(modelId: string): ModelProviderConfig | undefined {
    return this.models.get(modelId);
  }

  public getAllModels(): ModelProviderConfig[] {
    return Array.from(this.models.values());
  }

  public reset(): void {
    for (const m of this.models.values()) {
      m.isAvailable = true;
    }
  }
}

export const modelRouter = ModelRouter.getInstance();
