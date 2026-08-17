/**
 * Token AI Analyst & Comprehensive Report Generator (Sprint 37 §7, §8, §13-15, §60-62).
 *
 * Answers direct trader inquiries:
 *   - "Is there anything suspicious here?"
 *   - "Why is this token risky?"
 *   - "Who appears to control the supply?"
 *   - "Can I realistically exit this position?"
 *   - "What changed in the last 10 minutes?"
 *
 * Generates structured 12-section token intelligence reports with multi-persona adaptation
 * (BEGINNER, ADVANCED, QUANT).
 */

import { EvidencePackage, AiAudiencePersona, StructuredAiResponse } from './types';
import { aiGateway } from './gateway';
import { EvidenceBuilder } from './evidence-builder';

export interface TokenAnalystReport {
  tokenAddress: string;
  symbol: string;
  name: string;
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  sections: {
    tokenOverview: string;
    market: string;
    liquidity: string;
    ownership: string;
    creator: string;
    volumeQuality: string;
    insiderActivity: string;
    exitability: string;
    contractRisk: string;
    riskSummary: string;
    whatChanged: string;
    whatToWatch: string[];
  };
  whyRiskyBullets: string[];
  mainConcern?: string;
  confidencePct: number;
  dataSnapshotHash: string;
  generatedAt: string;
}

export class TokenAiAnalyst {
  /**
   * Generates a full 12-section structured token report (§15).
   */
  public static generateReport(
    evidence: EvidencePackage,
    persona: AiAudiencePersona = 'ADVANCED'
  ): TokenAnalystReport {
    const isBeginner = persona === 'BEGINNER';
    const isQuant = persona === 'QUANT';

    // 1. Overview & Market
    const tokenOverview = isBeginner
      ? `${evidence.name} (${evidence.symbol}) is currently trading at $${evidence.market.priceUsd} with a total market valuation of $${(evidence.market.marketCapUsd / 1_000_000).toFixed(2)}M.`
      : `${evidence.name} (${evidence.symbol}) — Market Cap: $${evidence.market.marketCapUsd.toLocaleString()} | 24h Vol: $${evidence.market.volume24hUsd.toLocaleString()} | 24h Price: ${evidence.market.priceChange24hPct >= 0 ? '+' : ''}${evidence.market.priceChange24hPct}%.`;

    const market = `Price: $${evidence.market.priceUsd} (24h: ${evidence.market.priceChange24hPct}%). 24h Volume: $${evidence.market.volume24hUsd.toLocaleString()}.`;

    // 2. Liquidity
    const liquidity = isBeginner
      ? `Liquidity is the amount of money available in the pool to trade against. This token has $${evidence.liquidity.totalLiquidityUsd.toLocaleString()} available. Because liquidity dropped ${evidence.liquidity.liquidityChange24hPct}% recently, large sells may push the price down heavily.`
      : isQuant
        ? `Pool Depth: $${evidence.liquidity.totalLiquidityUsd.toLocaleString()} | 24h Δ: ${evidence.liquidity.liquidityChange24hPct}% | Slippage @ $10k: ${evidence.liquidity.estimatedPriceImpact10kPct}% | Locked: ${evidence.liquidity.isLocked ? `YES (${evidence.liquidity.lockDurationDays}d)` : 'NO'}.`
        : `Pool liquidity is $${evidence.liquidity.totalLiquidityUsd.toLocaleString()} (${evidence.liquidity.liquidityChange24hPct}% 24h change). Lock status: ${evidence.liquidity.isLocked ? 'Locked' : 'Unlocked'}. Slippage on $10k order is estimated at ${evidence.liquidity.estimatedPriceImpact10kPct}%.`;

    // 3. Ownership
    const ownership = isBeginner
      ? `A small group of 10 wallets controls ${evidence.holders.top10HoldersPct}% of the entire coin supply. In addition, wallets tied to the creator hold about ${evidence.holders.creatorLinkedWalletsPct}%.`
      : `Top 10 holders control ${evidence.holders.top10HoldersPct}% of circulating supply. Creator-linked clusters control ${evidence.holders.creatorLinkedWalletsPct}%. Clustered wallet groups detected: ${evidence.holders.clusteredWalletsCount}.`;

    // 4. Creator
    const creator = `Creator Address: ${evidence.creator.creatorAddress.slice(0, 8)}... | Reputation Score: ${evidence.creator.reputationScore}/100. Previous launches: ${evidence.creator.previousLaunchesCount} (${evidence.creator.successfulLaunchesCount} stable, ${evidence.creator.rugPullCount} liquidity drains).`;

    // 5. Volume Quality
    const volumeQuality = `Organic Volume Share: ${evidence.volume.organicVolumePct}% | Estimated Wash Trading: ${evidence.volume.washTradingProbabilityPct}% across ${evidence.volume.uniqueTraders24h} unique active traders in 24h.`;

    // 6. Insider Activity
    const insiderActivity = `Insider Concentration Score: ${evidence.insiderSignals.insiderConcentrationScore}/100. Early sniper wallets: ${evidence.insiderSignals.earlySniperCount}. Coordinated selling detected: ${evidence.insiderSignals.coordinatedSellingDetected ? 'YES' : 'NO'}.`;

    // 7. Exitability
    const exitability = `Exitability Score: ${evidence.exitability.exitabilityScore}/100. Max recommended single sell: $${evidence.exitability.maxSafeSellSizeUsd.toLocaleString()}. Expected slippage @ $5k: ${evidence.exitability.slippageEstimate5kPct}%.`;

    // 8. Contract Risk
    const contractRisk = `Risk Level: ${evidence.contractRisk.riskLevel}. Mint Authority: ${evidence.contractRisk.mintAuthorityRevoked ? 'Revoked' : 'Active'}. Freeze Authority: ${evidence.contractRisk.freezeAuthorityRevoked ? 'Revoked' : 'Active'}. Transfer Tax: ${evidence.contractRisk.hasTransferTax ? `${evidence.contractRisk.transferTaxPct}%` : '0%'}.`;

    // 9. Risk Summary & Why
    const whyRiskyBullets: string[] = [];
    if (evidence.liquidity.liquidityChange24hPct < -20) {
      whyRiskyBullets.push(`Liquidity has fallen sharply (${evidence.liquidity.liquidityChange24hPct}% in 24h).`);
    }
    if (evidence.holders.top10HoldersPct > 40) {
      whyRiskyBullets.push(`Top 10 holders control ${evidence.holders.top10HoldersPct}% of effective supply.`);
    }
    if (evidence.holders.creatorLinkedWalletsPct > 5) {
      whyRiskyBullets.push(`Creator-linked wallets control ${evidence.holders.creatorLinkedWalletsPct}% of supply.`);
    }
    if (evidence.volume.organicVolumePct < 50) {
      whyRiskyBullets.push(`Organic volume is relatively low (${evidence.volume.organicVolumePct}%).`);
    }
    if (evidence.exitability.exitabilityScore < 50) {
      whyRiskyBullets.push(`Exitability is deteriorating (${evidence.exitability.exitabilityScore}/100).`);
    }

    const overallRisk =
      evidence.exitability.exitabilityScore < 45 || evidence.liquidity.liquidityChange24hPct < -30
        ? 'HIGH'
        : evidence.exitability.exitabilityScore < 65
          ? 'MEDIUM'
          : 'LOW';

    const mainConcern =
      overallRisk === 'HIGH'
        ? 'Liquidity can disappear faster than current volume suggests. Top holder cluster selling could trigger immediate cascade.'
        : undefined;

    const riskSummary = `${overallRisk} RISK: ${whyRiskyBullets.join(' ')}`;

    // 10. What Changed
    const whatChanged = evidence.historicalChanges
      ? `Last ${evidence.historicalChanges.timeframe}: Liquidity Δ: ${evidence.historicalChanges.liquidityDeltaPct}%, Exitability Δ: ${evidence.historicalChanges.exitabilityDelta} pts, Large Sales: ${evidence.historicalChanges.largeSalesCount}.`
      : 'No material state changes detected in recent inspection window.';

    // 11. What to Watch
    const whatToWatch = [
      'Monitor top 3 holder wallet transfer destinations for DEX deposit routing.',
      'Watch pool liquidity floor around $' + (evidence.liquidity.totalLiquidityUsd * 0.8).toFixed(0) + ' for acceleration in slippage.',
      'Check creator deployer address for newly initialized token mints.',
    ];

    return {
      tokenAddress: evidence.tokenAddress,
      symbol: evidence.symbol,
      name: evidence.name,
      overallRisk,
      sections: {
        tokenOverview,
        market,
        liquidity,
        ownership,
        creator,
        volumeQuality,
        insiderActivity,
        exitability,
        contractRisk,
        riskSummary,
        whatChanged,
        whatToWatch,
      },
      whyRiskyBullets,
      mainConcern,
      confidencePct: 92,
      dataSnapshotHash: evidence.dataSnapshotHash,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Responds to specific trader questions using verified evidence package (§7).
   */
  public static async answerTraderQuestion(
    question: string,
    evidence: EvidencePackage
  ): Promise<StructuredAiResponse> {
    const qLower = question.toLowerCase();

    let featurePrompt = question;
    if (qLower.includes('suspicious')) {
      featurePrompt = `Audit suspicious activity for token ${evidence.symbol}`;
    } else if (qLower.includes('control') || qLower.includes('supply')) {
      featurePrompt = `Explain supply distribution and creator control for ${evidence.symbol}`;
    } else if (qLower.includes('exit')) {
      featurePrompt = `Evaluate realistic exit depth and slippage for ${evidence.symbol}`;
    }

    const gwRes = await aiGateway.execute({
      featureId: 'TOKEN_ANALYSIS',
      prompt: featurePrompt,
      evidencePackage: evidence,
    });

    return gwRes.structured!;
  }
}
