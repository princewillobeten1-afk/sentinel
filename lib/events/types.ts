/**
 * Canonical Event Schema & Categories (Sprint 34 §31-33, Sprint 44 §47-49).
 *
 * Defines the standard typed events powering the Project Sentinel event-driven backbone:
 *   - Legacy categories: TOKEN_CREATED, LIQUIDITY_ADDED, LIQUIDITY_REMOVED, SWAP, TRANSFER,
 *     WALLET_BUY, WALLET_SELL, CREATOR_ACTION, ORDER_CREATED, ORDER_FILLED, TRANSACTION_CONFIRMED.
 *   - Sprint 44 Realtime Event Names:
 *     market.price_updated, market.volume_updated, token.discovered, token.updated,
 *     transaction.confirmed, wallet.activity, wallet.balance_updated.
 *   - Stable versioned event payload: { type, version, timestamp, data }
 */

export type RealtimeEventType =
  | 'market.price_updated'
  | 'market.volume_updated'
  | 'token.discovered'
  | 'token.updated'
  | 'transaction.confirmed'
  | 'wallet.activity'
  | 'wallet.balance_updated';

export type EventCategory =
  | 'TOKEN_CREATED'
  | 'LIQUIDITY_ADDED'
  | 'LIQUIDITY_REMOVED'
  | 'SWAP'
  | 'TRANSFER'
  | 'WALLET_BUY'
  | 'WALLET_SELL'
  | 'CREATOR_ACTION'
  | 'ORDER_CREATED'
  | 'ORDER_FILLED'
  | 'TRANSACTION_CONFIRMED'
  | RealtimeEventType;

export interface RealtimeEventPayload<T = any> {
  type: RealtimeEventType | string;
  version: number;
  timestamp: string; // ISO 8601 UTC
  data: T;
}

export interface CanonicalEvent<T = any> {
  eventId: string;
  eventType: EventCategory;
  version: string;
  chain: 'solana' | 'ethereum' | 'base' | string;
  blockNumber?: number;
  slot?: number;
  transactionHash?: string;
  timestamp: string; // ISO 8601 UTC
  source: 'solana_geyser' | 'helius_indexer' | 'raydium_amm' | 'order_engine' | 'system' | 'blockchain_indexer' | string;
  payload: T;
}

export type EventSubscriber<T = any> = (event: CanonicalEvent<T>) => Promise<void> | void;

export interface EventBusSubscription {
  id: string;
  category: EventCategory | '*';
  filter?: (event: CanonicalEvent) => boolean;
  subscriber: EventSubscriber;
  unsubscribe: () => void;
}
