import 'server-only';

import { dbPool } from './pool';
import { generateId } from '@/lib/server/id';

/**
 * Postgres-backed token/market registry and snapshot store (Phase 5).
 *
 * Replaces per-process `Map`s in `lib/market-data/**`. The engines still do
 * all the computation; this is only where their output lives.
 *
 * Every numeric column is read back as a STRING (node-postgres' NUMERIC
 * default) and passed through untouched. A memecoin priced at
 * 0.000000000000123 survives a round trip here; through a JS float it would
 * not.
 */

export interface MarketRow {
  id: string;
  chain_id: string;
  protocol: string;
  market_type: string;
  address: string;
  base_token_id: string;
  quote_token_id: string;
  fee_bps: number;
  status: string;
  source: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MarketSnapshotRow {
  id: string;
  market_id: string;
  price: string | null;
  price_usd: string | null;
  liquidity_usd: string | null;
  volume_24h_usd: string | null;
  base_reserve: string | null;
  quote_reserve: string | null;
  confidence: string | null;
  source: string | null;
  observed_at: string;
}

export interface TokenRow {
  id: string;
  chain_id: string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo_url: string | null;
  status: string;
  metadata_status: string;
  discovery_source: string | null;
  first_seen_at: string;
  created_at: string;
  /**
   * Market data joined from `realtime_tokens`, the enrichment table populated
   * by `db/backfill-token-enrichment.js`.
   *
   * The `tokens` table is deliberately identity-only — it records what a token
   * *is*, not what it is worth — so every one of these is optional and `null`
   * whenever the token has not been enriched. NUMERIC columns arrive as
   * strings; they are not coerced here, matching every other money column in
   * this repository.
   */
  price_usd?: string | null;
  price_change_24h?: string | null;
  liquidity_usd?: string | null;
  market_cap_usd?: string | null;
  volume_24h_usd?: string | null;
  market_updated_at?: string | null;
}

/**
 * Ordering for the token registry.
 *
 * `symbol` is the registry's own natural order and stays the default — it is
 * what identity lookups expect. `volume` and `liquidity` exist for the
 * Overview's Top Tokens tab, where alphabetical order is meaningless: "top"
 * has to mean top *by something*.
 */
export type TokenSort = 'symbol' | 'volume' | 'liquidity';

/**
 * Unenriched tokens sort last under every market ordering.
 *
 * `NULLS LAST` matters more than it looks: without it Postgres sorts NULL
 * highest on a DESC ordering, so the tokens we know nothing about would lead a
 * list whose entire purpose is ranking by what we do know.
 */
const TOKEN_ORDER_BY: Record<TokenSort, string> = {
  symbol: 't.symbol ASC',
  volume: 'r.volume_24h_usd DESC NULLS LAST, t.symbol ASC',
  liquidity: 'r.liquidity_usd DESC NULLS LAST, t.symbol ASC',
};

export interface UpsertMarketInput {
  chainId: string;
  protocol: string;
  marketType: string;
  address: string;
  baseTokenId: string;
  quoteTokenId: string;
  feeBps?: number;
  status?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export class PgMarketRepository {
  /**
   * Idempotent by (chain_id, protocol, address) — the same pool discovered
   * from an on-chain scan and an external provider collapses to one row
   * instead of two competing records (Sprint 44 §41).
   */
  async upsertMarket(input: UpsertMarketInput): Promise<MarketRow> {
    const id = `${input.chainId}:${input.protocol}:${input.address}`;
    const { rows } = await dbPool.query<MarketRow>(
      `INSERT INTO markets (id, chain_id, protocol, market_type, address, base_token_id, quote_token_id,
                            fee_bps, status, source, metadata)
       VALUES ($1::varchar, $2::varchar, $3::varchar, $4::varchar, $5::varchar, $6::varchar, $7::varchar,
               COALESCE($8::integer, 0), COALESCE($9::varchar, 'DISCOVERED'), COALESCE($10::varchar, 'ONCHAIN'),
               COALESCE($11::jsonb, '{}'::jsonb))
       ON CONFLICT (chain_id, protocol, address) DO UPDATE SET
         market_type = EXCLUDED.market_type,
         base_token_id = EXCLUDED.base_token_id,
         quote_token_id = EXCLUDED.quote_token_id,
         fee_bps = EXCLUDED.fee_bps,
         status = EXCLUDED.status,
         metadata = EXCLUDED.metadata,
         updated_at = NOW()
       RETURNING *`,
      [
        id,
        input.chainId,
        input.protocol,
        input.marketType,
        input.address,
        input.baseTokenId,
        input.quoteTokenId,
        input.feeBps ?? null,
        input.status ?? null,
        input.source ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    );
    return rows[0];
  }

  async getMarket(marketId: string): Promise<MarketRow | undefined> {
    const { rows } = await dbPool.query<MarketRow>('SELECT * FROM markets WHERE id = $1', [marketId]);
    return rows[0];
  }

  /** Every market a token trades on — the "1 token ≠ 1 market" read. */
  async getMarketsForToken(tokenId: string): Promise<MarketRow[]> {
    const { rows } = await dbPool.query<MarketRow>(
      `SELECT * FROM markets WHERE base_token_id = $1 OR quote_token_id = $1 ORDER BY created_at ASC`,
      [tokenId],
    );
    return rows;
  }

  async listMarkets(opts: { limit: number; offset: number; chainId?: string; status?: string }): Promise<MarketRow[]> {
    const params: unknown[] = [];
    const clauses: string[] = [];
    if (opts.chainId) {
      params.push(opts.chainId);
      clauses.push(`chain_id = $${params.length}`);
    }
    if (opts.status) {
      params.push(opts.status);
      clauses.push(`status = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    params.push(opts.limit, opts.offset);
    const { rows } = await dbPool.query<MarketRow>(
      `SELECT * FROM markets ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return rows;
  }

  // ── Snapshots ────────────────────────────────────────────────────────────
  async recordSnapshot(input: {
    marketId: string;
    price?: string | null;
    priceUsd?: string | null;
    liquidityUsd?: string | null;
    volume24hUsd?: string | null;
    baseReserve?: string | null;
    quoteReserve?: string | null;
    confidence?: string | null;
    source?: string | null;
  }): Promise<MarketSnapshotRow> {
    const { rows } = await dbPool.query<MarketSnapshotRow>(
      `INSERT INTO market_snapshots (id, market_id, price, price_usd, liquidity_usd, volume_24h_usd,
                                     base_reserve, quote_reserve, confidence, source)
       VALUES ($1::varchar, $2::varchar, $3::numeric, $4::numeric, $5::numeric, $6::numeric,
               $7::numeric, $8::numeric, $9::numeric, $10::varchar)
       RETURNING *`,
      [
        generateId('msnap'),
        input.marketId,
        input.price ?? null,
        input.priceUsd ?? null,
        input.liquidityUsd ?? null,
        input.volume24hUsd ?? null,
        input.baseReserve ?? null,
        input.quoteReserve ?? null,
        input.confidence ?? null,
        input.source ?? null,
      ],
    );
    return rows[0];
  }

  /** Current state = newest observation. Appending never rewrites the market row. */
  async getLatestSnapshot(marketId: string): Promise<MarketSnapshotRow | undefined> {
    const { rows } = await dbPool.query<MarketSnapshotRow>(
      'SELECT * FROM market_snapshots WHERE market_id = $1 ORDER BY observed_at DESC LIMIT 1',
      [marketId],
    );
    return rows[0];
  }

  async getSnapshotHistory(marketId: string, limit = 100): Promise<MarketSnapshotRow[]> {
    const { rows } = await dbPool.query<MarketSnapshotRow>(
      'SELECT * FROM market_snapshots WHERE market_id = $1 ORDER BY observed_at DESC LIMIT $2',
      [marketId, limit],
    );
    return rows;
  }

  // ── Tokens ───────────────────────────────────────────────────────────────
  async getToken(tokenId: string): Promise<TokenRow | undefined> {
    const { rows } = await dbPool.query<TokenRow>('SELECT * FROM tokens WHERE id = $1', [tokenId]);
    return rows[0];
  }

  async getTokenByAddress(chainId: string, address: string): Promise<TokenRow | undefined> {
    const { rows } = await dbPool.query<TokenRow>(
      'SELECT * FROM tokens WHERE chain_id = $1 AND LOWER(address) = LOWER($2)',
      [chainId, address],
    );
    return rows[0];
  }

  /**
   * Token search (Sprint 42 §57) across symbol, name and address.
   *
   * Parameterised `ILIKE`, never string-concatenated SQL — the search term is
   * hostile user input (Sprint 42 §58). `%` and `_` in the term are escaped so
   * a query of "%" cannot match everything.
   */
  async searchTokens(opts: {
    query?: string;
    chainId?: string;
    status?: string;
    sort?: TokenSort;
    limit: number;
    offset: number;
  }): Promise<TokenRow[]> {
    const params: unknown[] = [];
    const clauses: string[] = [];

    if (opts.query) {
      const escaped = opts.query.replace(/[\\%_]/g, (c) => `\\${c}`);
      params.push(`%${escaped}%`);
      const p = params.length;
      clauses.push(`(t.symbol ILIKE $${p} ESCAPE '\\' OR t.name ILIKE $${p} ESCAPE '\\' OR t.address ILIKE $${p} ESCAPE '\\')`);
    }
    if (opts.chainId) {
      params.push(opts.chainId);
      clauses.push(`t.chain_id = $${params.length}`);
    }
    if (opts.status) {
      params.push(opts.status);
      clauses.push(`t.status = $${params.length}`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    // Whitelisted lookup, never interpolated user input — `sort` reaches here
    // from a query string.
    const orderBy = TOKEN_ORDER_BY[opts.sort ?? 'symbol'] ?? TOKEN_ORDER_BY.symbol;
    params.push(opts.limit, opts.offset);

    // LEFT JOIN, not INNER: a token that exists but has never been enriched
    // must still appear in its own registry, with nulls for what is unknown.
    // An INNER JOIN here would silently hide every unenriched token and make
    // the registry look emptier than it is.
    const { rows } = await dbPool.query<TokenRow>(
      `SELECT t.*,
              r.price_usd,
              r.price_change_24h,
              r.liquidity_usd,
              r.market_cap_usd,
              r.volume_24h_usd,
              r.updated_at AS market_updated_at
         FROM tokens t
         LEFT JOIN realtime_tokens r ON r.mint = t.address
         ${where}
        ORDER BY ${orderBy}
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return rows;
  }

  async countTokens(opts: { query?: string; chainId?: string; status?: string }): Promise<number> {
    const params: unknown[] = [];
    const clauses: string[] = [];
    if (opts.query) {
      const escaped = opts.query.replace(/[\\%_]/g, (c) => `\\${c}`);
      params.push(`%${escaped}%`);
      const p = params.length;
      clauses.push(`(symbol ILIKE $${p} ESCAPE '\\' OR name ILIKE $${p} ESCAPE '\\' OR address ILIKE $${p} ESCAPE '\\')`);
    }
    if (opts.chainId) {
      params.push(opts.chainId);
      clauses.push(`chain_id = $${params.length}`);
    }
    if (opts.status) {
      params.push(opts.status);
      clauses.push(`status = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const { rows } = await dbPool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tokens ${where}`,
      params,
    );
    return Number(rows[0]?.count ?? 0);
  }

  /**
   * Records a discovered token. Metadata enrichment is asynchronous and may
   * fail; the token is kept regardless (Sprint 44 §36/§38) — the indexer must
   * never drop an asset just because a metadata provider was down.
   */
  async upsertToken(input: {
    id?: string;
    chainId: string;
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    status?: string;
    metadataStatus?: string;
    discoverySource?: string;
  }): Promise<TokenRow> {
    const id = input.id ?? `tok_${input.chainId}_${input.address}`.slice(0, 64);
    const { rows } = await dbPool.query<TokenRow>(
      `INSERT INTO tokens (id, chain_id, address, symbol, name, decimals, status, metadata_status, discovery_source, first_seen_at)
       VALUES ($1::varchar, $2::varchar, $3::varchar, $4::varchar, $5::varchar, $6::integer,
               COALESCE($7::varchar, 'DISCOVERED'), COALESCE($8::varchar, 'PENDING'), $9::varchar, NOW())
       ON CONFLICT (id) DO UPDATE SET
         symbol = EXCLUDED.symbol,
         name = EXCLUDED.name,
         decimals = EXCLUDED.decimals,
         status = EXCLUDED.status
       RETURNING *`,
      [
        id,
        input.chainId,
        input.address,
        input.symbol,
        input.name,
        input.decimals,
        input.status ?? null,
        input.metadataStatus ?? null,
        input.discoverySource ?? null,
      ],
    );
    return rows[0];
  }

  /** Metadata failure is recorded, not fatal — the token stays discoverable. */
  async recordMetadataResult(tokenId: string, result: { status: 'OK' | 'FAILED' | 'UNAVAILABLE'; error?: string }): Promise<void> {
    await dbPool.query(
      `UPDATE tokens SET metadata_status = $2::varchar, metadata_last_attempt_at = NOW(), metadata_error = $3::text
       WHERE id = $1`,
      [tokenId, result.status, result.error ?? null],
    );
  }
}

export const pgMarketRepository = new PgMarketRepository();
