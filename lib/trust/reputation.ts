import { EntityType, ReputationProfile, ReputationCategory, ConfidenceLevel } from './types';
import { ReputationEvidenceEngine } from './evidence';

export class ReputationEngine {
  private evidenceEngine = new ReputationEvidenceEngine();

  public async getProfile(entityType: EntityType, entityId: string): Promise<ReputationProfile> {
    const evidence = await this.evidenceEngine.fetchEvidenceLog(entityId);
    
    // Determine confidence based on amount and quality of evidence
    let confidence = ConfidenceLevel.LOW;
    if (evidence.length > 10) confidence = ConfidenceLevel.HIGH;
    else if (evidence.length > 3) confidence = ConfidenceLevel.MODERATE;

    // Handle Cold Start
    if (evidence.length === 0) {
      return {
        entityId,
        entityType,
        overallScore: null,
        confidenceLevel: ConfidenceLevel.LOW,
        reputationCategory: ReputationCategory.NEW,
        dimensions: [],
        topEvidence: [],
        badges: ['NEW']
      };
    }

    // Apply basic decay math (mock)
    let rawScore = 50; // Base score
    for (const ev of evidence) {
      const daysOld = (Date.now() - new Date(ev.timestamp).getTime()) / 86400000;
      const decayFactor = Math.max(0.2, 1 - (daysOld * 0.01)); // Decay over 100 days down to 20% impact
      rawScore += (ev.impact * decayFactor);
    }
    
    const finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));

    let category = ReputationCategory.MODERATE;
    if (finalScore >= 90) category = ReputationCategory.EXCELLENT;
    else if (finalScore >= 75) category = ReputationCategory.GOOD;
    else if (finalScore < 40) category = ReputationCategory.LOW;

    return {
      entityId,
      entityType,
      overallScore: finalScore,
      confidenceLevel: confidence,
      reputationCategory: category,
      dimensions: [
        { dimension: 'INTEGRITY', score: finalScore + 2 },
        { dimension: 'RELIABILITY', score: finalScore - 5 },
        { dimension: 'TRANSPARENCY', score: finalScore },
        { dimension: 'LONGEVITY', score: finalScore - 10 },
        { dimension: 'MARKET_BEHAVIOR', score: finalScore + 5 }
      ],
      topEvidence: evidence.slice(0, 5),
      badges: finalScore >= 75 ? ['✓ Established', '✓ High Integrity'] : ['⚠ Needs Monitoring']
    };
  }
}
