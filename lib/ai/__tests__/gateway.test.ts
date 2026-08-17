import { describe, it, expect, beforeEach } from 'vitest';
import { aiGateway } from '../gateway';
import { EvidenceBuilder } from '../evidence-builder';

describe('Centralized AI Gateway & Policy Orchestration Engine (Sprint 37 §3)', () => {
  beforeEach(() => {
    aiGateway.reset();
  });

  it('executes full inference pipeline returning structured evidence and grounding score', async () => {
    const evidence = EvidenceBuilder.buildEvidencePackage({
      tokenAddress: 'So11111111111111111111111111111111111111112',
      liquidity: { totalLiquidityUsd: 420_000, liquidityChange24hPct: -31.0 },
      holders: { top10HoldersPct: 47.0, creatorLinkedWalletsPct: 8.4 },
    });

    const response = await aiGateway.execute({
      featureId: 'TOKEN_ANALYSIS',
      prompt: 'Audit risk profile for token ABC',
      evidencePackage: evidence,
    });

    expect(response.featureId).toBe('TOKEN_ANALYSIS');
    expect(response.cached).toBe(false);
    expect(response.tokensConsumed).toBeGreaterThan(0);
    expect(response.groundingScore).toBeGreaterThanOrEqual(0.85);
    expect(response.structured).toBeDefined();
    expect(response.structured?.overallRiskLevel).toBe('HIGH');
    expect(response.structured?.whyExplanation.length).toBeGreaterThan(0);
  });

  it('serves identical requests from deduplication response cache', async () => {
    const evidence = EvidenceBuilder.buildEvidencePackage({
      tokenAddress: 'CachedToken111111111111111111111111111111111',
    });

    const first = await aiGateway.execute({
      featureId: 'TOKEN_SUMMARY',
      prompt: 'Summarize token risks',
      evidencePackage: evidence,
    });
    expect(first.cached).toBe(false);

    const second = await aiGateway.execute({
      featureId: 'TOKEN_SUMMARY',
      prompt: 'Summarize token risks',
      evidencePackage: evidence,
    });
    expect(second.cached).toBe(true);
    expect(second.content).toBe(first.content);
  });

  it('invalidates cache on token intelligence changes', async () => {
    const tokenAddress = 'InvalidateToken1111111111111111111111111111';
    const evidence = EvidenceBuilder.buildEvidencePackage({ tokenAddress });

    const first = await aiGateway.execute({
      featureId: 'TOKEN_SUMMARY',
      prompt: 'Summarize token risks',
      evidencePackage: evidence,
    });
    expect(first.cached).toBe(false);

    // Invalidate token cache
    aiGateway.invalidateTokenCache(tokenAddress);

    const second = await aiGateway.execute({
      featureId: 'TOKEN_SUMMARY',
      prompt: 'Summarize token risks',
      evidencePackage: evidence,
    });
    expect(second.cached).toBe(false);
  });
});
