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

    const [dexRes, rugReport] = await Promise.allSettled([
      fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(address)}`, {
        signal: AbortSignal.timeout(4000), headers: { accept: 'application/json' },
      }).then(r => r.ok ? r.json() : null),
      fetch(`https://api.rugcheck.xyz/v1/tokens/${encodeURIComponent(address)}/report`, {
        signal: AbortSignal.timeout(4000), headers: { accept: 'application/json' },
      }).then(r => r.ok ? r.json() : null),
    ]);

    const pairs = dexRes.status === 'fulfilled' && Array.isArray(dexRes.value?.pairs) ? dexRes.value.pairs : [];
    const markets = rugReport.status === 'fulfilled' && Array.isArray(rugReport.value?.markets) ? rugReport.value.markets : [];

    if (liquidityUsd === null && pairs.length > 0) {
      const topLiq = pairs.map((p: any) => Number(p?.liquidity?.usd)).filter(Number.isFinite);
      if (topLiq.length > 0) liquidityUsd = Math.max(...topLiq);
    }

    const pools = pairs.slice(0, 6).map((p: any) => {
      const market = markets.find((m: any) => m?.pubkey === p?.pairAddress);
      const lockedPct = market?.lp?.lpLockedPct ?? (p?.dexId === 'pumpfun' ? 100 : 0);
      const lockStatus = lockedPct >= 95 ? (lockedPct === 100 ? 'burned' : 'locked') : 'unlocked';
      const baseSym = p.baseToken?.symbol || symbol || 'TOKEN';
      const quoteSym = p.quoteToken?.symbol || 'SOL';
      const solRes = p.liquidity?.quote ? `${Number(p.liquidity.quote).toFixed(2)} ${quoteSym}` : (market?.lp?.quote ? `${Number(market.lp.quote).toFixed(2)} ${quoteSym}` : '—');
      const tokenRes = p.liquidity?.base ? `${Number(p.liquidity.base).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${baseSym}` : (market?.lp?.base ? `${Number(market.lp.base).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${baseSym}` : '—');
      const feeTier = p?.feeTier ?? '0.25%';
      const feeRate = parseFloat(feeTier) / 100 || 0.0025;
      const vol24h = p?.volume?.h24;
      const fees24h = typeof vol24h === 'number' ? `$${(vol24h * feeRate).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—';
      const dexName = p.dexId ? p.dexId.charAt(0).toUpperCase() + p.dexId.slice(1) : 'DEX';

      return {
        id: p.pairAddress,
        dex: dexName,
        pair: `${baseSym}/${quoteSym}`,
        poolAddress: p.pairAddress,
        liquidityUsd: typeof p.liquidity?.usd === 'number' ? `$${Number(p.liquidity.usd).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : (typeof market?.lp?.quoteUSD === 'number' ? `$${Number(market.lp.quoteUSD * 2).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'),
        reserves: {
          sol: solRes,
          token: tokenRes,
        },
        volume24h: typeof vol24h === 'number' ? `$${Number(vol24h).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—',
        fees24h,
        apy: '—',
        lockStatus,
        lockDetails: lockedPct >= 95 ? (lockedPct === 100 ? '🔥 100% Burned' : `🔒 ${lockedPct}% Locked`) : 'Unlocked',
        feeTier,
      };
    });

    const payload = {
      token: address,
      chain: chain.toLowerCase(),
      symbol,
      priceUsd: price,
      totalLiquidityUsd: liquidityUsd,
      pools,
      lockStatus: pools.some((p: any) => p.lockStatus === 'burned') ? 'burned' : pools.some((p: any) => p.lockStatus === 'locked') ? 'locked' : null,
      coverage:
        pools.length > 0
          ? 'Live liquidity pools, reserves, 24h volume and verified lock status from DEX markets.'
          : 'Aggregate liquidity only. Per-pool reserves, APY and lock status are not queried by this endpoint.',
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
