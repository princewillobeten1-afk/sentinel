/**
 * Personalized Risk Profile & Natural Language Rule Translator (Sprint 37 §25-29).
 *
 * Implements:
 *   1. Explicit Numerical Parameter Mapping for Risk Profiles (Conservative, Balanced, Aggressive, Custom)
 *   2. Natural-Language Alert Rule to Deterministic Trigger Compiler
 *   3. Pre-Trade Personal Risk Rule Evaluation
 */

import { PersonalizedRiskProfile, EvidencePackage } from './types';

export interface DeterministicAlertCondition {
  rawRuleText: string;
  metric: 'liquidity_drop' | 'insider_sell' | 'exitability_drop' | 'creator_transfer';
  thresholdPct?: number;
  thresholdScore?: number;
  triggerEvent: string;
  severity: 'INFO' | 'WATCH' | 'WARNING' | 'HIGH' | 'CRITICAL';
}

export class PersonalizedRiskEngine {
  /**
   * Returns standard parameter configurations for risk profiles (§26).
   */
  public static getProfileParameters(
    profileType: PersonalizedRiskProfile['profileType'],
    userId = 'user_default'
  ): PersonalizedRiskProfile {
    switch (profileType) {
      case 'CONSERVATIVE':
        return {
          id: `prof_cons_${userId}`,
          userId,
          profileType: 'CONSERVATIVE',
          minExitabilityScore: 65,
          maxInsiderConcentrationPct: 25,
          maxTop10HolderPct: 35,
          maxPriceImpactPct: 3.0,
          requireMintRevoked: true,
          customRules: [
            'Do not trade tokens with exitability below 65',
            'Do not trade tokens where top 10 holders control over 35%',
            'Require mint authority to be revoked',
          ],
        };

      case 'AGGRESSIVE':
        return {
          id: `prof_aggr_${userId}`,
          userId,
          profileType: 'AGGRESSIVE',
          minExitabilityScore: 30,
          maxInsiderConcentrationPct: 65,
          maxTop10HolderPct: 60,
          maxPriceImpactPct: 15.0,
          requireMintRevoked: false,
          customRules: ['Allow early sniper curves with exitability >= 30'],
        };

      case 'BALANCED':
      default:
        return {
          id: `prof_bal_${userId}`,
          userId,
          profileType: 'BALANCED',
          minExitabilityScore: 50,
          maxInsiderConcentrationPct: 40,
          maxTop10HolderPct: 45,
          maxPriceImpactPct: 6.0,
          requireMintRevoked: true,
          customRules: [
            'Do not trade tokens with exitability below 50',
            'Max price impact 6%',
          ],
        };
    }
  }

  /**
   * Checks if an asset violates the user's personal risk profile (§25).
   */
  public static evaluateAssetAgainstProfile(
    evidence: EvidencePackage,
    profile: PersonalizedRiskProfile
  ): { passes: boolean; violations: string[] } {
    const violations: string[] = [];

    if (evidence.exitability.exitabilityScore < profile.minExitabilityScore) {
      violations.push(
        `Token Exitability (${evidence.exitability.exitabilityScore}) is below your personal rule threshold (minimum ${profile.minExitabilityScore}).`
      );
    }

    if (evidence.holders.top10HoldersPct > profile.maxTop10HolderPct) {
      violations.push(
        `Top 10 holder concentration (${evidence.holders.top10HoldersPct}%) exceeds your configured limit (${profile.maxTop10HolderPct}%).`
      );
    }

    if (evidence.insiderSignals.insiderConcentrationScore > profile.maxInsiderConcentrationPct) {
      violations.push(
        `Insider concentration score (${evidence.insiderSignals.insiderConcentrationScore}) exceeds your max risk threshold (${profile.maxInsiderConcentrationPct}).`
      );
    }

    if (profile.requireMintRevoked && !evidence.contractRisk.mintAuthorityRevoked) {
      violations.push('Mint authority is not revoked on-chain (violates your required security rule).');
    }

    return {
      passes: violations.length === 0,
      violations,
    };
  }

  /**
   * Translates natural language alert requests into deterministic trigger conditions (§29).
   */
  public static translateAlertRule(naturalLanguageText: string): DeterministicAlertCondition {
    const lower = naturalLanguageText.toLowerCase();

    if (lower.includes('liquidity') && (lower.includes('drop') || lower.includes('decrease') || lower.includes('fall'))) {
      const match = lower.match(/([0-9]+)\s*%/);
      const pct = match ? parseInt(match[1], 10) : 20;
      return {
        rawRuleText: naturalLanguageText,
        metric: 'liquidity_drop',
        thresholdPct: pct,
        triggerEvent: `pool_liquidity_change_24h <= -${pct}%`,
        severity: pct >= 30 ? 'HIGH' : 'WARNING',
      };
    }

    if (lower.includes('insider') || lower.includes('early wallet') || lower.includes('whale sell')) {
      return {
        rawRuleText: naturalLanguageText,
        metric: 'insider_sell',
        triggerEvent: 'insider_cluster_transfer_detected == true',
        severity: 'HIGH',
      };
    }

    if (lower.includes('exitability') || lower.includes('exit')) {
      const match = lower.match(/below\s*([0-9]+)/i);
      const score = match ? parseInt(match[1], 10) : 50;
      return {
        rawRuleText: naturalLanguageText,
        metric: 'exitability_drop',
        thresholdScore: score,
        triggerEvent: `exitability_score < ${score}`,
        severity: 'WARNING',
      };
    }

    // Default fallback
    return {
      rawRuleText: naturalLanguageText,
      metric: 'liquidity_drop',
      thresholdPct: 15,
      triggerEvent: 'pool_liquidity_change_24h <= -15%',
      severity: 'WARNING',
    };
  }
}
