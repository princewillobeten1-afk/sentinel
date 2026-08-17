export const dynamic = 'force-dynamic';

import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { pgMarketRepository, type TokenRow } from '@/lib/server/db/market-repository';
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

    const rawLimit = Number(url.searchParams.get('limit') ?? 25);
    if (!Number.isFinite(rawLimit) || rawLimit < 1) {
      throw new ApiError('limit must be a positive number', 400, 'INVALID_REQUEST');
    }
    // Default 25, hard max 100 (Sprint 42 §56) — never unbounded.
    const limit = Math.min(rawLimit, 100);

    const fingerprint = computeFilterFingerprint({ query, chainId, status });
    const offset = resolveOffset(
      Math.max(Number(url.searchParams.get('offset') ?? 0), 0),
      url.searchParams.get('cursor') ?? undefined,
      fingerprint,
    );

    const [rows, total] = await Promise.all([
      pgMarketRepository.searchTokens({ query, chainId, status, limit, offset }),
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
