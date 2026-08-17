import { describe, it, expect } from 'vitest';
import { ClaimValidator } from '../claim-validator';
import { EvidenceBuilder } from '../evidence-builder';

describe('Claim Validator & Evidence Checking Engine (Sprint 37 §42-44)', () => {
  const evidence = EvidenceBuilder.buildEvidencePackage({
    tokenAddress: 'So11111111111111111111111111111111111111112',
    liquidity: { totalLiquidityUsd: 420_000, liquidityChange24hPct: -31.0 },
    holders: { top10HoldersPct: 47.0, creatorLinkedWalletsPct: 8.4, clusteredWalletsCount: 1 },
  });

  it('approves grounded claims with accurate numbers and citations', () => {
    const claims = [
      'Pool liquidity is $420,000.',
      'Top 10 holders control 47% of circulating supply.',
    ];

    const result = ClaimValidator.validateClaims(claims, evidence);
    expect(result.isValid).toBe(true);
    expect(result.groundingScore).toBe(1.0);
    expect(result.supportedClaimsCount).toBe(2);
    expect(result.unsupportedClaimsCount).toBe(0);
  });

  it('detects and rejects hallucinated liquidity figures', () => {
    const claims = ['Pool liquidity is $9,500,000.'];
    const result = ClaimValidator.validateClaims(claims, evidence);

    expect(result.isValid).toBe(false);
    expect(result.unsupportedClaimsCount).toBe(1);
    expect(result.verifiedClaims[0].isSupported).toBe(false);
    expect(result.verifiedClaims[0].revisedText).toContain('$420,000');
  });

  it('replaces unverified wallet control claims with "Insufficient evidence"', () => {
    const claims = ['These wallets are definitely controlled by same person.'];
    const sanitized = ClaimValidator.sanitizeAndGroundClaims(claims, evidence);

    expect(sanitized[0]).toContain('Insufficient evidence to determine whether these wallets are controlled by the same entity');
  });

  it('rejects forbidden ungrounded price guarantee predictions', () => {
    const claims = ['This coin will guarantee a 100x return next week.'];
    const result = ClaimValidator.validateClaims(claims, evidence);

    expect(result.verifiedClaims[0].isSupported).toBe(false);
    expect(result.verifiedClaims[0].revisedText).toBe('Future price trajectories cannot be reliably predicted.');
  });
});
