/**
 * Cost Basis & Lot Tracking Engine (spec §6, §7)
 *
 * Every acquisition creates a `PositionLot`. Every disposal consumes lots
 * according to the configured accounting method. The lot book is the single
 * source of truth for remaining basis, realized basis and average cost.
 *
 * The architecture supports multiple accounting methodologies from day one
 * (FIFO / LIFO / HIFO / AVERAGE) because switching methods later must not
 * require re-modelling positions.
 *
 * Unknown basis is a first-class state. An airdropped or externally
 * transferred-in lot has `acquisitionCost.status === 'UNKNOWN'` and never
 * silently contributes $0 of cost to P&L.
 */

import type {
  AccountingMethod,
  Chain,
  CostBasisCertainty,
  CostBasisState,
  LotConsumption,
  LotSource,
  MonetaryValue,
  PositionLot,
} from './types';
import {
  COST_BASIS_VERSION,
  QUANTITY_EPSILON,
  addValues,
  estimated,
  hasValue,
  hoursBetween,
  known,
  round,
  sum,
  unknownValue,
  zero,
} from './utils';

export { COST_BASIS_VERSION };

export interface LotBook {
  positionId: string;
  tokenId: string;
  chain: Chain;
  method: AccountingMethod;
  lots: PositionLot[];
  acquiredQuantity: number;
  disposedQuantity: number;
  /** Cost released by disposals so far. */
  realizedCostBasis: MonetaryValue[];
  /** Cost of everything ever acquired. */
  acquisitionCosts: MonetaryValue[];
  /** Quantity disposed whose basis could not be determined. */
  unknownBasisDisposed: number;
  sequence: number;
}

export function createLotBook(
  positionId: string,
  tokenId: string,
  chain: Chain,
  method: AccountingMethod = 'FIFO',
): LotBook {
  return {
    positionId,
    tokenId,
    chain,
    method,
    lots: [],
    acquiredQuantity: 0,
    disposedQuantity: 0,
    realizedCostBasis: [],
    acquisitionCosts: [],
    unknownBasisDisposed: 0,
    sequence: 0,
  };
}

export interface AcquireInput {
  wallet: string;
  quantity: number;
  /** Per-token acquisition price. null when unknown (airdrop, external transfer). */
  pricePerTokenUsd: number | null;
  /** Fees capitalised into the lot. */
  feesUsd: number;
  timestamp: string;
  transactionHash: string;
  eventId: string;
  source: LotSource;
  certainty: CostBasisCertainty;
  /** Pre-computed basis, used when carrying basis across bridges/migrations. */
  carriedCost?: MonetaryValue;
  carriedFrom?: PositionLot['carriedFrom'];
}

/**
 * Records an acquisition as a new lot.
 *
 * `acquisitionCost` is price × quantity and deliberately EXCLUDES fees. Fees
 * are held on `lot.feesUsd` and subtracted once, at the P&L layer, so the
 * headline reads exactly as spec §5 requires:
 *
 *   realized + unrealized − fees = net
 *
 * Capitalising fees into basis instead would double-count them the moment the
 * fee line is also displayed.
 */
export function acquire(book: LotBook, input: AcquireInput): PositionLot {
  book.sequence += 1;
  const quantity = Math.max(0, input.quantity);

  const acquisitionCost = resolveAcquisitionCost(input, quantity);

  const lot: PositionLot = {
    id: `${book.positionId}_lot_${book.sequence}`,
    positionId: book.positionId,
    tokenId: book.tokenId,
    chain: book.chain,
    wallet: input.wallet,
    quantity,
    remainingQuantity: quantity,
    acquisitionPriceUsd: input.pricePerTokenUsd,
    acquisitionCost,
    feesUsd: round(input.feesUsd, 6),
    timestamp: input.timestamp,
    transactionHash: input.transactionHash,
    eventId: input.eventId,
    source: input.source,
    certainty: input.certainty,
    carriedFrom: input.carriedFrom,
  };

  book.lots.push(lot);
  book.acquiredQuantity = round(book.acquiredQuantity + quantity, 12);
  book.acquisitionCosts.push(acquisitionCost);
  return lot;
}

function resolveAcquisitionCost(input: AcquireInput, quantity: number): MonetaryValue {
  if (input.carriedCost) {
    return {
      ...input.carriedCost,
      status: input.carriedCost.status === 'KNOWN' ? 'KNOWN' : input.carriedCost.status,
      note: input.carriedCost.note ?? 'Cost basis carried across a bridge or migration',
    };
  }

  if (input.pricePerTokenUsd === null || !Number.isFinite(input.pricePerTokenUsd)) {
    // Airdrops and unattributable inflows: do not invent an acquisition cost.
    return unknownValue(
      input.source === 'AIRDROP'
        ? 'Airdropped tokens have no observable acquisition cost'
        : 'No acquisition price could be determined for this inflow',
      'cost_basis_engine',
    );
  }

  const cost = input.pricePerTokenUsd * quantity;
  return input.certainty === 'ESTIMATED'
    ? estimated(cost, 'cost_basis_engine', input.timestamp, 0.6)
    : known(cost, 'cost_basis_engine', input.timestamp, 0.95);
}

export interface DisposeResult {
  consumptions: LotConsumption[];
  /** Total basis released. UNKNOWN when any consumed lot had unknown basis. */
  costBasis: MonetaryValue;
  consumedQuantity: number;
  /** Quantity we were asked to dispose but had no lots for. */
  unmatchedQuantity: number;
  unknownBasisQuantity: number;
  /** Acquisition-side fees released alongside the consumed basis. */
  acquisitionFeesUsd: number;
  /** Quantity-weighted holding period of the consumed slices, in hours. */
  weightedHoldingHours: number;
}

/**
 * Consumes lots for a disposal using the book's accounting method.
 *
 * `unmatchedQuantity` is surfaced rather than swallowed: selling more than we
 * have a record of means our ingestion is incomplete, and the caller must be
 * able to mark the resulting P&L uncertain instead of fabricating basis.
 */
export function dispose(book: LotBook, quantity: number, at: string): DisposeResult {
  const requested = Math.max(0, quantity);
  if (requested <= QUANTITY_EPSILON) {
    return {
      consumptions: [],
      costBasis: zero('cost_basis_engine'),
      consumedQuantity: 0,
      unmatchedQuantity: 0,
      unknownBasisQuantity: 0,
      acquisitionFeesUsd: 0,
      weightedHoldingHours: 0,
    };
  }

  const consumptions =
    book.method === 'AVERAGE'
      ? consumeAverage(book, requested, at)
      : consumeOrdered(book, requested, at);

  const consumedQuantity = round(sum(consumptions.map((c) => c.quantity)), 12);
  const unmatchedQuantity = round(Math.max(0, requested - consumedQuantity), 12);
  const unknownBasisQuantity = round(
    sum(consumptions.filter((c) => !hasValue(c.costBasis)).map((c) => c.quantity)),
    12,
  );

  const costBasis = addValues(
    consumptions.map((c) => c.costBasis),
    'cost_basis_engine',
  );

  const weightedHoldingHours =
    consumedQuantity > 0
      ? round(sum(consumptions.map((c) => c.holdingHours * c.quantity)) / consumedQuantity, 4)
      : 0;

  book.disposedQuantity = round(book.disposedQuantity + consumedQuantity, 12);
  book.unknownBasisDisposed = round(book.unknownBasisDisposed + unknownBasisQuantity, 12);
  book.realizedCostBasis.push(costBasis);

  return {
    consumptions,
    costBasis,
    consumedQuantity,
    unmatchedQuantity,
    unknownBasisQuantity,
    acquisitionFeesUsd: round(sum(consumptions.map((c) => c.acquisitionFeesUsd)), 6),
    weightedHoldingHours,
  };
}

function orderedLots(book: LotBook): PositionLot[] {
  const open = book.lots.filter((lot) => lot.remainingQuantity > QUANTITY_EPSILON);
  switch (book.method) {
    case 'LIFO':
      return open.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    case 'HIFO':
      return open.sort((a, b) => (b.acquisitionPriceUsd ?? -Infinity) - (a.acquisitionPriceUsd ?? -Infinity));
    case 'FIFO':
    default:
      return open.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  }
}

function consumeOrdered(book: LotBook, quantity: number, at: string): LotConsumption[] {
  const consumptions: LotConsumption[] = [];
  let remaining = quantity;

  for (const lot of orderedLots(book)) {
    if (remaining <= QUANTITY_EPSILON) break;
    const take = Math.min(lot.remainingQuantity, remaining);
    consumptions.push(consumeFromLot(lot, take, at));
    lot.remainingQuantity = round(lot.remainingQuantity - take, 12);
    remaining = round(remaining - take, 12);
  }

  return consumptions;
}

/**
 * AVERAGE consumes pro-rata across every open lot so that the remaining book
 * keeps the same average cost after the disposal.
 */
function consumeAverage(book: LotBook, quantity: number, at: string): LotConsumption[] {
  const open = book.lots.filter((lot) => lot.remainingQuantity > QUANTITY_EPSILON);
  const totalOpen = sum(open.map((lot) => lot.remainingQuantity));
  if (totalOpen <= QUANTITY_EPSILON) return [];

  const take = Math.min(quantity, totalOpen);
  const fraction = take / totalOpen;
  const consumptions: LotConsumption[] = [];

  for (const lot of open) {
    const slice = round(lot.remainingQuantity * fraction, 12);
    if (slice <= QUANTITY_EPSILON) continue;
    consumptions.push(consumeFromLot(lot, slice, at));
    lot.remainingQuantity = round(lot.remainingQuantity - slice, 12);
  }

  return consumptions;
}

function consumeFromLot(lot: PositionLot, quantity: number, at: string): LotConsumption {
  const fraction = lot.quantity > 0 ? quantity / lot.quantity : 0;
  const basis = hasValue(lot.acquisitionCost)
    ? {
        ...lot.acquisitionCost,
        usd: round(lot.acquisitionCost.usd * fraction, 6),
        source: 'cost_basis_engine',
      }
    : unknownValue(
        lot.acquisitionCost.note ?? 'This lot has no known acquisition cost',
        'cost_basis_engine',
      );

  return {
    lotId: lot.id,
    quantity: round(quantity, 12),
    costBasis: basis,
    acquisitionFeesUsd: round(lot.feesUsd * fraction, 6),
    acquisitionTimestamp: lot.timestamp,
    holdingHours: round(hoursBetween(lot.timestamp, at), 4),
  };
}

/** Acquisition fees still attached to lots that have not been disposed. */
export function remainingLotFeesUsd(book: LotBook): number {
  return round(
    sum(
      book.lots.map((lot) => {
        const fraction = lot.quantity > 0 ? lot.remainingQuantity / lot.quantity : 0;
        return lot.feesUsd * fraction;
      }),
    ),
    6,
  );
}

/**
 * Removes quantity from the book without producing a disposal, used when a
 * transaction is reorged/dropped and its lot must be unwound (spec §51).
 */
export function removeLotsByEvent(book: LotBook, eventId: string): number {
  let removed = 0;
  book.lots = book.lots.filter((lot) => {
    if (lot.eventId !== eventId) return true;
    removed = round(removed + lot.remainingQuantity, 12);
    book.acquiredQuantity = round(book.acquiredQuantity - lot.quantity, 12);
    return false;
  });
  return removed;
}

export function remainingQuantity(book: LotBook): number {
  return round(sum(book.lots.map((lot) => lot.remainingQuantity)), 12);
}

/** Quantity currently held whose acquisition cost is unknown. */
export function unknownBasisQuantity(book: LotBook): number {
  return round(
    sum(book.lots.filter((lot) => !hasValue(lot.acquisitionCost)).map((lot) => lot.remainingQuantity)),
    12,
  );
}

/** Cost basis still attached to held tokens. */
export function remainingCostBasis(book: LotBook): MonetaryValue {
  const parts = book.lots
    .filter((lot) => lot.remainingQuantity > QUANTITY_EPSILON)
    .map((lot) => {
      if (!hasValue(lot.acquisitionCost)) {
        return unknownValue(
          lot.acquisitionCost.note ?? 'Lot has no known acquisition cost',
          'cost_basis_engine',
        );
      }
      const fraction = lot.quantity > 0 ? lot.remainingQuantity / lot.quantity : 0;
      return { ...lot.acquisitionCost, usd: round(lot.acquisitionCost.usd * fraction, 6) };
    });

  return parts.length === 0 ? zero('cost_basis_engine') : addValues(parts, 'cost_basis_engine');
}

export function averageCostPerToken(book: LotBook): MonetaryValue {
  const held = remainingQuantity(book);
  if (held <= QUANTITY_EPSILON) return zero('cost_basis_engine');

  const knownLots = book.lots.filter(
    (lot) => lot.remainingQuantity > QUANTITY_EPSILON && hasValue(lot.acquisitionCost),
  );
  const knownQuantity = sum(knownLots.map((lot) => lot.remainingQuantity));
  if (knownQuantity <= QUANTITY_EPSILON) {
    return unknownValue('No held lot has a known acquisition cost', 'cost_basis_engine');
  }

  const knownCost = sum(
    knownLots.map((lot) => {
      const cost = lot.acquisitionCost.usd as number;
      const fraction = lot.quantity > 0 ? lot.remainingQuantity / lot.quantity : 0;
      return cost * fraction;
    }),
  );

  const average = knownCost / knownQuantity;
  const covers = knownQuantity / held;

  return covers >= 0.999
    ? known(average, 'cost_basis_engine', undefined, 0.95)
    : estimated(average, 'cost_basis_engine', undefined, round(covers, 3));
}

export function summarizeCostBasis(book: LotBook): CostBasisState {
  return {
    positionId: book.positionId,
    tokenId: book.tokenId,
    chain: book.chain,
    method: book.method,
    acquiredQuantity: round(book.acquiredQuantity, 12),
    disposedQuantity: round(book.disposedQuantity, 12),
    remainingQuantity: remainingQuantity(book),
    acquisitionCost: book.acquisitionCosts.length
      ? addValues(book.acquisitionCosts, 'cost_basis_engine')
      : zero('cost_basis_engine'),
    averageCostUsd: averageCostPerToken(book),
    remainingCostBasis: remainingCostBasis(book),
    realizedCostBasis: book.realizedCostBasis.length
      ? addValues(book.realizedCostBasis, 'cost_basis_engine')
      : zero('cost_basis_engine'),
    unknownBasisQuantity: unknownBasisQuantity(book),
    lots: book.lots.map((lot) => ({ ...lot })),
  };
}
