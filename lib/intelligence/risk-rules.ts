/**
 * Risk Rule Engine
 *
 * Modular, versioned rules. Each rule evaluates signals and produces
 * additional IntelligenceSignals when conditions are met.
 * Rules are never embedded in UI components.
 */

import type {
  IntelligenceSignal,
  Evidence,
  RiskCategory,
  Severity,
  RiskRuleDefinition,
  RiskDimension,
} from './types';

const RULES_VERSION = 'rules-v1.0.0';

export interface RiskRule extends RiskRuleDefinition {
  evaluate(dimensions: Partial<Record<RiskCategory, RiskDimension>>): IntelligenceSignal | null;
}

/**
 * Core risk rules — modular, versioned, deterministic.
 */
export function getRiskRules(): RiskRule[] {
  return [
    // ── LIQUIDITY RULES ──
    {
      id: 'LIQ_001',
      category: 'LIQUIDITY',
      severity: 'CRITICAL',
      explanation: 'Rapid liquidity withdrawal combined with low remaining liquidity indicates severe exit risk',
      methodologyVersion: RULES_VERSION,
      evaluate: (dims) => {
        const liq = dims.LIQUIDITY;
        if (!liq) return null;
        const hasRapidWithdrawal = liq.signals.some(s => s.type === 'SEVERE_LIQUIDITY_WITHDRAWAL' || s.type === 'SIGNIFICANT_LIQUIDITY_WITHDRAWAL');
        const lowLiquidity = liq.signals.some(s => s.type === 'VERY_LOW_LIQUIDITY' || s.type === 'LOW_LIQUIDITY');
        if (hasRapidWithdrawal && lowLiquidity) {
          return mkRuleSig('LIQUIDITY_COLLAPSE_RISK', 'LIQUIDITY', 'CRITICAL', 'NEGATIVE',
            'Rapid withdrawal + low remaining liquidity',
            [{ fact: 'Liquidity is being rapidly removed and remaining depth is very low', source: 'rule_engine', observedAt: new Date().toISOString(), confidence: 0.94 }]);
        }
        return null;
      },
    },
    {
      id: 'LIQ_002',
      category: 'LIQUIDITY',
      severity: 'MEDIUM',
      explanation: 'Single pool concentration creates dependency risk',
      methodologyVersion: RULES_VERSION,
      evaluate: (dims) => {
        const liq = dims.LIQUIDITY;
        if (!liq) return null;
        if (liq.signals.some(s => s.type === 'SINGLE_POOL')) {
          return mkRuleSig('SINGLE_POOL_DEPENDENCY', 'LIQUIDITY', 'MEDIUM', 'NEGATIVE',
            'All liquidity in one pool',
            [{ fact: 'Token liquidity exists in a single pool — removal of this pool would eliminate all liquidity', source: 'rule_engine', observedAt: new Date().toISOString(), confidence: 0.92 }]);
        }
        return null;
      },
    },

    // ── OWNERSHIP RULES ──
    {
      id: 'OWN_001',
      category: 'OWNERSHIP',
      severity: 'HIGH',
      explanation: 'Extreme concentration in a single holder indicates high exit risk if that holder sells',
      methodologyVersion: RULES_VERSION,
      evaluate: (dims) => {
        const own = dims.OWNERSHIP;
        if (!own) return null;
        if (own.signals.some(s => s.type === 'EXTREME_CONCENTRATION')) {
          return mkRuleSig('WHALE_DOMINANCE', 'OWNERSHIP', 'HIGH', 'NEGATIVE',
            'Single holder dominates supply',
            [{ fact: 'A single holder controls a majority of token supply — large sell from this wallet could severely impact price', source: 'rule_engine', observedAt: new Date().toISOString(), confidence: 0.91 }]);
        }
        return null;
      },
    },
    {
      id: 'OWN_002',
      category: 'OWNERSHIP',
      severity: 'LOW',
      explanation: 'Broad and growing holder base is a positive indicator',
      methodologyVersion: RULES_VERSION,
      evaluate: (dims) => {
        const own = dims.OWNERSHIP;
        if (!own) return null;
        const broadBase = own.signals.some(s => s.type === 'BROAD_HOLDER_BASE');
        const growing = own.signals.some(s => s.type === 'HOLDER_GROWTH');
        if (broadBase && growing) {
          return mkRuleSig('HEALTHY_DISTRIBUTION', 'OWNERSHIP', 'INFO', 'POSITIVE',
            'Broad and growing holder base',
            [{ fact: 'Token has a broad holder base that is actively growing', source: 'rule_engine', observedAt: new Date().toISOString(), confidence: 0.88 }]);
        }
        return null;
      },
    },

    // ── ACTIVITY RULES ──
    {
      id: 'ACT_001',
      category: 'ACTIVITY',
      severity: 'MEDIUM',
      explanation: 'High repeat wallet ratio combined with volume concentration suggests activity may not be broadly organic',
      methodologyVersion: RULES_VERSION,
      evaluate: (dims) => {
        const act = dims.ACTIVITY;
        if (!act) return null;
        const repeatWallets = act.signals.some(s => s.type === 'HIGH_REPEAT_WALLETS');
        const volumeConc = act.signals.some(s => s.type === 'VOLUME_CONCENTRATION');
        if (repeatWallets && volumeConc) {
          return mkRuleSig('CONCENTRATED_ACTIVITY_PATTERN', 'ACTIVITY', 'MEDIUM', 'NEGATIVE',
            'Activity concentrated in repeat wallets',
            [{ fact: 'Trading activity is concentrated among repeat wallets with high volume concentration — activity diversity is limited', source: 'rule_engine', observedAt: new Date().toISOString(), confidence: 0.84 }]);
        }
        return null;
      },
    },
    {
      id: 'ACT_002',
      category: 'ACTIVITY',
      severity: 'INFO',
      explanation: 'Diverse wallet participation is a positive activity signal',
      methodologyVersion: RULES_VERSION,
      evaluate: (dims) => {
        const act = dims.ACTIVITY;
        if (!act) return null;
        if (act.signals.some(s => s.type === 'DIVERSE_WALLETS')) {
          return mkRuleSig('ORGANIC_ACTIVITY_INDICATOR', 'ACTIVITY', 'INFO', 'POSITIVE',
            'Diverse wallet participation',
            [{ fact: 'Activity involves many unique wallets — suggests broader market participation', source: 'rule_engine', observedAt: new Date().toISOString(), confidence: 0.82 }]);
        }
        return null;
      },
    },

    // ── CONTRACT RULES ──
    {
      id: 'CON_001',
      category: 'CONTRACT',
      severity: 'MEDIUM',
      explanation: 'Active mint + freeze authorities together give the creator significant control',
      methodologyVersion: RULES_VERSION,
      evaluate: (dims) => {
        const con = dims.CONTRACT;
        if (!con) return null;
        const mintActive = con.signals.some(s => s.type === 'MINT_AUTHORITY_ACTIVE');
        const freezeActive = con.signals.some(s => s.type === 'FREEZE_AUTHORITY_ACTIVE');
        if (mintActive && freezeActive) {
          return mkRuleSig('FULL_AUTHORITY_CONTROL', 'CONTRACT', 'MEDIUM', 'NEGATIVE',
            'Both mint and freeze authorities active',
            [{ fact: 'Both mint authority and freeze authority remain active — the authority holder can mint new tokens and freeze accounts', source: 'rule_engine', observedAt: new Date().toISOString(), confidence: 0.95 }]);
        }
        return null;
      },
    },
    {
      id: 'CON_002',
      category: 'CONTRACT',
      severity: 'INFO',
      explanation: 'Fully revoked authorities indicate a more autonomous token',
      methodologyVersion: RULES_VERSION,
      evaluate: (dims) => {
        const con = dims.CONTRACT;
        if (!con) return null;
        const mintRevoked = con.signals.some(s => s.type === 'MINT_AUTHORITY_REVOKED');
        const freezeRevoked = con.signals.some(s => s.type === 'FREEZE_AUTHORITY_REVOKED');
        if (mintRevoked && freezeRevoked) {
          return mkRuleSig('FULLY_AUTONOMOUS', 'CONTRACT', 'INFO', 'POSITIVE',
            'All authorities revoked',
            [{ fact: 'Both mint and freeze authorities have been revoked — token operates autonomously', source: 'rule_engine', observedAt: new Date().toISOString(), confidence: 0.97 }]);
        }
        return null;
      },
    },

    // ── MARKET + LIQUIDITY CROSS-DIMENSION RULES ──
    {
      id: 'CROSS_001',
      category: 'MARKET',
      severity: 'HIGH',
      explanation: 'Low activity combined with low liquidity makes the market fragile',
      methodologyVersion: RULES_VERSION,
      evaluate: (dims) => {
        const mkt = dims.MARKET;
        const liq = dims.LIQUIDITY;
        if (!mkt || !liq) return null;
        const lowActivity = mkt.signals.some(s => s.type === 'LOW_ACTIVITY');
        const lowLiq = liq.signals.some(s => s.type === 'LOW_LIQUIDITY' || s.type === 'VERY_LOW_LIQUIDITY');
        if (lowActivity && lowLiq) {
          return mkRuleSig('FRAGILE_MARKET', 'MARKET', 'HIGH', 'NEGATIVE',
            'Low activity + low liquidity',
            [{ fact: 'Both trading activity and liquidity are low — market is fragile and positions may be difficult to exit', source: 'rule_engine', observedAt: new Date().toISOString(), confidence: 0.90 }]);
        }
        return null;
      },
    },

    // ── EXIT RULES ──
    {
      id: 'EXIT_001',
      category: 'EXIT',
      severity: 'HIGH',
      explanation: 'High price impact at moderate sell sizes indicates poor exitability',
      methodologyVersion: RULES_VERSION,
      evaluate: (dims) => {
        const exit = dims.EXIT;
        if (!exit) return null;
        if (exit.signals.some(s => s.type === 'HIGH_IMPACT_MEDIUM_SELL')) {
          return mkRuleSig('DIFFICULT_EXIT', 'EXIT', 'HIGH', 'NEGATIVE',
            'High impact at $1K sell',
            [{ fact: 'Estimated price impact exceeds 10% for a $1,000 sell — exiting a position of this size would significantly move the market', source: 'rule_engine', observedAt: new Date().toISOString(), confidence: 0.80 }]);
        }
        return null;
      },
    },
  ];
}

/**
 * Evaluate all rules against computed dimensions. Returns additional signals.
 */
export function evaluateRiskRules(
  dimensions: Partial<Record<RiskCategory, RiskDimension>>,
): IntelligenceSignal[] {
  const rules = getRiskRules();
  const results: IntelligenceSignal[] = [];

  for (const rule of rules) {
    const signal = rule.evaluate(dimensions);
    if (signal) {
      results.push(signal);
    }
  }

  return results;
}

function mkRuleSig(
  type: string,
  category: RiskCategory,
  severity: Severity,
  polarity: IntelligenceSignal['polarity'],
  value: string | number,
  evidence: Evidence[],
): IntelligenceSignal {
  return {
    id: `sig_rule_${type.toLowerCase()}_${Date.now()}`,
    type,
    category,
    severity,
    polarity,
    value,
    confidence: evidence[0]?.confidence ?? 0.85,
    evidence,
    observedAt: new Date().toISOString(),
    methodologyVersion: RULES_VERSION,
    metadata: { source: 'risk_rule_engine' },
  };
}
