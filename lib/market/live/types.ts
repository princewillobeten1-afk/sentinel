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
    v_usd?: number;
    vUsd?: number;
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
    tokenAddress?: string;
    owner?: string;
    side?: 'buy' | 'sell';
    volumeUsd?: number;
    volumeUSD?: number;
    volume?: number;
    tokenAmount?: number;
    amountSol?: number;
    priceUsd?: number;
    price?: number;
    blockUnixTime?: number;
    txHash?: string;
  };
}

export interface BirdeyeTokenStatsMessage {
  type: 'TOKEN_STATS_DATA';
  data: {
    address?: string;
    price?: number;
    marketcap?: number;
    liquidity?: number;
    volume_5m_usd?: number;
    buy_volume_5m_usd?: number;
    sell_volume_5m_usd?: number;
    volume_buy_5m_usd?: number;
    volume_sell_5m_usd?: number;
    volume_1h_usd?: number;
    volume_24h_usd?: number;
    trade_5m?: number;
    trade_1h?: number;
    trade_24h?: number;
    buy_5m?: number;
    sell_5m?: number;
    buy_1h?: number;
    sell_1h?: number;
    buy_24h?: number;
    sell_24h?: number;
    price_change_5m_percent?: number;
    price_change_1h_percent?: number;
    price_change_24h_percent?: number;
    last_trade_unix_time?: number;
  };
}

export type BirdeyeMessage = BirdeyePriceDataMessage | BirdeyeTxMessage | BirdeyeTokenStatsMessage | { type: string; data?: unknown };

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
  /**
   * Bytes received from the provider since the process started, across
   * reconnects. Reported because upstream data volume is a real cost — the
   * Helius program sweep ran at 36.7 MB/min unnoticed until it was measured.
   */
  bytesReceived?: number;
  /** When `bytesReceived` started counting. */
  countingSince?: string;
  /** Average receive rate since `countingSince`. */
  mbPerMinute?: number;
  /** Sanitized provider-level rejection, distinct from transport health. */
  providerError?: string;
}
