/**
 * Token Security Engine (Sprint 30 — Tier 5).
 *
 * Wires Birdeye's token-security payload (`lib/api/birdeye/security.ts`,
 * fetched elsewhere but never consumed by any engine before this) into the
 * CONTRACT risk dimension. Covers two branches:
 *
 * - EVM honeypot/tax fields (`isHoneypot`, `buyTax`, `sellTax`,
 *   `cannotSellAll`, `honeypotWithSameCreator`) — present for honesty and
 *   future-proofing, but Birdeye's Solana endpoint doesn't populate these,
 *   so for this app's actual traffic today they're almost always absent.
 * - Solana-relevant fields actually returned by the Solana endpoint
 *   (`transferFeeEnable`, `nonTransferable`, `isToken2022`) — these are the
 *   fields with real, live value for this app today. A Token-2022 transfer
 *   fee is a real sell-tax equivalent; `nonTransferable` means the token
 *   literally cannot be sold at all.
 *
 * Mirrors `contract.ts`'s shape and "unknown doesn't penalize" convention:
 * a field that's simply absent produces a `MissingDataEntry`, not a score
 * penalty — only a field that's actually present and dangerous counts.
 */

import type { Evidence, IntelligenceSignal, MissingDataEntry } from '../types';
import type { TokenSecurityData } from '@/lib/api/birdeye/security';

const METHODOLOGY_VERSION = 'token-security-v1.0.0';

export interface TokenSecurityInput {
  tokenId: string;
  chain: string;
  dataTimestamp: string;
  security: TokenSecurityData;
}

export interface TokenSecurityResult {
  signals: IntelligenceSignal[];
  evidence: Evidence[];
  missingData: MissingDataEntry[];
  /** Added into the CONTRACT dimension's score by the caller, clamped to [0, 100] there. */
  scoreAdjustment: number;
}

const EVM_TAX_WARN_THRESHOLD_PCT = 10;

export function evaluateTokenSecurity(input: TokenSecurityInput): TokenSecurityResult {
  const now = new Date().toISOString();
  const { security, dataTimestamp } = input;
  const signals: IntelligenceSignal[] = [];
  const evidence: Evidence[] = [];
  let scoreAdjustment = 0;
  let anyFieldPresent = false;

  // ── EVM branch ──
  if (isTruthyFlag(security.isHoneypot)) {
    anyFieldPresent = true;
    scoreAdjustment -= 50;
    signals.push(mkSig(input, 'HONEYPOT_DETECTED', 'CRITICAL', 'NEGATIVE', 'true', 0.9, [
      { fact: 'This token is flagged as a honeypot — buying may work but selling is blocked or fails.', source: 'birdeye_security', observedAt: dataTimestamp, confidence: 0.9 },
    ], now));
  } else if (security.isHoneypot != null) {
    anyFieldPresent = true;
  }

  if (isTruthyFlag(security.cannotSellAll)) {
    anyFieldPresent = true;
    scoreAdjustment -= 40;
    signals.push(mkSig(input, 'CANNOT_SELL_ALL', 'CRITICAL', 'NEGATIVE', 'true', 0.85, [
      { fact: 'Holders cannot sell their entire balance — a partial-sell restriction consistent with honeypot-style contracts.', source: 'birdeye_security', observedAt: dataTimestamp, confidence: 0.85 },
    ], now));
  } else if (security.cannotSellAll != null) {
    anyFieldPresent = true;
  }

  if (isTruthyFlag(security.honeypotWithSameCreator)) {
    anyFieldPresent = true;
    scoreAdjustment -= 30;
    signals.push(mkSig(input, 'CREATOR_LINKED_HONEYPOT', 'CRITICAL', 'NEGATIVE', 'true', 0.8, [
      { fact: "This token's creator has deployed other tokens flagged as honeypots.", source: 'birdeye_security', observedAt: dataTimestamp, confidence: 0.8 },
    ], now));
  } else if (security.honeypotWithSameCreator != null) {
    anyFieldPresent = true;
  }

  for (const [field, label] of [['buyTax', 'Buy'], ['sellTax', 'Sell']] as const) {
    const raw = security[field];
    if (raw == null) continue;
    anyFieldPresent = true;
    const pct = parseFloat(raw);
    if (Number.isFinite(pct) && pct > EVM_TAX_WARN_THRESHOLD_PCT) {
      scoreAdjustment -= 15;
      signals.push(mkSig(input, `HIGH_${field.toUpperCase()}`, 'HIGH', 'NEGATIVE', pct, 0.85, [
        { fact: `${label} tax is ${pct}% — well above typical (${EVM_TAX_WARN_THRESHOLD_PCT}%+ is a common threshold for concern).`, source: 'birdeye_security', observedAt: dataTimestamp, value: pct, confidence: 0.85 },
      ], now));
    }
  }

  // ── Solana branch ──
  if (security.nonTransferable != null) {
    anyFieldPresent = true;
    if (security.nonTransferable) {
      scoreAdjustment -= 50;
      signals.push(mkSig(input, 'NON_TRANSFERABLE', 'CRITICAL', 'NEGATIVE', 'true', 0.95, [
        { fact: 'This token is marked non-transferable — it cannot be sent or sold to another wallet at all.', source: 'birdeye_security', observedAt: dataTimestamp, confidence: 0.95 },
      ], now));
    }
  }

  if (security.transferFeeEnable != null) {
    anyFieldPresent = true;
    if (security.transferFeeEnable) {
      scoreAdjustment -= 10;
      signals.push(mkSig(input, 'TRANSFER_FEE_ENABLED', 'MEDIUM', 'NEGATIVE', 'true', 0.9, [
        { fact: 'This Token-2022 mint has a transfer fee enabled — a sell-tax equivalent deducted on every transfer, including sales.', source: 'birdeye_security', observedAt: dataTimestamp, confidence: 0.9 },
      ], now));
    }
  }

  if (security.isToken2022 != null) {
    anyFieldPresent = true;
    if (security.isToken2022 && security.freezeable) {
      signals.push(mkSig(input, 'TOKEN2022_FREEZEABLE', 'LOW', 'NEGATIVE', 'true', 0.75, [
        { fact: 'This is a Token-2022 mint with an active freeze authority — a combination that carries more holder-restriction capability than a standard SPL token.', source: 'birdeye_security', observedAt: dataTimestamp, confidence: 0.75 },
      ], now));
    }
  }

  const missingData: MissingDataEntry[] = anyFieldPresent
    ? []
    : [{ category: 'CONTRACT', description: 'Token security screening data unavailable', impact: 'INFORMATIONAL' }];

  return { signals, evidence, missingData, scoreAdjustment };
}

/** GoPlus-style fields come through as string-encoded booleans ("1"/"0"), not real booleans. */
function isTruthyFlag(value: string | null | undefined): boolean {
  return value === '1' || value === 'true';
}

function mkSig(
  input: TokenSecurityInput,
  type: string,
  severity: IntelligenceSignal['severity'],
  polarity: IntelligenceSignal['polarity'],
  value: string | number,
  confidence: number,
  evidence: Evidence[],
  now: string,
): IntelligenceSignal {
  return {
    id: `sig_tsec_${type.toLowerCase()}_${input.tokenId}`,
    type,
    category: 'CONTRACT',
    severity,
    polarity,
    value,
    confidence,
    evidence,
    observedAt: now,
    methodologyVersion: METHODOLOGY_VERSION,
    metadata: {},
  };
}
