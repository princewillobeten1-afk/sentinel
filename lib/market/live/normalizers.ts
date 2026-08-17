/**
 * Pure translation layer: provider-specific WS messages → `RawMarketEvent`.
 *
 * No I/O, no imports of WS clients — this is the primary unit-test surface
 * for the streaming integration. Every function returns `null` on malformed
 * or unrecognized input rather than throwing, so a single unexpected message
 * from a provider never takes down the connection's message handler.
 */

import type { RawMarketEvent } from '@/lib/market/event-pipeline';
import type {
  BirdeyeMessage,
  BirdeyePriceDataMessage,
  BirdeyeTxMessage,
  LogMatchResult,
} from './types';

// ────────────────────────────────────────────────────────────────────────────
// Birdeye
// ────────────────────────────────────────────────────────────────────────────

export function normalizeBirdeyePrice(mint: string, message: BirdeyeMessage): RawMarketEvent | null {
  if (message.type !== 'PRICE_DATA') return null;
  const data = (message as BirdeyePriceDataMessage).data;
  if (!data || typeof data.c !== 'number' || !Number.isFinite(data.c)) return null;

  const timestamp = Number.isFinite(data.unixTime) ? new Date(data.unixTime * 1000).toISOString() : new Date().toISOString();

  return {
    eventId: `birdeye_price_${mint}_${data.unixTime ?? Date.now()}`,
    providerId: 'birdeye_price_ws',
    mint,
    eventType: 'PRICE_UPDATE',
    priceUsd: String(data.c),
    volumeUsd: Number.isFinite(data.v) ? String(data.v) : undefined,
    timestamp,
  };
}

export function normalizeBirdeyeTx(mint: string, message: BirdeyeMessage): RawMarketEvent | null {
  if (message.type !== 'TXS_DATA' && message.type !== 'TRANSACTION_DATA') return null;
  const data = (message as BirdeyeTxMessage).data;
  if (!data) return null;

  const priceUsd = data.priceUsd ?? data.price;
  const volumeUsd = data.volumeUsd ?? data.volume;
  const timestamp = Number.isFinite(data.blockUnixTime)
    ? new Date((data.blockUnixTime as number) * 1000).toISOString()
    : new Date().toISOString();

  const eventId = data.txHash
    ? `birdeye_tx_${data.txHash}`
    : `birdeye_tx_${mint}_${data.blockUnixTime ?? Date.now()}`;

  return {
    eventId,
    providerId: 'birdeye_txs_ws',
    mint,
    eventType: 'SWAP',
    priceUsd: priceUsd !== undefined ? String(priceUsd) : undefined,
    volumeUsd: volumeUsd !== undefined ? String(volumeUsd) : undefined,
    timestamp,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Helius
// ────────────────────────────────────────────────────────────────────────────

const LOG_MATCH_TO_EVENT_TYPE: Record<LogMatchResult['eventType'], RawMarketEvent['eventType']> = {
  SWAP: 'SWAP',
  LIQUIDITY_ADD: 'LIQUIDITY_ADD',
  LIQUIDITY_REMOVE: 'LIQUIDITY_REMOVE',
};

/**
 * Turns a classified log match into a `RawMarketEvent`. Returns `null` when
 * the matcher couldn't confidently extract a mint, since `RawMarketEvent.mint`
 * is required and a fabricated placeholder would corrupt downstream per-mint
 * aggregation (spec: never invent a fact the source didn't provide).
 */
export function normalizeHeliusLogMatch(
  signature: string,
  programLabel: string,
  match: LogMatchResult,
): RawMarketEvent | null {
  if (!match.mint) return null;

  return {
    eventId: `helius_${signature}_${programLabel}`,
    providerId: `helius_logs_${programLabel}`,
    mint: match.mint,
    eventType: LOG_MATCH_TO_EVENT_TYPE[match.eventType],
    priceUsd: match.priceUsd,
    volumeUsd: match.volumeUsd,
    timestamp: new Date().toISOString(),
  };
}
