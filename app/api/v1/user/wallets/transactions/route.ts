import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { serverStore } from '@/lib/server/store';
import { recordAuditEvent } from '@/lib/server/audit';
import { killSwitch } from '@/lib/server/kill-switch';
import { ApiError } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

const recordTransferSchema = z.object({
  walletId: z.string().min(1),
  direction: z.literal('SEND'),
  asset: z.enum(['SOL', 'USDC']),
  amount: z.number().positive(),
  destinationAddress: z.string().min(32).max(44),
  signature: z.string().min(64),
  network: z.string().min(1),
  feeLamports: z.number().nonnegative().optional(),
});

/**
 * POST /api/v1/user/wallets/transactions — records a self-custodial
 * transfer **after** the user's own wallet has already signed, broadcast,
 * and confirmed it. This route never constructs, signs, or broadcasts
 * anything — it's an audit trail only. See
 * docs/security/threat-model.md's "Wallet transfers" section.
 */
export async function POST(request: Request) {
  try {
    const authUser = await requireAuth(request);

    if (killSwitch.isPaused('WALLET_TRANSFERS')) {
      throw new ApiError('Wallet transfers are temporarily paused.', 423, 'WALLET_TRANSFERS_PAUSED');
    }

    const payload = await parseJsonBody(request);
    const data = validateSchema(recordTransferSchema, payload);

    const userWallets = await serverStore.getUserWallets(authUser.userId);
    const wallet = userWallets.find((w) => w.id === data.walletId);
    if (!wallet) {
      throw new ApiError('Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const record = await serverStore.recordWalletTransaction(authUser.userId, {
      walletId: data.walletId,
      direction: data.direction,
      asset: data.asset,
      amount: data.amount,
      destinationAddress: data.destinationAddress,
      signature: data.signature,
      network: data.network,
      feeLamports: data.feeLamports,
    });

    recordAuditEvent({
      userId: authUser.userId,
      action: 'WALLET_WITHDRAWAL_RECORDED',
      entityType: 'wallet',
      entityId: wallet.id,
      changes: {
        asset: data.asset,
        amount: data.amount,
        destinationAddress: data.destinationAddress,
        signature: data.signature,
        network: data.network,
      },
    });

    return jsonResponse({ transaction: record });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to record transaction', 500));
  }
}

/** GET /api/v1/user/wallets/transactions?walletId= — the caller's own transfer history, ownership-checked via requireAuth. */
export async function GET(request: Request) {
  try {
    const authUser = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const walletId = searchParams.get('walletId') ?? undefined;
    return jsonResponse({ transactions: await serverStore.getWalletTransactions(authUser.userId, walletId) });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load transaction history', 500));
  }
}
