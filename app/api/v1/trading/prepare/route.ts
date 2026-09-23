import { z } from 'zod';
import { PublicKey } from '@solana/web3.js';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { withApiGateway } from '@/lib/server/api-gateway';
import { ApiError } from '@/lib/server/errors';
import { prepareSolanaSwap } from '@/lib/trading/solana-swap-service';
import { checkRateLimit } from '@/lib/server/rate-limit';

export const dynamic = 'force-dynamic';
const address = z.string().refine(value => { try { return new PublicKey(value).toBase58() === value; } catch { return false; } }, 'Invalid Solana address');
const schema = z.object({
  quoteId: z.string().min(1).max(200), inputToken: address, outputToken: address,
  amount: z.string().max(50).regex(/^\d+(\.\d+)?$/), slippage: z.number().min(0.01).max(15),
  walletAddress: address, minimumOutputRaw: z.string().max(30).regex(/^[1-9]\d*$/),
  idempotencyKey: z.string().min(8).max(200),
});
export const POST = withApiGateway(async (ctx, request) => {
  try {
    if (ctx.apiKey?.environment === 'sandbox') throw new ApiError('Sandbox keys cannot prepare mainnet swaps.', 403, 'SANDBOX_TRADING_DISABLED');
    checkRateLimit(`swap-prepare:${ctx.user.userId}`, 10, 60_000);
    const input = validateSchema(schema, await parseJsonBody(request));
    const swap = await prepareSolanaSwap(ctx.user.userId, input);
    return jsonResponse({ preparedTransaction: {
      id: swap.id, wallet: swap.wallet, network: swap.network, status: swap.status,
      unsignedTxBase64: swap.unsigned_tx, lastValidBlockHeight: swap.last_valid_block_height,
      expiresAt: swap.expires_at, feeLamports: swap.fee_lamports,
      quote: swap.quote, simulation: { success: true, source: 'solana-rpc' },
    } });
  } catch (error) {
    return errorResponse(error instanceof ApiError ? error : new ApiError('Swap preparation is unavailable. Check the provider and trading database configuration.', 503, 'PREPARE_UNAVAILABLE'));
  }
}, { scopes: ['TRADE'], allowSessionAuth: true });
