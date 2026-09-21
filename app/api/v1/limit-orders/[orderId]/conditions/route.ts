import { ApiError } from '@/lib/server/errors';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { limitOrderService } from '@/lib/limit-order/limit-order-service';
import { conditionEngine, MarketSnapshot } from '@/lib/limit-order/condition-engine';
import { getSwapQuote, SOL_MINT } from '@/lib/trading/jupiter-quote';
import { getAudit } from '@/lib/market/enrichment/audit-worker';

const JUPITER_SEARCH = 'https://lite-api.jup.ag/tokens/v2/search';

/**
 * GET /api/v1/limit-orders/:orderId/conditions?currentPrice=...&walletAddress=...
 *
 * "Why isn't this executing?" -- the diagnostic report a user opens expecting
 * to see real, current safety telemetry for their order.
 *
 * ## What this replaced
 *
 * Every input to the evaluation was a constant, adjustable only via
 * `?mockLiquidity=` / `?mockExitability=` query parameters the UI never even
 * set: `liquidityUsd: 850000`, `exitabilityScore: 84`, `insiderRiskLevel:
 * 'Low'`, `organicVolumeRatio: 0.92`, `expectedPriceImpactPct: 0.8` -- for
 * every token, every order, every time -- while the modal's own copy read
 * "Evaluating real-time safety guardrails & market condition streams...".
 *
 * ## What is real now
 *
 * - `liquidityUsd` and `organicVolumeRatio` -- Jupiter's own figures for the
 *   order's token: aggregate liquidity, and the real ratio of organic to
 *   total buy+sell volume over the last 24h (its wash-trading filter, applied
 *   to the raw volume numbers rather than asserted as one opaque score).
 * - `expectedPriceImpactPct` -- a live Jupiter quote for the order's own
 *   size, the same route `/api/v1/trading/instant` uses for a real trade.
 * - `insiderRiskLevel` -- bucketed from Birdeye's holder-profile audit when
 *   it has been measured for this mint (the same source behind the Discover
 *   cards' audit pills); omitted otherwise.
 * - `exitabilityScore` -- there is no real signal for this anywhere in the
 *   platform, so it is never supplied. `conditionEngine` already treats a
 *   missing value as `UNKNOWN` and halts execution for safety on that
 *   condition when the order asked for it -- which is the correct behaviour
 *   for a telemetry gap, not something this route needs to paper over with a
 *   number nothing measured.
 */

interface JupiterAuditFields {
  liquidity?: number;
  stats24h?: {
    buyVolume?: number;
    sellVolume?: number;
    buyOrganicVolume?: number;
    sellOrganicVolume?: number;
  };
}

async function fetchJupiterMarket(mint: string): Promise<{ liquidityUsd?: number; organicVolumeRatio?: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(`${JUPITER_SEARCH}?query=${encodeURIComponent(mint)}`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return {};
    const body = await res.json();
    const list: JupiterAuditFields[] = Array.isArray(body) ? body : (body?.tokens ?? []);
    const token = (list as (JupiterAuditFields & { id?: string })[]).find((t) => t.id === mint) ?? list[0];
    if (!token) return {};

    const liquidityUsd = typeof token.liquidity === 'number' ? token.liquidity : undefined;

    const stats = token.stats24h;
    const totalVolume = (stats?.buyVolume ?? 0) + (stats?.sellVolume ?? 0);
    const organicVolume = (stats?.buyOrganicVolume ?? 0) + (stats?.sellOrganicVolume ?? 0);
    const organicVolumeRatio = totalVolume > 0 ? Math.min(1, organicVolume / totalVolume) : undefined;

    return { liquidityUsd, organicVolumeRatio };
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

/** Same bands used everywhere else this figure is shown -- see `AuditPills`. */
function insiderRiskLevel(insidersPct: number | null): MarketSnapshot['insiderRiskLevel'] {
  if (insidersPct === null) return undefined;
  if (insidersPct >= 30) return 'Critical';
  if (insidersPct >= 15) return 'High';
  if (insidersPct >= 5) return 'Medium';
  return 'Low';
}

export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params;
    const order = limitOrderService.getLimitOrder(orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Limit order not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);

    const walletAddress = searchParams.get('walletAddress');
    if (!walletAddress || order.userId !== walletAddress) {
      // Matches the ownership check on the order's own routes -- reported as
      // not-found rather than forbidden, so this cannot be used to confirm an
      // order id belongs to someone else.
      return NextResponse.json(
        { success: false, error: 'Limit order not found' },
        { status: 404 }
      );
    }

    // A price default is a fabrication: it silently prices a real decision
    // off a constant. 0.0425 was that constant here, identical for every
    // token. Absent now fails loudly instead.
    const currentPriceRaw = searchParams.get('currentPrice');
    const currentPrice = currentPriceRaw === null ? NaN : parseFloat(currentPriceRaw);
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      throw new ApiError('currentPrice is required to evaluate order conditions', 400);
    }

    const [market, quote] = await Promise.all([
      fetchJupiterMarket(order.tokenMint),
      // Best-effort: a token with no route (too new, no pool yet) throws, and
      // the impact condition then reports UNKNOWN rather than a made-up figure.
      getSwapQuote({
        inputMint: order.side === 'buy' ? SOL_MINT : order.tokenMint,
        outputMint: order.side === 'buy' ? order.tokenMint : SOL_MINT,
        amount: order.amountIn,
      }).catch(() => null),
    ]);

    const holderAudit = getAudit(order.tokenMint);

    const report = conditionEngine.evaluate(order, {
      currentPrice,
      liquidityUsd: market.liquidityUsd,
      // No real exitability signal exists anywhere in this platform -- left
      // undefined so a condition that asked for it reports UNKNOWN and halts,
      // rather than passing on a number nothing measured.
      exitabilityScore: undefined,
      insiderRiskLevel: insiderRiskLevel(holderAudit?.insidersPct ?? null),
      organicVolumeRatio: market.organicVolumeRatio,
      expectedPriceImpactPct: quote?.priceImpactPct ?? undefined,
    });

    return NextResponse.json({
      success: true,
      orderId,
      status: order.status,
      health: order.health,
      report
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to evaluate order conditions' },
      { status: 500 }
    );
  }
}
