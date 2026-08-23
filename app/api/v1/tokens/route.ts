export const dynamic = 'force-dynamic';

import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { pgMarketRepository, type TokenRow, type TokenSort } from '@/lib/server/db/market-repository';
import { computeFilterFingerprint, resolveOffset, nextCursorFor } from '@/lib/discovery/cursor';

/**
 * GET /api/v1/tokens — the canonical token registry (Phase 5, Sprint 42 §49).
 *
 * Distinct from `/api/v1/tokens/search`, which is the ranked multi-tier
 * discovery search over the in-memory ranking engine. This endpoint is the
 * registry of record: what tokens exist, on what chain, in what lifecycle
 * state. Both are legitimate; only this one is authoritative about identity.
 *
 * Public (no auth): a token registry is public information, matching the
 * other read-only discovery endpoints. Nothing user-scoped is exposed.
 *
 * Cursor pagination reuses `lib/discovery/cursor.ts` — the codebase's existing
 * primitive — rather than inventing a second scheme. A cursor is bound to the
 * exact filter set it was minted for, so replaying it against a different
 * query fails loudly with `INVALID_CURSOR` instead of silently returning the
 * wrong page.
 */

const TOKEN_STATUSES = ['DISCOVERED', 'VALIDATED', 'ACTIVE', 'INACTIVE', 'SUSPICIOUS', 'DELISTED'];
const TOKEN_SORTS = ['symbol', 'volume', 'liquidity'] as const;

/**
 * NUMERIC columns arrive from `pg` as strings. Kept as numbers on the wire for
 * the display fields below — these are chart and card inputs, not amounts any
 * arithmetic settles on, and the codebase reserves decimal strings for the
 * money paths (orders, balances) where float error would be a real defect.
 *
 * `null` is preserved rather than coerced to 0: a token nobody has enriched has
 * *no* price, which the UI renders as "—". Zero would claim it is worthless.
 */
function marketNumber(v: string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toTokenDto(row: TokenRow) {
  return {
    id: row.id,
    chainId: row.chain_id,
    address: row.address,
    symbol: row.symbol,
    name: row.name,
    decimals: row.decimals,
    logoUrl: row.logo_url,
    status: row.status,
    metadataStatus: row.metadata_status,
    discoverySource: row.discovery_source,
    firstSeenAt: new Date(row.first_seen_at).toISOString(),
    // Joined from `realtime_tokens` when the token has been enriched by
    // `db/backfill-token-enrichment.js`; null throughout when it has not.
    priceUsd: marketNumber(row.price_usd),
    priceChange24h: marketNumber(row.price_change_24h),
    liquidityUsd: marketNumber(row.liquidity_usd),
    marketCapUsd: marketNumber(row.market_cap_usd),
    volume24hUsd: marketNumber(row.volume_24h_usd),
    marketUpdatedAt: row.market_updated_at ? new Date(row.market_updated_at).toISOString() : null,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('search') ?? url.searchParams.get('q') ?? undefined;
    const chainId = url.searchParams.get('chain') ?? undefined;
    const status = url.searchParams.get('status') ?? undefined;

    if (status && !TOKEN_STATUSES.includes(status)) {
      throw new ApiError(`Unknown token status: ${status}`, 400, 'INVALID_REQUEST');
    }

    // Rejected rather than defaulted: `sort` reaches SQL through a whitelist,
    // and a caller who asks for an ordering we do not have should be told, not
    // handed alphabetical order that silently isn't what they asked for.
    const sort = url.searchParams.get('sort') ?? undefined;
    if (sort && !TOKEN_SORTS.includes(sort as (typeof TOKEN_SORTS)[number])) {
      throw new ApiError(
        `Unknown sort: ${sort}. Expected one of ${TOKEN_SORTS.join(', ')}.`,
        400,
        'INVALID_REQUEST',
      );
    }

    const rawLimit = Number(url.searchParams.get('limit') ?? 25);
    if (!Number.isFinite(rawLimit) || rawLimit < 1) {
      throw new ApiError('limit must be a positive number', 400, 'INVALID_REQUEST');
    }
    // Default 25, hard max 100 (Sprint 42 §56) — never unbounded.
    const limit = Math.min(rawLimit, 100);

    // `sort` is part of the fingerprint: a cursor minted against volume order
    // would land on the wrong page if replayed alphabetically.
    const fingerprint = computeFilterFingerprint({ query, chainId, status, sort });
    const offset = resolveOffset(
      Math.max(Number(url.searchParams.get('offset') ?? 0), 0),
      url.searchParams.get('cursor') ?? undefined,
      fingerprint,
    );

    const [rows, total] = await Promise.all([
      pgMarketRepository.searchTokens({
        query,
        chainId,
        status,
        sort: sort as TokenSort | undefined,
        limit,
        offset,
      }),
      pgMarketRepository.countTokens({ query, chainId, status }),
    ]);

    return jsonResponse({
      data: rows.map(toTokenDto),
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + rows.length < total,
        nextCursor: nextCursorFor(offset, limit, rows.length, fingerprint, offset + rows.length < total),
      },
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to list tokens', 500));
  }
}
