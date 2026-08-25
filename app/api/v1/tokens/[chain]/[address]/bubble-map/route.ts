import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { fetchHolderConcentration, type HolderRow } from '@/lib/tokens/holder-analysis';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/tokens/:chain/:address/bubble-map
 *
 * Supply distribution across the largest holders, drawn from chain state.
 *
 * ## What this replaced
 *
 * A fixed set of nodes returned for every token: a "Raydium CPMM Pool" holding
 * exactly 18.42%, a "Dev Creator Wallet" at 0.85%, retail at 67.21%, with
 * invented addresses (`5xRydm99qP88x12kL0z1`), invented funding sources
 * ("Genesis Raydium CPMM Vault") and hardcoded x/y coordinates. The same
 * picture rendered for Wrapped SOL as for a token minted a minute ago.
 *
 * ## What is real here, and what is absent
 *
 * Addresses, balances and supply percentages come from
 * `getTokenLargestAccounts` + `getTokenSupply`, resolved to owning wallets.
 * Node radius is proportional to holding, and positions are laid out from the
 * data rather than fixed.
 *
 * `fundingSource` is **null on every node**. Determining who funded a wallet
 * needs a transaction-history walk that this endpoint does not do, and the
 * previous strings were narrative. That is the funding-wallet graph, and it is
 * a separate build.
 */

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; payload: unknown }>();

/** Lays nodes out on a ring, largest first, sized by holding. */
function layout(holders: HolderRow[]) {
  const width = 320;
  const height = 260;
  const centreX = width / 2;
  const centreY = height / 2;

  const maxPct = Math.max(...holders.map((h) => h.percent ?? 0), 0.0001);

  return holders.map((holder, index) => {
    // Largest sits at the centre; the rest ring outward in rank order.
    const isCentre = index === 0;
    const ringIndex = index - 1;
    const perRing = 7;
    const ring = Math.floor(ringIndex / perRing);
    const angle = ((ringIndex % perRing) / perRing) * Math.PI * 2 + ring * 0.5;
    const radius = 70 + ring * 46;

    const share = (holder.percent ?? 0) / maxPct;
    // Area-proportional, so a 2x holding does not look 4x larger.
    const r = Math.max(9, Math.min(46, 9 + Math.sqrt(share) * 34));

    return {
      id: `node_${holder.rank}`,
      label: holder.poolLabel ?? `#${holder.rank}`,
      tag: holder.isPool ? 'dex' : 'holder',
      address: holder.address,
      tokenAccount: holder.tokenAccount,
      balanceTokens: holder.balance,
      supplyPct: holder.percent === null ? null : Number(holder.percent.toFixed(2)),
      // No USD value: this endpoint reads balances, not prices, and deriving
      // one from a price fetched elsewhere is how the app came to disagree
      // with itself about what things are worth.
      valueUsd: null,
      x: isCentre ? centreX : centreX + Math.cos(angle) * radius,
      y: isCentre ? centreY : centreY + Math.sin(angle) * radius,
      r,
      // Not determinable here — see the module header.
      fundingSource: null,
      color: holder.isPool ? 'rgba(6, 182, 212, 0.25)' : 'rgba(148, 163, 184, 0.18)',
      borderColor: holder.isPool ? '#2B6FC4' : '#64748B',
    };
  });
}

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
    if (!rpcUrl) throw new ApiError('No Solana RPC is configured', 503);

    const concentration = await fetchHolderConcentration(rpcUrl, address);
    if (!concentration) {
      throw new ApiError('Holder distribution is unavailable for this token right now', 503);
    }

    const payload = {
      token: address,
      chain: chain.toLowerCase(),
      nodes: layout(concentration.holders),
      top10ConcentrationPct: concentration.top10Pct,
      totalSupply: concentration.totalSupply,
      // Clustering requires the funding graph, which is not built. Reporting 0
      // would read as "checked, none found".
      suspiciousClustersDetected: null,
      coverage: 'Top 20 token accounts by balance. Funding relationships are not mapped.',
      timestamp: new Date().toISOString(),
    };

    cache.set(address, { at: Date.now(), payload });
    return jsonResponse(payload);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new ApiError('Failed to build distribution map', 500),
    );
  }
}
