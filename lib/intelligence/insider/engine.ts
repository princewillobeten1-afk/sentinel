// lib/intelligence/insider/engine.ts
import { 
  InsiderSignal, 
  WalletCluster, 
  InsiderCategory, 
  TokenInsiderRisk,
  InsiderRiskProfile,
  DataConfidence
} from './types';

// Mock DB of known entities
const KNOWN_ENTITIES = new Set([
  '0xBinanceHotWallet...',
  '0xCoinbaseHotWallet...',
  '0xUniswapRouter...'
]);

export class InsiderDetectionEngine {

  /**
   * Filters out high-connectivity nodes that would otherwise create massive false-positive clusters.
   */
  public isKnownEntity(walletAddress: string): boolean {
    return KNOWN_ENTITIES.has(walletAddress);
  }

  /**
   * Detects coordinated buying based on a time window and overlapping wallets.
   * In a real system, this would process streaming events.
   */
  public detectCoordinatedBuying(
    tokenId: string, 
    buys: { wallet: string, amountUsd: number, timestamp: number }[],
    timeWindowMs: number = 30000 // default 30s
  ): InsiderSignal | null {
    
    // Simplistic mock coordination detection
    buys.sort((a, b) => a.timestamp - b.timestamp);
    
    const cluster = new Set<string>();
    let totalUsd = 0;

    for (let i = 0; i < buys.length; i++) {
      if (this.isKnownEntity(buys[i].wallet)) continue;
      
      const windowStart = buys[i].timestamp;
      const windowBuys = buys.filter(b => b.timestamp >= windowStart && b.timestamp <= windowStart + timeWindowMs);
      
      if (windowBuys.length >= 3) { // Arbitrary threshold: 3 wallets in window
        windowBuys.forEach(b => {
          cluster.add(b.wallet);
          totalUsd += b.amountUsd;
        });
        break;
      }
    }

    if (cluster.size >= 3) {
      return {
        id: crypto.randomUUID(),
        tokenId,
        category: InsiderCategory.COORDINATED_BUYING,
        confidence: 85,
        timeWindow: `${timeWindowMs / 1000}s`,
        evidence: [
          {
            description: `${cluster.size} wallets bought within a ${timeWindowMs / 1000}s window`,
            weight: 20,
            metadata: { totalUsd }
          }
        ]
      };
    }

    return null;
  }

  /**
   * Calculates the overall Insider Risk profile for a token by aggregating its signals.
   */
  public calculateTokenRisk(tokenId: string, signals: InsiderSignal[], clusteredOwnershipPct: number): TokenInsiderRisk {
    let totalWeight = 0;
    
    for (const signal of signals) {
      totalWeight += signal.evidence.reduce((sum, e) => sum + e.weight, 0);
    }

    // Factor in the cluster ownership percentage
    if (clusteredOwnershipPct > 10) totalWeight += 30;
    else if (clusteredOwnershipPct > 5) totalWeight += 15;

    let riskScore: InsiderRiskProfile = 'LOW';
    if (totalWeight > 80) riskScore = 'CRITICAL';
    else if (totalWeight > 50) riskScore = 'HIGH';
    else if (totalWeight > 20) riskScore = 'MEDIUM';

    // Confidence depends on the confidence of underlying signals
    const avgConfidence = signals.length > 0 
      ? signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length
      : 0;
      
    let dataConfidence: DataConfidence = 'LOW';
    if (avgConfidence > 80) dataConfidence = 'HIGH';
    else if (avgConfidence > 50) dataConfidence = 'MEDIUM';

    return {
      tokenId,
      riskScore,
      confidence: dataConfidence,
      signals,
      clusteredOwnershipPct
    };
  }

}
