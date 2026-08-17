import { LaunchConfig, LaunchRiskScore, RiskLevel } from './types';
import { computeCreatorEntity } from '@/lib/creator/context-builder';
import { computeOwnershipReport } from '@/lib/ownership/context-builder';

/**
 * Sprint 30 — Tier 5: this engine used to call two hardcoded stubs
 * (`getCreatorReputation`/`analyzeWalletClustering`, flat 85/10 regardless
 * of input) instead of the real `calculateReputation()`/
 * `calculateEffectiveOwnership()` engines that already exist and are
 * already wired into the intelligence/ownership/creator API routes
 * (Sprint 28's orphaned-engine-wiring pattern) — reused here, not
 * reinvented. Same 4 mock symbols those routes resolve against
 * (`SENT`/`QUANT`/`BONK`/`ALPHA`); a launch under any other symbol, or by a
 * wallet not associated with one of them, is genuinely unknown to this
 * app's mock data — which is the common case for an actual new launch.
 */
const KNOWN_CREATOR_SYMBOLS = ['SENT', 'QUANT', 'BONK', 'ALPHA'];

interface ScoredLookup {
  score: number;
  known: boolean;
}

export class LaunchRiskEngine {
  /**
   * Pre-flight analysis of a Launch configuration to determine if it is safe to proceed.
   */
  public async analyzePreLaunch(config: LaunchConfig, creatorWallet: string): Promise<LaunchRiskScore> {
    const creatorReputation = await this.getCreatorReputation(config.symbol, creatorWallet);
    const clusteringRisk = await this.analyzeWalletClustering(config.symbol);

    // Effective ownership is nominal allocation + clustered wallet projected buys
    const nominalAllocation = config.creatorAllocation.percentage;
    const effectiveOwnership = nominalAllocation + (clusteringRisk.score > 50 ? 15 : 0); // Mock heuristic

    let score = 0;
    const concerns: string[] = [];

    // Evaluate Allocation — 15% is the platform's published hard cap
    // (docs/architecture/11-launchpad-and-reputation.md; reconciled here and
    // in docs/contracts/09-creator-accountability-and-reputation.md,
    // Sprint 36 — this file previously used an unrelated >10%/>5% scale).
    if (nominalAllocation > 15) {
      score += 50;
      concerns.push("Creator allocation exceeds the platform's 15% hard cap.");
    } else if (nominalAllocation > 10) {
      score += 20;
      concerns.push('Creator allocation is approaching the 15% cap.');
    } else if (nominalAllocation > 5) {
      score += 10;
    }

    // Evaluate Effective Ownership
    if (effectiveOwnership > 20) {
      score += 30;
      concerns.push(`Effective ownership estimated at ${effectiveOwnership}%. High risk of supply control.`);
    }

    // Evaluate Reputation
    if (creatorReputation.score < 40) {
      score += 25;
      concerns.push('Creator has low reputation or history of abandoned launches.');
    }
    if (!creatorReputation.known) {
      score += 10;
      concerns.push("Creator identity/reputation could not be verified — new or unrecognized address.");
    }

    // Clamp score
    const finalScore = Math.min(100, Math.max(0, score));

    let level = RiskLevel.LOW;
    if (finalScore >= 80) level = RiskLevel.CRITICAL;
    else if (finalScore >= 50) level = RiskLevel.HIGH;
    else if (finalScore >= 25) level = RiskLevel.MEDIUM;

    return {
      overallScore: finalScore,
      riskLevel: level,
      effectiveOwnershipPercentage: effectiveOwnership,
      walletClusteringScore: clusteringRisk.score,
      creatorReputationScore: creatorReputation.score,
      primaryConcern: concerns.length > 0 ? concerns[0] : undefined
    };
  }

  private async getCreatorReputation(symbol: string, wallet: string): Promise<ScoredLookup> {
    let entity = computeCreatorEntity(symbol);
    if (!entity) {
      for (const sym of KNOWN_CREATOR_SYMBOLS) {
        const candidate = computeCreatorEntity(sym);
        if (candidate && (candidate.primaryAddress === wallet || candidate.creatorId.includes(wallet))) {
          entity = candidate;
          break;
        }
      }
    }

    // A real score can still be `null` (insufficient launch history for a confident
    // read, e.g. QUANT) — that's a genuine "can't vouch for this" case, same caution
    // as not finding the creator at all, not a reason to fall back to a flat guess.
    if (entity && entity.reputation.score !== null) {
      return { score: entity.reputation.score, known: true };
    }
    return { score: 50, known: false }; // neutral, not the old stub's flat optimistic 85
  }

  private async analyzeWalletClustering(symbol: string): Promise<ScoredLookup> {
    const report = computeOwnershipReport(symbol);
    if (report) {
      return { score: report.concentration.topClusterPct, known: true };
    }
    return { score: 25, known: false }; // documented "insufficient data" default, not the old stub's flat 10
  }
}
