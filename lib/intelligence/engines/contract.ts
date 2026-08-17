/**
 * Contract Intelligence Engine
 *
 * Inspects mint authority, freeze authority, supply controls, metadata,
 * program relationships. Produces factual signals without claiming
 * malicious intent.
 *
 * Example: "Mint authority remains active" — then explains why it matters.
 */

import type {
  EngineResult,
  IntelligenceSignal,
  Evidence,
  MissingDataEntry,
  RiskDimension,
  DimensionStatus,
  ContractObservation,
  AuthorityState,
} from '../types';

const METHODOLOGY_VERSION = 'contract-v1.0.0';

export interface ContractInput {
  tokenId: string;
  chain: string;
  name: string;
  symbol: string;

  // Authorities
  mintAuthorityStatus: 'ACTIVE' | 'REVOKED' | 'UNKNOWN';
  mintAuthorityAddress?: string;
  freezeAuthorityStatus: 'ACTIVE' | 'REVOKED' | 'UNKNOWN';
  freezeAuthorityAddress?: string;

  // Supply
  totalSupply: string;
  circulatingSupply?: string;
  supplyChangeable: boolean;

  // Metadata
  metadataUri?: string;
  metadataChangeable: boolean;

  // Program
  programId?: string;
  isUpgradeable?: boolean;

  dataTimestamp: string;
}

export interface ContractResult extends EngineResult {
  contractObservation: ContractObservation;
}

export function analyzeContract(input: ContractInput): ContractResult {
  const now = new Date().toISOString();
  const signals: IntelligenceSignal[] = [];
  const evidence: Evidence[] = [];
  const missingData: MissingDataEntry[] = [];
  let dataAvail = 0;
  const totalChecks = 7;

  // ── Mint Authority ──
  if (input.mintAuthorityStatus !== 'UNKNOWN') {
    dataAvail++;
    const mintEv: Evidence = {
      fact: `Mint authority: ${input.mintAuthorityStatus}${input.mintAuthorityAddress ? ` (${input.mintAuthorityAddress.slice(0, 8)}...)` : ''}`,
      source: 'blockchain',
      observedAt: input.dataTimestamp,
      value: input.mintAuthorityStatus,
      confidence: 0.98,
    };
    evidence.push(mintEv);

    if (input.mintAuthorityStatus === 'ACTIVE') {
      signals.push(mkSig('MINT_AUTHORITY_ACTIVE', 'INFO', 'NEUTRAL',
        'Active', 0.98,
        [{
          fact: 'Mint authority remains active — the token creator or designated authority can mint additional tokens. This is common for many legitimate tokens but means the circulating supply could increase.',
          source: 'blockchain', observedAt: input.dataTimestamp, confidence: 0.98,
        }], now));
    } else if (input.mintAuthorityStatus === 'REVOKED') {
      signals.push(mkSig('MINT_AUTHORITY_REVOKED', 'INFO', 'POSITIVE',
        'Revoked', 0.98,
        [{
          fact: 'Mint authority has been revoked — no additional tokens can be minted. The supply is fixed.',
          source: 'blockchain', observedAt: input.dataTimestamp, confidence: 0.98,
        }], now));
    }
  } else {
    missingData.push({ category: 'CONTRACT', description: 'Mint authority status unknown', impact: 'REDUCES_CONFIDENCE' });
  }

  // ── Freeze Authority ──
  if (input.freezeAuthorityStatus !== 'UNKNOWN') {
    dataAvail++;
    evidence.push({
      fact: `Freeze authority: ${input.freezeAuthorityStatus}`,
      source: 'blockchain',
      observedAt: input.dataTimestamp,
      value: input.freezeAuthorityStatus,
      confidence: 0.98,
    });

    if (input.freezeAuthorityStatus === 'ACTIVE') {
      signals.push(mkSig('FREEZE_AUTHORITY_ACTIVE', 'LOW', 'NEUTRAL',
        'Active', 0.98,
        [{
          fact: 'Freeze authority is active — token accounts could potentially be frozen by the authority holder. This is a standard SPL Token feature but limits holder autonomy.',
          source: 'blockchain', observedAt: input.dataTimestamp, confidence: 0.98,
        }], now));
    } else if (input.freezeAuthorityStatus === 'REVOKED') {
      signals.push(mkSig('FREEZE_AUTHORITY_REVOKED', 'INFO', 'POSITIVE',
        'Revoked', 0.98,
        [{
          fact: 'Freeze authority has been revoked — token accounts cannot be frozen.',
          source: 'blockchain', observedAt: input.dataTimestamp, confidence: 0.98,
        }], now));
    }
  } else {
    missingData.push({ category: 'CONTRACT', description: 'Freeze authority status unknown', impact: 'REDUCES_CONFIDENCE' });
  }

  // ── Supply ──
  if (input.totalSupply) {
    dataAvail++;
    evidence.push({
      fact: `Total supply: ${input.totalSupply}`,
      source: 'blockchain',
      observedAt: input.dataTimestamp,
      value: input.totalSupply,
      confidence: 0.97,
    });
  }

  if (input.supplyChangeable) {
    dataAvail++;
    signals.push(mkSig('SUPPLY_CHANGEABLE', 'LOW', 'NEUTRAL',
      'Yes', 0.95,
      [{
        fact: 'Token supply can be changed — additional tokens may be created or existing ones burned.',
        source: 'blockchain', observedAt: input.dataTimestamp, confidence: 0.95,
      }], now));
  } else {
    dataAvail++;
  }

  // ── Metadata Changeability ──
  if (input.metadataChangeable) {
    dataAvail++;
    signals.push(mkSig('METADATA_CHANGEABLE', 'INFO', 'NEUTRAL',
      'Yes', 0.90,
      [{
        fact: 'Token metadata (name, symbol, logo) can be updated by the authority.',
        source: 'blockchain', observedAt: input.dataTimestamp, confidence: 0.90,
      }], now));
  } else {
    dataAvail++;
  }

  // ── Upgradeability ──
  if (input.isUpgradeable != null) {
    dataAvail++;
    if (input.isUpgradeable) {
      signals.push(mkSig('PROGRAM_UPGRADEABLE', 'LOW', 'NEUTRAL',
        'Yes', 0.92,
        [{
          fact: 'The token program is upgradeable — behavior could change in the future.',
          source: 'blockchain', observedAt: input.dataTimestamp, confidence: 0.92,
        }], now));
    }
  } else {
    missingData.push({ category: 'CONTRACT', description: 'Program upgradeability status unknown', impact: 'INFORMATIONAL' });
  }

  // ── Score ──
  let score = 50;

  // Revoked authorities = positive
  if (input.mintAuthorityStatus === 'REVOKED') score += 15;
  else if (input.mintAuthorityStatus === 'ACTIVE') score -= 5; // Slight concern, not punitive

  if (input.freezeAuthorityStatus === 'REVOKED') score += 10;
  else if (input.freezeAuthorityStatus === 'ACTIVE') score -= 5;

  if (!input.supplyChangeable) score += 5;
  if (!input.metadataChangeable) score += 3;
  if (input.isUpgradeable === false) score += 5;

  // Unknown states don't penalize score — they reduce confidence
  score = Math.max(0, Math.min(100, score));
  const confidence = (dataAvail / totalChecks) * 0.90;
  const level = sToStatus(score);

  const mintAuthority: AuthorityState = {
    status: input.mintAuthorityStatus,
    address: input.mintAuthorityAddress,
    explanation: input.mintAuthorityStatus === 'ACTIVE'
      ? 'Mint authority is active — additional tokens can be created'
      : input.mintAuthorityStatus === 'REVOKED'
        ? 'Mint authority revoked — supply is fixed'
        : 'Mint authority status could not be determined',
  };

  const freezeAuthority: AuthorityState = {
    status: input.freezeAuthorityStatus,
    address: input.freezeAuthorityAddress,
    explanation: input.freezeAuthorityStatus === 'ACTIVE'
      ? 'Freeze authority is active — accounts can be frozen'
      : input.freezeAuthorityStatus === 'REVOKED'
        ? 'Freeze authority revoked — accounts cannot be frozen'
        : 'Freeze authority status could not be determined',
  };

  const contractObservation: ContractObservation = {
    tokenId: input.tokenId,
    chain: input.chain,
    mintAuthority,
    freezeAuthority,
    totalSupply: input.totalSupply,
    circulatingSupply: input.circulatingSupply,
    supplyChangeable: input.supplyChangeable,
    metadataUri: input.metadataUri,
    metadataChangeable: input.metadataChangeable,
    name: input.name,
    symbol: input.symbol,
    programId: input.programId,
    isUpgradeable: input.isUpgradeable,
    observedAt: now,
    dataCompleteness: dataAvail / totalChecks,
  };

  return {
    dimension: { category: 'CONTRACT', score, level, confidence, evidence, signals, lastUpdated: now },
    signals,
    missingData,
    contractObservation,
  };
}

function sToStatus(s: number): DimensionStatus {
  if (s >= 75) return 'STRONG';
  if (s >= 55) return 'MODERATE';
  if (s >= 35) return 'ELEVATED';
  return 'UNKNOWN';
}

function mkSig(
  type: string, severity: IntelligenceSignal['severity'],
  polarity: IntelligenceSignal['polarity'], value: string | number,
  confidence: number, evidence: Evidence[], now: string,
): IntelligenceSignal {
  return {
    id: `sig_con_${type.toLowerCase()}_${Date.now()}`,
    type, category: 'CONTRACT', severity, polarity, value, confidence,
    evidence, observedAt: now, methodologyVersion: METHODOLOGY_VERSION, metadata: {},
  };
}
