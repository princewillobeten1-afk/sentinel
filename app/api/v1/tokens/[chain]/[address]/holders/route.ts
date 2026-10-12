import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { fetchHolderConcentration } from '@/lib/tokens/holder-analysis';
import { getTokenCardPatch } from '@/lib/market/live/card-cache';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/tokens/:chain/:address/holders
 *
 * The token's largest holders and its top-10 concentration, read from chain
 * state, enriched with total holder count and verified wallet tags.
 */

/** Concentration changes slowly; a short cache keeps repeat views cheap. */
const CACHE_TTL_MS = 60_000;
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

    const rpcUrl = process.env.HELIUS_RPC_URL?.trim() || 'https://api.mainnet-beta.solana.com';

    const patch = getTokenCardPatch(address)?.changedFields;
    let totalHoldersCount: number | null = typeof patch?.holdersCount === 'number' ? patch.holdersCount : null;
    let detectedDev: string | null = patch?.devAddress ?? null;
    const knownPools: string[] = [];

    try {
      const [dexRes, jupRes] = await Promise.all([
        fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {
          signal: AbortSignal.timeout(3500),
          cache: 'no-store',
        }).catch(() => null),
        fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(address)}`, {
          signal: AbortSignal.timeout(3500),
          headers: { accept: 'application/json' },
        }).catch(() => null),
      ]);

      if (dexRes && dexRes.ok) {
        const dexData = await dexRes.json();
        if (Array.isArray(dexData?.pairs)) {
          for (const p of dexData.pairs) {
            if (p.pairAddress) knownPools.push(p.pairAddress);
          }
        }
      }

      if (jupRes && jupRes.ok) {
        const body = await jupRes.json();
        const list = Array.isArray(body) ? body : (body?.tokens ?? []);
        const t = list.find((item: any) => item.id === address) ?? list[0];
        if (t) {
          if (t.firstPool?.id) knownPools.push(t.firstPool.id);
          if (t.graduatedPool) knownPools.push(t.graduatedPool);
          if (!detectedDev && t.dev) detectedDev = t.dev;
          const count = Number(t.holderCount ?? t.holdersCount ?? t.audit?.totalHolders);
          if (Number.isFinite(count) && count > 0) totalHoldersCount = count;
        }
      }
    } catch {
      // Non-fatal, degrades gracefully
    }

    const concentration = await fetchHolderConcentration(rpcUrl, address, knownPools);
    if (!concentration) {
      throw new ApiError('Holder data is unavailable for this token right now', 503);
    }

    const payload = {
      token: address,
      chain: chain.toLowerCase(),
      totalHoldersCount: totalHoldersCount ?? concentration.totalHolders,
      top10ConcentrationPct: concentration.top10Pct,
      top10IncludingPoolsPct: concentration.top10IncludingPoolsPct,
      totalSupply: concentration.totalSupply,
      holders: concentration.holders.map((holder) => {
        let tag = holder.poolLabel;
        if (!tag && detectedDev && holder.address.toLowerCase() === detectedDev.toLowerCase()) {
          tag = 'Dev 👨‍💻';
        } else if (!tag && holder.percent !== null && holder.percent >= 2) {
          tag = 'Whale 🐋';
        } else if (!tag) {
          tag = 'Trader';
        }
        return {
          rank: holder.rank,
          address: holder.address,
          tokenAccount: holder.tokenAccount,
          balance: holder.balance,
          percent: holder.percent,
          tag,
          isContract: holder.isPool,
        };
      }),
      coverage: 'Top 20 token accounts by balance, aggregated to owning wallets.',
      timestamp: new Date().toISOString(),
    };

    cache.set(address, { at: Date.now(), payload });
    return jsonResponse(payload);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new ApiError('Failed to fetch holders', 500),
    );
  }
}
