import { dbPool } from './pool';
import { logger } from '../logger';
import type { NormalizedRealtimeEvent } from '../events/event-types';

export interface TokenRecord {
  mint: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  imageUrl?: string;
  platform?: string;
  poolAddress?: string;
  firstSeenAt?: string;
  firstSeenSlot?: number;
  firstSignature?: string;
  priceUsd?: number;
  liquidityUsd?: number;
  marketCapUsd?: number;
  volume24hUsd?: number;
  updatedAt?: string;
}

export interface TradeRecord {
  signature: string;
  mint: string;
  wallet?: string;
  side: 'BUY' | 'SELL';
  amount?: number;
  amountSol?: number;
  priceUsd?: number;
  slot?: number;
  timestamp?: string;
}

export class RealtimeRepository {
  private inMemoryTokens = new Map<string, TokenRecord>();
  private inMemoryTrades: TradeRecord[] = [];

  /**
   * Persists a newly created token.
   */
  public async saveToken(token: TokenRecord): Promise<void> {
    this.inMemoryTokens.set(token.mint, {
      ...this.inMemoryTokens.get(token.mint),
      ...token,
      updatedAt: new Date().toISOString(),
    });

    try {
      await dbPool.query(
        `INSERT INTO realtime_tokens (mint, name, symbol, decimals, image_url, platform, pool_address, first_seen_slot, first_signature, price_usd, liquidity_usd, market_cap_usd, volume_24h_usd)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (mint) DO UPDATE SET
           name = COALESCE(EXCLUDED.name, realtime_tokens.name),
           symbol = COALESCE(EXCLUDED.symbol, realtime_tokens.symbol),
           pool_address = COALESCE(EXCLUDED.pool_address, realtime_tokens.pool_address),
           price_usd = COALESCE(EXCLUDED.price_usd, realtime_tokens.price_usd),
           liquidity_usd = COALESCE(EXCLUDED.liquidity_usd, realtime_tokens.liquidity_usd),
           updated_at = NOW()`,
        [
          token.mint,
          token.name || null,
          token.symbol || null,
          token.decimals || 9,
          token.imageUrl || null,
          token.platform || null,
          token.poolAddress || null,
          token.firstSeenSlot || null,
          token.firstSignature || null,
          token.priceUsd || null,
          token.liquidityUsd || null,
          token.marketCapUsd || null,
          token.volume24hUsd || null,
        ]
      );
    } catch (err) {
      logger.warn('[realtime-repo] saveToken DB write failed, using in-memory store', { error: (err as Error).message });
    }
  }

  /**
   * Updates market stats for an existing token.
   */
  public async saveTokenUpdate(update: Partial<TokenRecord> & { mint: string }): Promise<void> {
    const existing = this.inMemoryTokens.get(update.mint) || { mint: update.mint };
    this.inMemoryTokens.set(update.mint, { ...existing, ...update, updatedAt: new Date().toISOString() });

    try {
      await dbPool.query(
        `UPDATE realtime_tokens
         SET price_usd = COALESCE($2, price_usd),
             liquidity_usd = COALESCE($3, liquidity_usd),
             market_cap_usd = COALESCE($4, market_cap_usd),
             volume_24h_usd = COALESCE($5, volume_24h_usd),
             updated_at = NOW()
         WHERE mint = $1`,
        [update.mint, update.priceUsd || null, update.liquidityUsd || null, update.marketCapUsd || null, update.volume24hUsd || null]
      );
    } catch (err) {
      logger.warn('[realtime-repo] saveTokenUpdate DB write failed, using in-memory store', { error: (err as Error).message });
    }
  }

  /**
   * Persists a trade event.
   */
  public async saveTrade(trade: TradeRecord): Promise<void> {
    this.inMemoryTrades.push(trade);
    if (this.inMemoryTrades.length > 2000) {
      this.inMemoryTrades.shift();
    }

    try {
      await dbPool.query(
        `INSERT INTO realtime_trades (signature, mint, wallet, side, amount, amount_sol, price_usd, slot, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamptz, NOW()))
         ON CONFLICT (signature, mint, side) DO NOTHING`,
        [
          trade.signature,
          trade.mint,
          trade.wallet || null,
          trade.side,
          trade.amount || null,
          trade.amountSol || null,
          trade.priceUsd || null,
          trade.slot || null,
          trade.timestamp || null,
        ]
      );
    } catch (err) {
      logger.warn('[realtime-repo] saveTrade DB write failed, using in-memory store', { error: (err as Error).message });
    }
  }

  /**
   * Queries recent tokens.
   */
  public async getTokens(limit = 50, since?: string): Promise<TokenRecord[]> {
    try {
      let query = `SELECT mint, name, symbol, decimals, image_url as "imageUrl", platform, pool_address as "poolAddress", first_seen_at as "firstSeenAt", first_seen_slot as "firstSeenSlot", price_usd as "priceUsd", liquidity_usd as "liquidityUsd", market_cap_usd as "marketCapUsd", volume_24h_usd as "volume24hUsd", updated_at as "updatedAt" FROM realtime_tokens`;
      const params: unknown[] = [];

      if (since) {
        params.push(since);
        query += ` WHERE updated_at > $1 ORDER BY updated_at DESC LIMIT $2`;
        params.push(limit);
      } else {
        query += ` ORDER BY updated_at DESC LIMIT $1`;
        params.push(limit);
      }

      const res = await dbPool.query<TokenRecord>(query, params);
      if (res.rows.length > 0) return res.rows;
    } catch {
      // Fall back to memory
    }

    const arr = Array.from(this.inMemoryTokens.values());
    arr.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return arr.slice(0, limit);
  }

  /**
   * Queries a single token by mint.
   */
  public async getTokenByMint(mint: string): Promise<TokenRecord | null> {
    try {
      const res = await dbPool.query<TokenRecord>(
        `SELECT mint, name, symbol, decimals, image_url as "imageUrl", platform, pool_address as "poolAddress", first_seen_at as "firstSeenAt", first_seen_slot as "firstSeenSlot", price_usd as "priceUsd", liquidity_usd as "liquidityUsd", market_cap_usd as "marketCapUsd", volume_24h_usd as "volume24hUsd", updated_at as "updatedAt"
         FROM realtime_tokens WHERE mint = $1 LIMIT 1`,
        [mint]
      );
      if (res.rows[0]) return res.rows[0];
    } catch {
      // Fall back to memory
    }
    return this.inMemoryTokens.get(mint) || null;
  }

  /**
   * Queries recent trades for a token.
   */
  public async getTradesByMint(mint: string, limit = 50): Promise<TradeRecord[]> {
    try {
      const res = await dbPool.query<TradeRecord>(
        `SELECT signature, mint, wallet, side, amount, amount_sol as "amountSol", price_usd as "priceUsd", slot, timestamp
         FROM realtime_trades WHERE mint = $1 ORDER BY timestamp DESC LIMIT $2`,
        [mint, limit]
      );
      if (res.rows.length > 0) return res.rows;
    } catch {
      // Fall back to memory
    }
    return this.inMemoryTrades.filter((t) => t.mint === mint).slice(-limit);
  }
}

export const realtimeRepository = new RealtimeRepository();
