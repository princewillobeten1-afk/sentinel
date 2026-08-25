import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { getTokenPriceUsd } from '@/lib/market/canonical-price';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/tokens/:chain/:address/liquidity
 *
 * Aggregate liquidity for a token.
 *
 * ## What this replaced
 *
 * Two fully invented pools, returned for every token: a "Raydium CPMM" at
 * address `5xRydm99qP88x12kL0z1` and an "Orca Whirlpool" at
 * `orca_whirl_41a99x88b7`, with APYs of 142.8% and 168.4%, 24h volume computed
 * as `liquidity * 3.2`, reserves derived using a hardcoded SOL price of 150,
 * and a "🔥 100% LP Burned (Solana Incinerator)" lock status asserted without
 * anything being checked.
 *
 * When Birdeye failed — which it always does, its quota being exhausted — the
 * whole structure was built on `price = 0.0425` and `liquidity = 384500`,
 * identical for every token.
 *
 * ## What is served now
 *
 * The token's real total liquidity and price from Jupiter, which publishes
 * both. **No per-pool breakdown**: enumerating pools needs a DEX-by-DEX pool
 * query this endpoint does not perform, and the previous breakdown was
 * narrative. `pools` is empty with the reason stated, rather than populated
 * with plausible-looking entries.
 */

const JUPITER_SEARCH = 'https://lite-api.jup.ag/tokens/v2/search';
const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { at: number; payload: unknown }>();

export async function GET(
  _request: Request,
  { params }: { params: { chain: string; address: string } },
) {
  try {
    const { chain, address } = params;
    if (!address || address.length < 32) {
      throw new ApiError('A token mint address is required', 400);
    }

    const cached = cache.get(address);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return jsonResponse(cached.payload as Record<string, unknown>);
    }

    let symbol: string | null = null;
    let liquidityUsd: number | null = null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const res = await fetch(`${JUPITER_SEARCH}?query=${encodeURIComponent(address)}`, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
      if (res.ok) {
        const body = await res.json();
        const list = Array.isArray(body) ? body : (body?.tokens ?? []);
        const token = list.find((t: { id?: string }) => t.id === address) ?? list[0];
        if (token) {
          symbol = token.symbol ?? null;
          const liq = Number(token.liquidity);
          liquidityUsd = Number.isFinite(liq) ? liq : null;
        }
      }
    } catch {
      // Unavailable — reported as unknown below, never substituted.
    } finally {
      clearTimeout(timer);
    }

    const price = (await getTokenPriceUsd(address))?.usdPrice ?? null;

    const payload = {
      token: address,
      chain: chain.toLowerCase(),
      symbol,
      priceUsd: price,
      totalLiquidityUsd: liquidityUsd,
      // Empty, deliberately. See the module header.
      pools: [] as unknown[],
      // Not checked. This was asserted as "100% LP Burned" for every token.
      lockStatus: null,
      coverage:
        'Aggregate liquidity only. Per-pool reserves, APY and lock status are not queried by this endpoint.',
      timestamp: new Date().toISOString(),
    };

    cache.set(address, { at: Date.now(), payload });
    return jsonResponse(payload);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new ApiError('Failed to fetch liquidity', 500),
    );
  }
}
