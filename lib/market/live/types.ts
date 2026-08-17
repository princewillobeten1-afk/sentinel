/**
 * Internal types for the real-time market data streaming layer.
 *
 * Pure type definitions only — erased at compile time, so this file needs no
 * `server-only` guard and is safe to import from tests or (in principle)
 * client code, even though nothing client-side should ever need it.
 */

// ────────────────────────────────────────────────────────────────────────────
// Birdeye WS message shapes (subset of fields Sentinel actually reads)
// ────────────────────────────────────────────────────────────────────────────

export interface BirdeyePriceDataMessage {
  type: 'PRICE_DATA';
  data: {
    eventType: string; // 'ohlcv' | ...
    type?: string; // candle interval, e.g. '1m'
    unixTime: number;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
  };
}

/**
 * Birdeye's transaction/swap push message. The exact field names were not
 * confirmed against a live example at implementation time (SUBSCRIBE_TXS
 * doc page didn't return a sample payload) — this shape is a best-effort
 * superset based on Birdeye's REST trade-record fields, with everything the
 * normalizer reads treated as optional so unexpected payloads degrade to
 * `null` instead of throwing. Tighten this once a live payload is observed.
 */
export interface BirdeyeTxMessage {
  type: 'TXS_DATA' | 'TRANSACTION_DATA' | string;
  data: {
    address?: string;
    owner?: string;
    side?: 'buy' | 'sell';
    volumeUsd?: number;
    volume?: number;
    priceUsd?: number;
    price?: number;
    blockUnixTime?: number;
    txHash?: string;
  };
}

export type BirdeyeMessage = BirdeyePriceDataMessage | BirdeyeTxMessage | { type: string; data?: unknown };

// ────────────────────────────────────────────────────────────────────────────
// Helius WS (standard Solana JSON-RPC over WebSocket) message shapes
// ────────────────────────────────────────────────────────────────────────────

export interface HeliusSubscribeResponse {
  jsonrpc: '2.0';
  id: number;
  result: number; // subscription id
}

export interface HeliusLogsNotification {
  jsonrpc: '2.0';
  method: 'logsNotification';
  params: {
    subscription: number;
    result: {
      context: { slot: number };
      value: {
        signature: string;
        err: unknown;
        logs: string[];
      };
    };
  };
}

export type HeliusMessage = HeliusSubscribeResponse | HeliusLogsNotification | Record<string, unknown>;

// ────────────────────────────────────────────────────────────────────────────
// Log matching (Helius on-chain classification)
// ────────────────────────────────────────────────────────────────────────────

export interface LogMatchResult {
  eventType: 'SWAP' | 'LIQUIDITY_ADD' | 'LIQUIDITY_REMOVE';
  /** Only populated when confidently derivable from the raw log lines. */
  mint?: string;
  priceUsd?: string;
  volumeUsd?: string;
}

export type LogMatcher = (logs: string[]) => LogMatchResult | null;

// ────────────────────────────────────────────────────────────────────────────
// Live cache
// ────────────────────────────────────────────────────────────────────────────

export interface LatestMintState {
  mint: string;
  lastPriceUsd: string | null;
  lastVolumeUsd: string | null;
  lastEventType: string;
  provider: string;
  freshness: 'fresh' | 'stale';
  lastEventAt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Connection health (surfaced via the debug status route)
// ────────────────────────────────────────────────────────────────────────────

export type ConnectionState = 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface ConnectionHealth {
  state: ConnectionState;
  lastMessageAt: string | null;
  consecutiveFailures: number;
}
