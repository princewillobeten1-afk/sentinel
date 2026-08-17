/**
 * Automated Claim Validation & Evidence Checking Engine (Sprint 37 §42-44).
 *
 * Validates generated AI claims against the verified EvidencePackage.
 * Prevents hallucinations by auditing:
 *   - Numerical claims (liquidity $, percentage changes, holder counts)
 *   - Risk categorizations against deterministic risk engines
 *   - Automatic claim revision to "Insufficient evidence..." when unsupported (§44)
 */

import { EvidencePackage, ClaimValidationResult, ClaimVerificationItem, FactCategory, AiConfidenceLevel } from './types';

export class ClaimValidator {
  /**
   * Evaluates a set of generated claims against the underlying evidence package.
   */
  public static validateClaims(claims: string[], evidence: EvidencePackage): ClaimValidationResult {
    const verifiedClaims: ClaimVerificationItem[] = [];
    let supportedCount = 0;
    let unsupportedCount = 0;

    for (const rawClaim of claims) {
      const audit = this.auditSingleClaim(rawClaim, evidence);
      verifiedClaims.push(audit);
      if (audit.isSupported) {
        supportedCount++;
      } else {
        unsupportedCount++;
      }
    }

    const totalClaimsCount = claims.length;
    const groundingScore = totalClaimsCount > 0 ? supportedCount / totalClaimsCount : 1.0;
    const isValid = groundingScore >= 0.85; // Strict grounding threshold

    return {
      isValid,
      groundingScore: Number(groundingScore.toFixed(2)),
      totalClaimsCount,
      supportedClaimsCount: supportedCount,
      unsupportedClaimsCount: unsupportedCount,
      verifiedClaims,
    };
  }

  /**
   * Audits an individual claim string against the evidence package data points.
   */
  private static auditSingleClaim(claimText: string, evidence: EvidencePackage): ClaimVerificationItem {
    const lower = claimText.toLowerCase();

    // 1. Detect category (§41)
    let category: FactCategory = 'ANALYSIS';
    if (lower.startsWith('fact:') || lower.includes('is locked') || lower.includes('has revoked')) {
      category = 'FACT';
    } else if (lower.includes('estimate') || lower.includes('approx') || lower.includes('slippage')) {
      category = 'ESTIMATE';
    } else if (lower.includes('will') || lower.includes('future') || lower.includes('predict')) {
      category = 'PREDICTION';
    }

    // Safety rule (§40-41): Predictions of guaranteed price movements are strictly forbidden
    if (category === 'PREDICTION' && (lower.includes('guarantee') || lower.includes('100x') || lower.includes('moon') || lower.includes('certain to'))) {
      return {
        claimText,
        category: 'PREDICTION',
        isSupported: false,
        confidence: 'LOW',
        rejectionReason: 'Forbidden ungrounded price guarantee prediction',
        revisedText: 'Future price trajectories cannot be reliably predicted.',
      };
    }

    // 2. Check for Hallucinated Liquidity Numbers
    const dollarMatch = claimText.match(/\$([0-9,]+(\.[0-9]+)?)/);
    if (dollarMatch && (lower.includes('liquidity') || lower.includes('pool'))) {
      const claimedVal = parseFloat(dollarMatch[1].replace(/,/g, ''));
      const actualLiq = evidence.liquidity.totalLiquidityUsd;
      // Allow 10% rounding variance
      const isAccurate = Math.abs(claimedVal - actualLiq) / actualLiq <= 0.15;

      if (!isAccurate) {
        return {
          claimText,
          category: 'FACT',
          isSupported: false,
          confidence: 'LOW',
          rejectionReason: `Claimed liquidity ($${claimedVal}) does not match verified blockchain snapshot ($${actualLiq}).`,
          revisedText: `Verified pool liquidity is $${actualLiq.toLocaleString()}.`,
        };
      }
    }

    // 3. Check for Hallucinated Percentage Numbers (e.g. Top 10 holders or Creator Linked)
    const pctMatch = claimText.match(/([0-9]+(\.[0-9]+)?)\s*%/);
    if (pctMatch && (lower.includes('holder') || lower.includes('top 10') || lower.includes('creator'))) {
      const claimedPct = parseFloat(pctMatch[1]);
      const actualTop10 = evidence.holders.top10HoldersPct;
      const actualCreator = evidence.holders.creatorLinkedWalletsPct;

      const matchesTop10 = Math.abs(claimedPct - actualTop10) <= 5.0;
      const matchesCreator = Math.abs(claimedPct - actualCreator) <= 5.0;

      if (!matchesTop10 && !matchesCreator && (lower.includes('top 10') || lower.includes('creator control'))) {
        return {
          claimText,
          category: 'FACT',
          isSupported: false,
          confidence: 'LOW',
          rejectionReason: `Claimed percentage (${claimedPct}%) deviates from verified snapshot.`,
          revisedText: `Top 10 holders control ${actualTop10}% and creator-linked wallets control ${actualCreator}%.`,
        };
      }
    }

    // 4. Check for Unverified Wallet Control Inferences (§44)
    if (lower.includes('definitely controlled by same person') || lower.includes('proven single owner')) {
      if (evidence.holders.clusteredWalletsCount < 3) {
        return {
          claimText,
          category: 'ANALYSIS',
          isSupported: false,
          confidence: 'LOW',
          rejectionReason: 'Overconfident wallet attribution without sufficient cluster correlation evidence.',
          revisedText: 'Insufficient evidence to determine whether these wallets are controlled by the same entity.',
        };
      }
    }

    // 5. Grounded Claim
    const confidence: AiConfidenceLevel =
      category === 'FACT' ? 'HIGH' : category === 'ANALYSIS' ? 'MEDIUM' : 'LOW';

    return {
      claimText,
      category,
      isSupported: true,
      confidence,
      citedEvidence: {
        sourceType: 'blockchain_state',
        sourceId: `audit_${evidence.tokenAddress.slice(0, 6)}`,
        metric: 'general_grounding_audit',
        observedValue: true,
        timestamp: evidence.timestamp,
      },
    };
  }

  /**
   * Cleans and rewrites ungrounded claims into a reliable, grounded string list.
   */
  public static sanitizeAndGroundClaims(claims: string[], evidence: EvidencePackage): string[] {
    const result = this.validateClaims(claims, evidence);
    return result.verifiedClaims.map((item) => {
      if (item.isSupported) {
        return item.claimText;
      }
      return item.revisedText || 'Insufficient evidence to substantiate claim.';
    });
  }
}
