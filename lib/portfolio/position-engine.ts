/**
 * Position Engine (spec §7, §28, §46, §48, §49, §50, §51)
 *
 * Consumes classified ledger events and produces position drafts: lot books,
 * realized P&L entries, execution-cost records, pending changes and timelines.
 *
 * Responsibilities that live here and nowhere else:
 *  - Deduplication of repeated chain events (adversarial test 2).
 *  - Reorg / drop / failure reconciliation with recorded corrections (test 3).
 *  - Internal transfers being quantity- and P&L-neutral at portfolio level (test 1).
 *  - Bridges and migrations carrying cost basis instead of realizing it.
 *
 * Valuation and risk are deliberately NOT done here. This stage only knows what
 * the chain said and what it cost.
 */

import type {
  ClassifiedEvent,
  ExecutionCostRecord,
  FeeBreakdown,
  MonetaryValue,
  PendingChange,
  PositionEvent,
  RawLedgerEvent,
  RealizedPnlEntry,
  ReconciliationCorrection,
  ReconciliationReport,
  StrategyTag,
  TokenMetaInput,
} from './types';
import type { AccountingMethod } from './types';
import {
  type LotBook,
  acquire,
  createLotBook,
  dispose,
  remainingLotFeesUsd,
  remainingQuantity,
  summarizeCostBasis,
} from './cost-basis';
import {
  QUANTITY_EPSILON,
  addFees,
  emptyFees,
  estimated,
  evidence,
  feesFromEvent,
  formatUsd,
  hasValue,
  known,
  round,
  subtractValues,
  sum,
  toTimestamp,
  unknownValue,
} from './utils';

export interface PositionDraft {
  id: string;
  tokenId: string;
  symbol: string;
  name?: string;
  chain: string;
  isNative: boolean;
  wallets: string[];
  book: LotBook;
  realizedEntries: RealizedPnlEntry[];
  pending: PendingChange[];
  timeline: PositionEvent[];
  /** Every fee ever paid on this position, both sides. */
  fees: FeeBreakdown;
  /** Fees still attached to open lots (i.e. not yet realized). */
  openFeesUsd: number;
  executionCosts: ExecutionCostRecord[];
  strategyTags: StrategyTag[];
  firstAcquiredAt?: string;
  lastActivityAt?: string;
  tradingVolumeUsd: number;
  limitations: string[];
}

export interface PositionEngineInput {
  portfolioId: string;
  classified: ClassifiedEvent[];
  tokens: Record<string, TokenMetaInput>;
  method?: AccountingMethod;
  observedAt: string;
}

export interface PositionEngineResult {
  drafts: PositionDraft[];
  reconciliation: ReconciliationReport;
}

/** Basis parked by an outbound bridge/migration leg, awaiting its inbound leg. */
interface CarriedBasis {
  key: string;
  quantity: number;
  cost: MonetaryValue;
  feesUsd: number;
  fromTokenId: string;
  fromChain: string;
  fromLotId: string;
  acquiredAt: string;
}

export function buildPositions(input: PositionEngineInput): PositionEngineResult {
  const { portfolioId, classified, tokens, observedAt } = input;
  const method = input.method ?? 'FIFO';

  const drafts = new Map<string, PositionDraft>();
  const corrections: ReconciliationCorrection[] = [];
  const carried = new Map<string, CarriedBasis>();

  const seenTx = new Set<string>();
  const supersededEventIds = new Set<string>();
  let duplicateEvents = 0;
  let rejectedEvents = 0;
  let pendingEvents = 0;
  let acceptedEvents = 0;

  // Events that explicitly replace an earlier event (reorg replacement).
  for (const item of classified) {
    const replaces = item.event.hints?.replacesEventId;
    if (replaces) supersededEventIds.add(replaces);
  }

  const ordered = [...classified].sort(
    (a, b) => toTimestamp(a.event.timestamp) - toTimestamp(b.event.timestamp),
  );

  for (const item of ordered) {
    const event = item.event;

    // ── Reorg / drop / failure reconciliation (spec §51) ──
    if (event.status === 'FAILED' || event.status === 'DROPPED' || event.status === 'REORGED') {
      rejectedEvents += 1;
      const draft = ensureDraft(drafts, portfolioId, event, tokens, method);
      corrections.push({
        eventId: event.id,
        transactionHash: event.txHash,
        reason: event.status === 'REORGED' ? 'REORGED' : event.status === 'DROPPED' ? 'DROPPED' : 'FAILED',
        removedQuantity: 0,
        detail: `${event.status} chain event excluded from derived position state`,
        correctedAt: observedAt,
      });
      draft.timeline.push(
        positionEvent(draft, 'CORRECTION', 'BLOCKCHAIN', `Transaction ${event.status.toLowerCase()}`, {
          detail: `${shortHash(event.txHash)} did not survive to a confirmed state; derived state was rolled back.`,
          transactionHash: event.txHash,
          confidence: 1,
          occurredAt: event.timestamp,
        }),
      );
      continue;
    }

    if (supersededEventIds.has(event.id)) {
      rejectedEvents += 1;
      corrections.push({
        eventId: event.id,
        transactionHash: event.txHash,
        reason: 'SUPERSEDED',
        removedQuantity: 0,
        detail: 'A later event explicitly replaced this one after a chain reorganisation',
        correctedAt: observedAt,
      });
      continue;
    }

    // ── Duplicate suppression (adversarial test 2) ──
    const identity = eventIdentity(event);
    if (seenTx.has(identity)) {
      duplicateEvents += 1;
      corrections.push({
        eventId: event.id,
        transactionHash: event.txHash,
        reason: 'DUPLICATE',
        removedQuantity: 0,
        detail: 'Identical chain event already applied; ignored to avoid a duplicate position',
        correctedAt: observedAt,
      });
      continue;
    }
    seenTx.add(identity);

    const draft = ensureDraft(drafts, portfolioId, event, tokens, method);
    trackWallet(draft, event.wallet);
    draft.lastActivityAt = latest(draft.lastActivityAt, event.timestamp);
    if (event.strategy && !draft.strategyTags.includes(event.strategy)) {
      draft.strategyTags.push(event.strategy);
    }

    // ── Pending transactions are shown but never treated as final (spec §50) ──
    if (event.status === 'PENDING') {
      pendingEvents += 1;
      draft.pending.push(buildPendingChange(item));
      draft.timeline.push(
        positionEvent(draft, item.classification === 'SELL' ? 'PARTIAL_EXIT' : 'ADDED', 'BLOCKCHAIN', 'Pending transaction', {
          detail: `${item.classification} of ${round(event.quantity, 6)} ${event.symbol} submitted and awaiting confirmation.`,
          transactionHash: event.txHash,
          quantity: event.quantity,
          confidence: 0.5,
          occurredAt: event.timestamp,
        }),
      );
      continue;
    }

    acceptedEvents += 1;
    applyEvent(draft, item, { carried, drafts, portfolioId, tokens, method, observedAt });
  }

  const list = [...drafts.values()];
  for (const draft of list) {
    draft.openFeesUsd = remainingLotFeesUsd(draft.book);
    draft.timeline.sort((a, b) => toTimestamp(b.occurredAt) - toTimestamp(a.occurredAt));
    draft.realizedEntries.sort((a, b) => toTimestamp(b.timestamp) - toTimestamp(a.timestamp));
  }

  return {
    drafts: list,
    reconciliation: {
      portfolioId,
      acceptedEvents,
      rejectedEvents,
      duplicateEvents,
      pendingEvents,
      corrections,
      rebuilt: corrections.length > 0,
      generatedAt: observedAt,
    },
  };
}

interface ApplyDeps {
  carried: Map<string, CarriedBasis>;
  drafts: Map<string, PositionDraft>;
  portfolioId: string;
  tokens: Record<string, TokenMetaInput>;
  method: AccountingMethod;
  observedAt: string;
}

function applyEvent(draft: PositionDraft, item: ClassifiedEvent, deps: ApplyDeps): void {
  const event = item.event;
  const fees = feesFromEvent(event);
  draft.fees = addFees(draft.fees, fees);

  switch (item.classification) {
    case 'BUY': {
      const price = numericOrNull(event.pricePerTokenUsd);
      const isFirst = remainingQuantity(draft.book) <= QUANTITY_EPSILON;
      acquire(draft.book, {
        wallet: event.wallet,
        quantity: event.quantity,
        pricePerTokenUsd: price,
        feesUsd: fees.totalUsd,
        timestamp: event.timestamp,
        transactionHash: event.txHash,
        eventId: event.id,
        source: 'BUY',
        certainty: price === null ? 'UNKNOWN' : 'KNOWN',
      });
      draft.firstAcquiredAt = earliest(draft.firstAcquiredAt, event.timestamp);
      if (price !== null) draft.tradingVolumeUsd = round(draft.tradingVolumeUsd + price * event.quantity, 6);
      recordExecutionCost(draft, item, 'BUY');
      draft.timeline.push(
        positionEvent(draft, isFirst ? 'OPENED' : 'ADDED', 'BLOCKCHAIN', isFirst ? 'Position opened' : 'Added to position', {
          detail: `Bought ${round(event.quantity, 6)} ${event.symbol}${price !== null ? ` at ${formatUsd(price)}` : ' (execution price unavailable)'}.`,
          transactionHash: event.txHash,
          quantity: event.quantity,
          valueUsd: price !== null ? round(price * event.quantity, 2) : null,
          confidence: item.confidence,
          occurredAt: event.timestamp,
          evidence: item.evidence,
        }),
      );
      break;
    }

    case 'SELL': {
      const price = numericOrNull(event.pricePerTokenUsd);
      const result = dispose(draft.book, event.quantity, event.timestamp);
      const proceeds: MonetaryValue =
        price === null
          ? unknownValue('The venue reported no execution price for this disposal', 'position_engine')
          : known(price * event.quantity, 'dex_swap', event.timestamp, 0.95);

      // Gross is fee-free by construction. The trade's true net subtracts both
      // the disposal fees and the acquisition fees released with the basis, so
      // a single trade's net is fully loaded (spec §4).
      const grossPnl = subtractValues(proceeds, result.costBasis, 'pnl_engine');
      const tradeFees = addFees(fees, {
        tradingFeesUsd: round(result.acquisitionFeesUsd, 6),
        networkFeesUsd: 0,
        dexFeesUsd: 0,
        totalUsd: round(result.acquisitionFeesUsd, 6),
      });
      const netPnl = hasValue(grossPnl)
        ? known(grossPnl.usd - tradeFees.totalUsd, 'pnl_engine', event.timestamp, grossPnl.confidence)
        : unknownValue('Net P&L cannot be computed without both proceeds and cost basis', 'pnl_engine');

      if (result.unmatchedQuantity > QUANTITY_EPSILON) {
        draft.limitations.push(
          `Sold ${round(result.unmatchedQuantity, 6)} ${draft.symbol} with no matching acquisition record; that portion has no cost basis.`,
        );
      }

      draft.realizedEntries.push({
        eventId: event.id,
        transactionHash: event.txHash,
        timestamp: event.timestamp,
        quantity: result.consumedQuantity,
        proceeds,
        costBasis: result.costBasis,
        grossPnl,
        fees: tradeFees,
        netPnl,
        holdingHours: result.weightedHoldingHours,
        consumptions: result.consumptions,
        strategy: event.strategy ?? 'UNTAGGED',
        unknownBasisQuantity: result.unknownBasisQuantity,
      });

      if (price !== null) draft.tradingVolumeUsd = round(draft.tradingVolumeUsd + price * event.quantity, 6);
      recordExecutionCost(draft, item, 'SELL');

      const closed = remainingQuantity(draft.book) <= QUANTITY_EPSILON;
      draft.timeline.push(
        positionEvent(draft, closed ? 'CLOSED' : 'PARTIAL_EXIT', 'BLOCKCHAIN', closed ? 'Position closed' : 'Partial exit', {
          detail: `Sold ${round(event.quantity, 6)} ${event.symbol}${price !== null ? ` at ${formatUsd(price)}` : ''}. Net ${hasValue(netPnl) ? formatUsd(netPnl.usd) : 'unknown'}.`,
          transactionHash: event.txHash,
          quantity: event.quantity,
          valueUsd: hasValue(proceeds) ? round(proceeds.usd, 2) : null,
          confidence: item.confidence,
          occurredAt: event.timestamp,
          evidence: item.evidence,
        }),
      );
      break;
    }

    // ── Internal transfers: quantity- and P&L-neutral at portfolio level ──
    case 'INTERNAL_TRANSFER_IN':
    case 'INTERNAL_TRANSFER_OUT': {
      draft.timeline.push(
        positionEvent(
          draft,
          item.classification === 'INTERNAL_TRANSFER_IN' ? 'TRANSFER_IN' : 'TRANSFER_OUT',
          'BLOCKCHAIN',
          'Internal transfer',
          {
            detail: `Moved ${round(event.quantity, 6)} ${event.symbol} between wallets in this portfolio. No P&L recognised.`,
            transactionHash: event.txHash,
            quantity: event.quantity,
            confidence: item.confidence,
            occurredAt: event.timestamp,
            evidence: item.evidence,
          },
        ),
      );
      break;
    }

    // ── External inflow with no determinable cost ──
    case 'EXTERNAL_TRANSFER_IN':
    case 'UNKNOWN_ACQUISITION': {
      acquire(draft.book, {
        wallet: event.wallet,
        quantity: event.quantity,
        pricePerTokenUsd: null,
        feesUsd: fees.totalUsd,
        timestamp: event.timestamp,
        transactionHash: event.txHash,
        eventId: event.id,
        source: 'TRANSFER_IN',
        certainty: 'UNKNOWN',
      });
      draft.firstAcquiredAt = earliest(draft.firstAcquiredAt, event.timestamp);
      draft.limitations.push(
        `${round(event.quantity, 6)} ${draft.symbol} arrived from outside the portfolio with no observable acquisition cost.`,
      );
      draft.timeline.push(
        positionEvent(draft, 'TRANSFER_IN', 'BLOCKCHAIN', 'Received from an external wallet', {
          detail: 'Cost basis is unknown for this inflow. It is held, but excluded from cost-based P&L.',
          transactionHash: event.txHash,
          quantity: event.quantity,
          confidence: item.confidence,
          occurredAt: event.timestamp,
          evidence: item.evidence,
        }),
      );
      break;
    }

    case 'EXTERNAL_TRANSFER_OUT':
    case 'UNKNOWN_DISPOSAL': {
      // Quantity leaves, but with no proceeds there is nothing to realize.
      dispose(draft.book, event.quantity, event.timestamp);
      draft.limitations.push(
        `${round(event.quantity, 6)} ${draft.symbol} left the portfolio without observable proceeds; no P&L was recognised.`,
      );
      draft.timeline.push(
        positionEvent(draft, 'TRANSFER_OUT', 'BLOCKCHAIN', 'Sent to an external wallet', {
          detail: 'Quantity removed. No proceeds were observable, so no realized P&L was recorded.',
          transactionHash: event.txHash,
          quantity: event.quantity,
          confidence: item.confidence,
          occurredAt: event.timestamp,
          evidence: item.evidence,
        }),
      );
      break;
    }

    case 'AIRDROP':
    case 'STAKING_REWARD': {
      acquire(draft.book, {
        wallet: event.wallet,
        quantity: event.quantity,
        pricePerTokenUsd: item.classification === 'STAKING_REWARD' ? 0 : null,
        feesUsd: fees.totalUsd,
        timestamp: event.timestamp,
        transactionHash: event.txHash,
        eventId: event.id,
        source: item.classification === 'AIRDROP' ? 'AIRDROP' : 'STAKING_REWARD',
        certainty: item.classification === 'AIRDROP' ? 'UNKNOWN' : 'ESTIMATED',
      });
      draft.firstAcquiredAt = earliest(draft.firstAcquiredAt, event.timestamp);
      if (item.classification === 'AIRDROP') {
        draft.limitations.push(
          `${round(event.quantity, 6)} ${draft.symbol} was airdropped. Sentinel does not invent an acquisition cost, so P&L on that portion is reported as unknown.`,
        );
      }
      draft.timeline.push(
        positionEvent(draft, 'AIRDROP_RECEIVED', 'BLOCKCHAIN', item.classification === 'AIRDROP' ? 'Airdrop received' : 'Staking reward received', {
          detail:
            item.classification === 'AIRDROP'
              ? 'Acquisition cost is unknown and is marked as such rather than assumed to be zero.'
              : 'Recorded at zero cost with reward provenance.',
          transactionHash: event.txHash,
          quantity: event.quantity,
          confidence: item.confidence,
          occurredAt: event.timestamp,
          evidence: item.evidence,
        }),
      );
      break;
    }

    // ── Bridges and migrations carry basis rather than realizing it ──
    case 'BRIDGE_OUT':
    case 'MIGRATION_OUT': {
      const result = dispose(draft.book, event.quantity, event.timestamp);
      const key = carryKey(item);
      deps.carried.set(key, {
        key,
        quantity: result.consumedQuantity || event.quantity,
        cost: result.costBasis,
        feesUsd: round(result.acquisitionFeesUsd + fees.totalUsd, 6),
        fromTokenId: event.tokenId,
        fromChain: event.chain,
        fromLotId: result.consumptions[0]?.lotId ?? '',
        acquiredAt: result.consumptions[0]?.acquisitionTimestamp ?? event.timestamp,
      });
      draft.timeline.push(
        positionEvent(
          draft,
          item.classification === 'BRIDGE_OUT' ? 'BRIDGED_OUT' : 'MIGRATED',
          'BLOCKCHAIN',
          item.classification === 'BRIDGE_OUT' ? 'Bridged out' : 'Migrated out',
          {
            detail: 'Cost basis is carried to the destination rather than realized as a sale.',
            transactionHash: event.txHash,
            quantity: event.quantity,
            confidence: item.confidence,
            occurredAt: event.timestamp,
            evidence: item.evidence,
          },
        ),
      );
      break;
    }

    case 'BRIDGE_IN':
    case 'MIGRATION_IN': {
      const key = carryKey(item);
      const carriedBasis = deps.carried.get(key);
      if (carriedBasis) deps.carried.delete(key);

      const ratio = carriedBasis && carriedBasis.quantity > 0 ? event.quantity / carriedBasis.quantity : 1;
      const cost = carriedBasis
        ? hasValue(carriedBasis.cost)
          ? { ...carriedBasis.cost, note: 'Cost basis carried across a bridge or migration' }
          : unknownValue('The source leg had no known cost basis', 'position_engine')
        : estimated(0, 'position_engine', event.timestamp, 0.3);

      acquire(draft.book, {
        wallet: event.wallet,
        quantity: event.quantity,
        pricePerTokenUsd:
          carriedBasis && hasValue(carriedBasis.cost) && event.quantity > 0
            ? round((carriedBasis.cost.usd as number) / event.quantity, 12)
            : null,
        feesUsd: round(fees.totalUsd + (carriedBasis?.feesUsd ?? 0), 6),
        timestamp: event.timestamp,
        transactionHash: event.txHash,
        eventId: event.id,
        source: item.classification === 'BRIDGE_IN' ? 'BRIDGE_IN' : 'MIGRATION_IN',
        certainty: carriedBasis ? 'CARRIED_OVER' : 'UNKNOWN',
        carriedCost: carriedBasis
          ? hasValue(carriedBasis.cost)
            ? { ...carriedBasis.cost, note: 'Cost basis carried from the source leg' }
            : cost
          : unknownValue('No matching source leg was observed for this inflow', 'position_engine'),
        carriedFrom: carriedBasis
          ? { tokenId: carriedBasis.fromTokenId, chain: carriedBasis.fromChain, lotId: carriedBasis.fromLotId }
          : undefined,
      });

      draft.firstAcquiredAt = earliest(draft.firstAcquiredAt, carriedBasis?.acquiredAt ?? event.timestamp);

      if (!carriedBasis) {
        draft.limitations.push(
          `A ${item.classification === 'BRIDGE_IN' ? 'bridge' : 'migration'} inflow of ${round(event.quantity, 6)} ${draft.symbol} had no matching source leg; its cost basis is unknown.`,
        );
      }

      draft.timeline.push(
        positionEvent(
          draft,
          item.classification === 'BRIDGE_IN' ? 'BRIDGED_IN' : 'MIGRATED',
          'BLOCKCHAIN',
          item.classification === 'BRIDGE_IN' ? 'Bridged in' : 'Migrated in',
          {
            detail: carriedBasis
              ? `Economic history preserved: ${round(ratio, 4)}× quantity ratio applied from the source leg.`
              : 'No matching source leg was found, so cost basis is unknown.',
            transactionHash: event.txHash,
            quantity: event.quantity,
            confidence: item.confidence,
            occurredAt: event.timestamp,
            evidence: item.evidence,
          },
        ),
      );
      break;
    }

    case 'IGNORED':
    default:
      break;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Execution cost analysis (spec §24)
// ────────────────────────────────────────────────────────────────────────────

function recordExecutionCost(draft: PositionDraft, item: ClassifiedEvent, side: 'BUY' | 'SELL'): void {
  const event = item.event;
  const quoted = numericOrNull(event.quotedPricePerTokenUsd);
  const executed = numericOrNull(event.pricePerTokenUsd);
  const fees = feesFromEvent(event);

  const priceDifferenceUsd = quoted !== null && executed !== null ? round(executed - quoted, 12) : null;

  // Signed slippage from the trader's perspective: negative = worse than quoted.
  const slippagePct =
    quoted !== null && executed !== null && quoted !== 0
      ? round(side === 'BUY' ? (quoted - executed) / quoted : (executed - quoted) / quoted, 6)
      : null;

  const executionCostUsd =
    quoted !== null && executed !== null
      ? known(
          round(Math.abs(quoted - executed) * event.quantity + fees.totalUsd, 6),
          'execution_cost_engine',
          event.timestamp,
          0.9,
        )
      : fees.totalUsd > 0
        ? estimated(fees.totalUsd, 'execution_cost_engine', event.timestamp, 0.5)
        : unknownValue('No quoted price was recorded for this execution', 'execution_cost_engine');

  const fillRatio =
    typeof event.requestedQuantity === 'number' && event.requestedQuantity > 0
      ? round(event.quantity / event.requestedQuantity, 6)
      : null;

  draft.executionCosts.push({
    eventId: event.id,
    positionId: draft.id,
    tokenId: draft.tokenId,
    transactionHash: event.txHash,
    side,
    quantity: event.quantity,
    quotedPriceUsd: quoted,
    executedPriceUsd: executed,
    priceDifferenceUsd,
    slippagePct,
    fees,
    executionCostUsd,
    fillRatio,
    timestamp: event.timestamp,
    status: quoted !== null && executed !== null ? 'KNOWN' : 'UNKNOWN',
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function ensureDraft(
  drafts: Map<string, PositionDraft>,
  portfolioId: string,
  event: RawLedgerEvent,
  tokens: Record<string, TokenMetaInput>,
  method: AccountingMethod,
): PositionDraft {
  const id = positionId(portfolioId, event.chain, event.tokenId);
  const existing = drafts.get(id);
  if (existing) return existing;

  const meta = tokens[event.tokenId];
  const draft: PositionDraft = {
    id,
    tokenId: event.tokenId,
    symbol: meta?.symbol ?? event.symbol,
    name: meta?.name,
    chain: event.chain,
    isNative: Boolean(meta?.isNative ?? event.isNative),
    wallets: [],
    book: createLotBook(id, event.tokenId, event.chain, method),
    realizedEntries: [],
    pending: [],
    timeline: [],
    fees: emptyFees(),
    openFeesUsd: 0,
    executionCosts: [],
    strategyTags: [],
    tradingVolumeUsd: 0,
    limitations: [],
  };
  drafts.set(id, draft);
  return draft;
}

export function positionId(portfolioId: string, chain: string, tokenId: string): string {
  return `pos_${portfolioId}_${chain}_${tokenId}`;
}

function buildPendingChange(item: ClassifiedEvent): PendingChange {
  const event = item.event;
  const price = numericOrNull(event.pricePerTokenUsd) ?? numericOrNull(event.quotedPricePerTokenUsd);
  const kind: PendingChange['kind'] =
    item.classification === 'SELL'
      ? 'PENDING_SELL'
      : item.classification === 'BUY'
        ? 'PENDING_BUY'
        : 'PENDING_TRANSFER';

  return {
    eventId: event.id,
    transactionHash: event.txHash,
    kind,
    quantity: event.quantity,
    estimatedValue:
      price === null
        ? unknownValue('No price is available for this pending transaction', 'position_engine')
        : estimated(price * event.quantity, 'pending_estimate', event.timestamp, 0.5),
    status: event.status,
    submittedAt: event.timestamp,
    isFinal: false,
  };
}

interface PositionEventOptions {
  detail?: string;
  quantity?: number;
  valueUsd?: number | null;
  transactionHash?: string;
  confidence: number;
  occurredAt: string;
  evidence?: PositionEvent['evidence'];
}

let eventCounter = 0;

function positionEvent(
  draft: PositionDraft,
  type: PositionEvent['type'],
  origin: PositionEvent['origin'],
  title: string,
  options: PositionEventOptions,
): PositionEvent {
  eventCounter += 1;
  return {
    id: `${draft.id}_evt_${eventCounter}`,
    positionId: draft.id,
    type,
    origin,
    title,
    detail: options.detail,
    quantity: options.quantity,
    valueUsd: options.valueUsd,
    transactionHash: options.transactionHash,
    confidence: options.confidence,
    evidence: options.evidence ?? [],
    occurredAt: options.occurredAt,
  };
}

/**
 * Identity used for duplicate suppression. Two ingestion passes over the same
 * chain event produce different row ids but the same identity.
 */
function eventIdentity(event: RawLedgerEvent): string {
  return [
    event.txHash,
    event.chain,
    event.wallet.toLowerCase(),
    event.tokenId,
    event.direction,
    round(event.quantity, 9),
  ].join('|');
}

function carryKey(item: ClassifiedEvent): string {
  const event = item.event;
  if (event.hints?.bridgeId) return `bridge:${event.hints.bridgeId}`;
  if (event.hints?.migrationFromTokenId) return `migration:${event.hints.migrationFromTokenId}`;
  if (item.classification === 'MIGRATION_OUT') return `migration:${event.tokenId}`;
  return `carry:${event.txHash}`;
}

function numericOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function trackWallet(draft: PositionDraft, wallet: string): void {
  if (!draft.wallets.includes(wallet)) draft.wallets.push(wallet);
}

function earliest(current: string | undefined, candidate: string): string {
  if (!current) return candidate;
  return toTimestamp(candidate) < toTimestamp(current) ? candidate : current;
}

function latest(current: string | undefined, candidate: string): string {
  if (!current) return candidate;
  return toTimestamp(candidate) > toTimestamp(current) ? candidate : current;
}

function shortHash(hash: string): string {
  return hash.length <= 12 ? hash : `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

/** Convenience for tests and callers that only want the settled cost basis. */
export function draftCostBasis(draft: PositionDraft) {
  return summarizeCostBasis(draft.book);
}

/** Total realized net P&L across a draft's entries, ignoring unknown entries. */
export function draftRealizedNetUsd(draft: PositionDraft): number {
  return round(
    sum(draft.realizedEntries.filter((entry) => hasValue(entry.netPnl)).map((entry) => entry.netPnl.usd as number)),
    6,
  );
}

export function draftEvidenceCount(draft: PositionDraft): number {
  return draft.timeline.reduce((count, item) => count + item.evidence.length, 0);
}

export { evidence };
