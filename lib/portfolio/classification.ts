/**
 * Transaction Classification Engine (spec §8, §9, §10, §11)
 *
 * Raw chain movements are ambiguous. A token leaving a wallet is not
 * necessarily a sale, and a token arriving is not necessarily a purchase.
 * Misreading either produces false P&L, which is the single worst failure mode
 * of a portfolio tracker.
 *
 * This engine turns `RawLedgerEvent[]` into `ClassifiedEvent[]`, attaching the
 * evidence that justified each call and marking events that must never create
 * realized P&L (`pnlNeutral`).
 *
 * Classification is deliberately conservative: when evidence is weak we fall
 * back to EXTERNAL_TRANSFER / UNKNOWN_ACQUISITION rather than guessing a trade.
 */

import type {
  ClassificationContext,
  ClassifiedEvent,
  CostBasisCertainty,
  RawLedgerEvent,
  TransactionClass,
} from './types';
import { evidence, toTimestamp } from './utils';

const DEFAULT_PAIRING_WINDOW_SECONDS = 900; // 15 minutes

interface PairIndex {
  /** eventId → matching counter-leg eventId. */
  transferPairs: Map<string, string>;
  bridgePairs: Map<string, string>;
  migrationPairs: Map<string, string>;
}

export function classifyEvents(
  events: RawLedgerEvent[],
  context: ClassificationContext,
): ClassifiedEvent[] {
  const owned = new Set(context.ownedWallets.map(normalizeAddress));
  const related = new Set((context.relatedWallets ?? []).map(normalizeAddress));
  const windowSeconds = context.pairingWindowSeconds ?? DEFAULT_PAIRING_WINDOW_SECONDS;

  const ordered = [...events].sort((a, b) => toTimestamp(a.timestamp) - toTimestamp(b.timestamp));
  const pairs = buildPairIndex(ordered, owned, windowSeconds);

  return ordered.map((event) => classifyOne(event, { owned, related, pairs, context }));
}

interface ClassifyDeps {
  owned: Set<string>;
  related: Set<string>;
  pairs: PairIndex;
  context: ClassificationContext;
}

function classifyOne(event: RawLedgerEvent, deps: ClassifyDeps): ClassifiedEvent {
  const reasons: string[] = [];
  const ev = [] as ClassifiedEvent['evidence'];
  const at = event.timestamp;

  // ── Failed / dropped / reorged events never affect position state ──
  if (event.status === 'FAILED' || event.status === 'DROPPED' || event.status === 'REORGED') {
    reasons.push(`Chain event status is ${event.status}; excluded from position state`);
    return build(event, 'IGNORED', 1, 'UNKNOWN', true, ev, reasons);
  }

  // ── Migrations (spec §11) ──
  const migrationTarget = deps.context.migrationMap?.[event.tokenId];
  const migrationPair = deps.pairs.migrationPairs.get(event.id);
  if (event.source === 'MIGRATION' || event.hints?.migrationFromTokenId || migrationTarget) {
    const cls: TransactionClass = event.direction === 'IN' ? 'MIGRATION_IN' : 'MIGRATION_OUT';
    reasons.push('Token migration detected; economic history is preserved across the migration');
    ev.push(
      evidence(
        event.direction === 'IN'
          ? `Received ${event.symbol} as the destination side of a token migration`
          : `Burned/sent ${event.symbol} as the source side of a token migration`,
        'migration_detection',
        at,
        event.hints?.migrationFromTokenId ?? migrationTarget?.toTokenId ?? event.tokenId,
        migrationPair ? 0.92 : 0.75,
      ),
    );
    return build(event, cls, migrationPair ? 0.92 : 0.75, 'CARRIED_OVER', true, ev, reasons);
  }

  // ── Bridges (spec §10) ──
  const bridgePair = deps.pairs.bridgePairs.get(event.id);
  if (event.source === 'BRIDGE' || event.hints?.bridgeId) {
    const crossChain = Boolean(event.counterpartyChain && event.counterpartyChain !== event.chain);
    const cls: TransactionClass = event.direction === 'IN' ? 'BRIDGE_IN' : 'BRIDGE_OUT';
    const confidence = bridgePair ? 0.93 : crossChain ? 0.8 : 0.65;
    reasons.push('Bridge transfer detected; not interpreted as a sell on one chain and a buy on the other');
    ev.push(
      evidence(
        `Bridge ${event.direction === 'IN' ? 'inbound' : 'outbound'} leg via ${event.hints?.bridgeProtocol ?? 'a supported bridge'}`,
        'bridge_detection',
        at,
        event.hints?.bridgeId ?? event.txHash,
        confidence,
      ),
    );
    if (bridgePair) {
      ev.push(evidence('Matching counter-leg observed on the destination chain', 'bridge_pairing', at, bridgePair, 0.9));
    }
    return build(event, cls, confidence, 'CARRIED_OVER', true, ev, reasons);
  }

  // ── DEX swaps: the only events that create realized P&L ──
  if (event.source === 'DEX_SWAP') {
    const cls: TransactionClass = event.direction === 'IN' ? 'BUY' : 'SELL';
    const hasPrice = typeof event.pricePerTokenUsd === 'number' && Number.isFinite(event.pricePerTokenUsd);
    reasons.push(`Swap on a DEX venue classified as ${cls}`);
    ev.push(
      evidence(
        `${cls === 'BUY' ? 'Acquired' : 'Disposed'} ${event.quantity} ${event.symbol} in a DEX swap`,
        'dex_swap',
        at,
        event.txHash,
        0.97,
      ),
    );
    if (!hasPrice) {
      reasons.push('Swap had no reported execution price; cost basis marked unknown');
    }
    return build(event, cls, 0.97, hasPrice ? 'KNOWN' : 'UNKNOWN', false, ev, reasons);
  }

  // ── Airdrops (spec §9) ──
  if (event.source === 'AIRDROP') {
    reasons.push('Airdrop received; no acquisition cost is invented');
    ev.push(
      evidence(
        `Received ${event.quantity} ${event.symbol} with no corresponding outflow`,
        'airdrop_detection',
        at,
        event.hints?.knownAirdropProgram ?? event.txHash,
        event.hints?.knownAirdropProgram ? 0.9 : 0.7,
      ),
    );
    return build(event, 'AIRDROP', event.hints?.knownAirdropProgram ? 0.9 : 0.7, 'UNKNOWN', true, ev, reasons);
  }

  if (event.source === 'STAKING_REWARD') {
    reasons.push('Staking reward received; basis recorded at zero cost with reward provenance');
    ev.push(evidence(`Staking reward of ${event.quantity} ${event.symbol}`, 'staking', at, event.txHash, 0.85));
    return build(event, 'STAKING_REWARD', 0.85, 'ESTIMATED', true, ev, reasons);
  }

  // ── Transfers (spec §8) ──
  if (event.source === 'TRANSFER') {
    const counterparty = normalizeAddress(event.counterpartyWallet ?? '');
    const pairedWith = deps.pairs.transferPairs.get(event.id);
    const counterpartyOwned = counterparty.length > 0 && deps.owned.has(counterparty);
    const counterpartyRelated = counterparty.length > 0 && deps.related.has(counterparty);

    if (counterpartyOwned || pairedWith) {
      const confidence = counterpartyOwned && pairedWith ? 0.98 : counterpartyOwned ? 0.94 : 0.85;
      const cls: TransactionClass =
        event.direction === 'IN' ? 'INTERNAL_TRANSFER_IN' : 'INTERNAL_TRANSFER_OUT';
      reasons.push('Wallet-to-wallet movement between grouped wallets; not a purchase or a sale');
      ev.push(
        evidence(
          counterpartyOwned
            ? `Counterparty ${shorten(event.counterpartyWallet ?? '')} is a wallet in this portfolio`
            : 'A matching counter-leg was observed in another portfolio wallet',
          'internal_transfer_detection',
          at,
          event.counterpartyWallet ?? pairedWith ?? event.txHash,
          confidence,
        ),
      );
      return build(event, cls, confidence, 'CARRIED_OVER', true, ev, reasons);
    }

    if (counterpartyRelated) {
      reasons.push('Counterparty shows strong internal-transfer evidence but is not user-grouped; treated as external');
      ev.push(
        evidence(
          `Counterparty ${shorten(event.counterpartyWallet ?? '')} is related but not grouped by the user`,
          'wallet_relationship',
          at,
          event.counterpartyWallet ?? '',
          0.55,
        ),
      );
    }

    const cls: TransactionClass =
      event.direction === 'IN' ? 'EXTERNAL_TRANSFER_IN' : 'EXTERNAL_TRANSFER_OUT';
    reasons.push(
      event.direction === 'IN'
        ? 'Inbound transfer from an unrelated wallet; acquisition cost unknown'
        : 'Outbound transfer to an unrelated wallet; disposal proceeds unknown',
    );
    ev.push(
      evidence(
        `Transfer ${event.direction === 'IN' ? 'from' : 'to'} ${shorten(event.counterpartyWallet ?? 'an unknown wallet')}`,
        'transfer',
        at,
        event.txHash,
        0.8,
      ),
    );
    // External transfers move quantity but must not be priced as trades.
    return build(event, cls, 0.8, 'UNKNOWN', true, ev, reasons);
  }

  // ── Nothing matched ──
  const cls: TransactionClass = event.direction === 'IN' ? 'UNKNOWN_ACQUISITION' : 'UNKNOWN_DISPOSAL';
  reasons.push('Source could not be determined; recorded without inventing a cost basis');
  ev.push(evidence(`Unclassified ${event.direction} movement of ${event.symbol}`, 'ledger', at, event.txHash, 0.4));
  return build(event, cls, 0.4, 'UNKNOWN', true, ev, reasons);
}

function build(
  event: RawLedgerEvent,
  classification: TransactionClass,
  confidence: number,
  costBasisCertainty: CostBasisCertainty,
  pnlNeutral: boolean,
  ev: ClassifiedEvent['evidence'],
  reasons: string[],
): ClassifiedEvent {
  return { event, classification, confidence, costBasisCertainty, pnlNeutral, evidence: ev, reasons };
}

// ────────────────────────────────────────────────────────────────────────────
// Pairing — matches the two legs of transfers, bridges and migrations
// ────────────────────────────────────────────────────────────────────────────

function buildPairIndex(
  events: RawLedgerEvent[],
  owned: Set<string>,
  windowSeconds: number,
): PairIndex {
  const transferPairs = new Map<string, string>();
  const bridgePairs = new Map<string, string>();
  const migrationPairs = new Map<string, string>();

  const windowMs = windowSeconds * 1000;

  for (let i = 0; i < events.length; i += 1) {
    const a = events[i];
    if (transferPairs.has(a.id) || bridgePairs.has(a.id) || migrationPairs.has(a.id)) continue;

    for (let j = i + 1; j < events.length; j += 1) {
      const b = events[j];
      if (transferPairs.has(b.id) || bridgePairs.has(b.id) || migrationPairs.has(b.id)) continue;
      if (a.direction === b.direction) continue;
      if (Math.abs(toTimestamp(b.timestamp) - toTimestamp(a.timestamp)) > windowMs) break;

      // Bridge legs: same bridge id, opposite directions, possibly different chains.
      if (a.hints?.bridgeId && a.hints.bridgeId === b.hints?.bridgeId) {
        bridgePairs.set(a.id, b.id);
        bridgePairs.set(b.id, a.id);
        break;
      }

      // Migration legs: the inbound token declares the outbound token as its origin.
      const inbound = a.direction === 'IN' ? a : b;
      const outbound = a.direction === 'IN' ? b : a;
      if (inbound.hints?.migrationFromTokenId && inbound.hints.migrationFromTokenId === outbound.tokenId) {
        migrationPairs.set(a.id, b.id);
        migrationPairs.set(b.id, a.id);
        break;
      }

      // Internal transfers: same token, both wallets owned, matching quantity.
      const sameToken = a.tokenId === b.tokenId && a.chain === b.chain;
      const bothOwned = owned.has(normalizeAddress(a.wallet)) && owned.has(normalizeAddress(b.wallet));
      const quantityMatches = quantitiesMatch(a.quantity, b.quantity);
      const crossReferenced =
        normalizeAddress(a.counterpartyWallet ?? '') === normalizeAddress(b.wallet) ||
        normalizeAddress(b.counterpartyWallet ?? '') === normalizeAddress(a.wallet);

      if (sameToken && bothOwned && quantityMatches && (crossReferenced || a.source === 'TRANSFER')) {
        transferPairs.set(a.id, b.id);
        transferPairs.set(b.id, a.id);
        break;
      }
    }
  }

  return { transferPairs, bridgePairs, migrationPairs };
}

/** Transfers lose a little to fees, so allow a small tolerance. */
function quantitiesMatch(a: number, b: number): boolean {
  const larger = Math.max(Math.abs(a), Math.abs(b));
  if (larger === 0) return true;
  return Math.abs(a - b) / larger <= 0.02;
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

function shorten(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 5)}…${address.slice(-4)}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Wallet link suggestions (spec §39)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Surfaces wallets that look related through repeated transfers. These are
 * suggestions only: Sentinel never auto-merges unrelated wallets.
 */
export function suggestWalletLinks(
  events: RawLedgerEvent[],
  ownedWallets: string[],
): Array<{ walletA: string; walletB: string; confidence: number; transferCount: number; evidence: ClassifiedEvent['evidence']; requiresUserConfirmation: true }> {
  const owned = new Set(ownedWallets.map(normalizeAddress));
  const counts = new Map<string, { a: string; b: string; count: number; lastAt: string }>();

  for (const event of events) {
    if (event.source !== 'TRANSFER') continue;
    const counterparty = event.counterpartyWallet;
    if (!counterparty) continue;
    const normalized = normalizeAddress(counterparty);
    if (owned.has(normalized)) continue; // already grouped

    const key = [normalizeAddress(event.wallet), normalized].sort().join('|');
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
      existing.lastAt = event.timestamp;
    } else {
      counts.set(key, { a: event.wallet, b: counterparty, count: 1, lastAt: event.timestamp });
    }
  }

  return [...counts.values()]
    .filter((entry) => entry.count >= 2)
    .map((entry) => ({
      walletA: entry.a,
      walletB: entry.b,
      confidence: Math.min(0.9, 0.4 + entry.count * 0.1),
      transferCount: entry.count,
      evidence: [
        evidence(
          `${entry.count} direct transfers observed between ${shorten(entry.a)} and ${shorten(entry.b)}`,
          'transfer_graph',
          entry.lastAt,
          entry.count,
          Math.min(0.9, 0.4 + entry.count * 0.1),
        ),
      ],
      requiresUserConfirmation: true as const,
    }))
    .sort((a, b) => b.confidence - a.confidence);
}
