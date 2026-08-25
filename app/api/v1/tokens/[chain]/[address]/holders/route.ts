import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { fetchHolderConcentration } from '@/lib/tokens/holder-analysis';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/tokens/:chain/:address/holders
 *
 * The token's largest holders and its top-10 concentration, read from chain
 * state.
 *
 * ## What this replaced
 *
 * A hardcoded array, returned identically for every token ever requested:
 * "Raydium CPMM Pool 18.42%", "Dev Creator (Vested) 8.00%", "Whale #1",
 * "Smart Money", "Early Sniper" — with exact balances and USD values, all
 * denominated in a `$SENT` token that does not exist on-chain. It rendered on
 * the Wrapped SOL page styled exactly like real data.
 *
 * Ownership concentration is this product's stated differentiator, so this was
 * the single most important thing on the site to make true.
 *
 * ## Limits, stated rather than papered over
 *
 * `getTokenLargestAccounts` returns at most 20 accounts, so `totalHolders` is
 * not observable here and comes back null. Nothing on-chain labels a wallet as
 * a whale, a sniper or a dev, so no such tags are emitted — only pool accounts
 * are identifiable, by their owning program.
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

    const rpcUrl = process.env.HELIUS_RPC_URL?.trim();
    if (!rpcUrl) {
      throw new ApiError('No Solana RPC is configured, so holders cannot be read', 503);
    }

    const concentration = await fetchHolderConcentration(rpcUrl, address);
    if (!concentration) {
      // A genuine "could not read" — not an empty cap table dressed as one.
      throw new ApiError('Holder data is unavailable for this token right now', 503);
    }

    const payload = {
      token: address,
      chain: chain.toLowerCase(),
      // Null rather than a number: the RPC caps at 20 accounts, so the true
      // holder count is not knowable from this source.
      totalHoldersCount: concentration.totalHolders,
      top10ConcentrationPct: concentration.top10Pct,
      top10IncludingPoolsPct: concentration.top10IncludingPoolsPct,
      totalSupply: concentration.totalSupply,
      holders: concentration.holders.map((holder) => ({
        rank: holder.rank,
        address: holder.address,
        tokenAccount: holder.tokenAccount,
        balance: holder.balance,
        percent: holder.percent,
        // The only label the chain actually supports.
        tag: holder.poolLabel,
        isContract: holder.isPool,
      })),
      coverage: 'Top 20 token accounts by balance, resolved to owning wallets.',
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
