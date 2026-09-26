import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { fetchHolderConcentration, type HolderRow } from '@/lib/tokens/holder-analysis';
import { getTokenCardPatch } from '@/lib/market/live/card-cache';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/tokens/:chain/:address/bubble-map
 *
 * Supply distribution across the largest holders, drawn from chain state.
 */

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; payload: unknown }>();

/** Lays nodes out across the full 580x260 canvas, largest first, sized by holding. */
function layout(holders: HolderRow[], creatorWallet?: string | null, funderWallet?: string | null) {
  const width = 580;
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

    const isCreator = Boolean(creatorWallet && holder.address.toLowerCase() === creatorWallet.toLowerCase());

    return {
      id: `node_${holder.rank}`,
      label: isCreator ? 'Dev / Creator' : (holder.poolLabel ?? `#${holder.rank}`),
      tag: isCreator ? 'dev' : (holder.isPool ? 'dex' : 'holder'),
      address: holder.address,
      tokenAccount: holder.tokenAccount,
      balanceTokens: holder.balance,
      supplyPct: holder.percent === null ? null : Number(holder.percent.toFixed(2)),
      valueUsd: null,
      x: isCentre ? centreX : centreX + Math.cos(angle) * radius,
      y: isCentre ? centreY : centreY + Math.sin(angle) * radius,
      r,
      fundingSource: isCreator ? (funderWallet ?? null) : null,
      color: isCreator
        ? 'rgba(168, 85, 247, 0.25)'
        : (holder.isPool ? 'rgba(6, 182, 212, 0.25)' : 'rgba(148, 163, 184, 0.18)'),
      borderColor: isCreator ? '#a855f7' : (holder.isPool ? '#2B6FC4' : '#64748B'),
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

    const live = getTokenCardPatch(address)?.changedFields;
    const creatorAddress = live?.devAddress ?? null;
    const funderAddress = live?.funding?.address ?? null;

    const nodes = layout(concentration.holders, creatorAddress, funderAddress);
    const devNode = nodes.find(n => n.tag === 'dev' || n.fundingSource);
    const links = devNode && devNode.fundingSource ? [{
      from: 'funder_wallet',
      to: devNode.id,
      fromAddress: devNode.fundingSource,
      toAddress: devNode.address,
      type: 'funding_inflow',
    }] : [];

    const payload = {
      token: address,
      chain: chain.toLowerCase(),
      nodes,
      links,
      top10ConcentrationPct: concentration.top10Pct,
      totalSupply: concentration.totalSupply,
      suspiciousClustersDetected: null,
      coverage: devNode?.fundingSource
        ? 'Top 20 token accounts by balance. Genesis funding identified for creator.'
        : 'Top 20 token accounts by balance. Funding relationships are not mapped.',
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
