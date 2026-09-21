import { ApiError } from '@/lib/server/errors';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { limitOrderService } from '@/lib/limit-order/limit-order-service';

/** Wrapped SOL -- every order on this platform is quoted against it. */
const SOL_MINT = 'So11111111111111111111111111111111111111112';

/**
 * GET /api/v1/limit-orders?walletAddress=...&currentPrice=...&mint=...
 *
 * ## What this replaced
 *
 * `userId` defaulted to the literal string `'user_default'` when the caller
 * didn't supply one -- and the frontend never did. Every visitor to this site
 * shared one order book: anyone could see, and (via the sibling `DELETE`
 * route) cancel, anyone else's limit orders. `walletAddress` is now required
 * and used as the identity directly, matching how positions are already
 * scoped (`/api/v1/portfolio/:wallet/positions`).
 *
 * `mint` is new: without it, a caller evaluating "distance to target" against
 * one token's `currentPrice` would get that comparison applied to every order
 * across every token the wallet holds, which is meaningless for anything but
 * the token actually being priced.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get('walletAddress');
    if (!walletAddress) {
      throw new ApiError('walletAddress is required', 400);
    }

    // A price default is a fabrication: it silently prices a real decision
    // off a constant. 0.0425 was that constant here, identical for every
    // token. Absent now fails loudly instead.
    const currentPriceRaw = searchParams.get('currentPrice');
    const currentPrice = currentPriceRaw === null ? NaN : parseFloat(currentPriceRaw);
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      throw new ApiError('currentPrice is required to evaluate limit orders', 400);
    }

    const mint = searchParams.get('mint') ?? undefined;

    const orders = limitOrderService.getUserLimitOrders(walletAddress, currentPrice, mint);

    return NextResponse.json({
      success: true,
      orders
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch limit orders' },
      { status: error instanceof ApiError ? error.statusCode : 500 }
    );
  }
}

/**
 * POST /api/v1/limit-orders
 *
 * ## What this replaced
 *
 * - `userId` defaulted to `'user_default'` -- see the GET handler above.
 * - `tokenOut` defaulted to the literal string `'SENT'`, a token that does
 *   not exist on-chain. Every limit order ever created from any token's trade
 *   page was silently recorded against that fake symbol, with no mint address
 *   anywhere in the record -- there was no way to tell which real token an
 *   order was actually for.
 * - Wallet balance had no field to arrive in at all, so
 *   `LimitOrderService.createLimitOrder` always fell through to a hardcoded
 *   42.85 SOL default and reserved every order against a balance nobody had.
 *
 * `walletAddress`, `tokenMint` and `actualWalletBalance` are now required.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      walletAddress,
      tokenMint,
      // Sent by the client for its own display purposes; nothing server-side
      // needs it, since tokenIn/tokenOut below store the real mints.
      chainId = 'solana',
      side = 'buy',
      targetPrice,
      amountIn,
      actualWalletBalance,
      slippageBps = 100,
      conditions,
      expiresAt
    } = body;

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'walletAddress is required' },
        { status: 400 }
      );
    }
    if (!tokenMint || typeof tokenMint !== 'string' || tokenMint.length < 32) {
      return NextResponse.json(
        { success: false, error: 'A valid tokenMint is required' },
        { status: 400 }
      );
    }
    if (!targetPrice || !amountIn) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: targetPrice and amountIn' },
        { status: 400 }
      );
    }
    if (typeof actualWalletBalance !== 'number' || !Number.isFinite(actualWalletBalance)) {
      return NextResponse.json(
        { success: false, error: 'actualWalletBalance is required to size this order against a real balance' },
        { status: 400 }
      );
    }

    // tokenIn/tokenOut are the swap-pair mints implied by side -- a buy pays
    // SOL for the token, a sell pays the token for SOL. Every order on this
    // platform is against SOL; there is no other quote asset in the UI that
    // creates these.
    const tokenIn = side === 'buy' ? SOL_MINT : tokenMint;
    const tokenOut = side === 'buy' ? tokenMint : SOL_MINT;

    const result = limitOrderService.createLimitOrder({
      userId: walletAddress,
      walletId: walletAddress,
      chainId,
      tokenIn,
      tokenOut,
      tokenMint,
      side,
      targetPrice: parseFloat(targetPrice),
      amountIn: parseFloat(amountIn),
      actualWalletBalance,
      slippageBps: parseInt(slippageBps, 10),
      conditions,
      expiresAt
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      order: result.order
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create limit order' },
      { status: 500 }
    );
  }
}
