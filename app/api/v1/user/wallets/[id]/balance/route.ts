import { jsonResponse, errorResponse } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { serverStore } from '@/lib/server/store';
import { ApiError } from '@/lib/server/errors';
import { getWalletBalance } from '@/lib/wallet/balance';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/user/wallets/:id/balance — real SOL + USDC balance for one of
 * the caller's own linked wallets (devnet-first, see
 * docs/security/threat-model.md's "Wallet transfers" section). Read-only —
 * no signing, no fund movement, self-custodial.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const authUser = await requireAuth(request);
    const userWallets = await serverStore.getUserWallets(authUser.userId);
    const wallet = userWallets.find((w) => w.id === params.id);
    if (!wallet) {
      throw new ApiError('Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    // No kill-switch check here, deliberately — balance reads are harmless
    // and stay available even when WALLET_TRANSFERS is paused; the pause
    // only gates the Send flow (see app/api/v1/user/wallets/transactions/route.ts).
    let balance;
    try {
      balance = await getWalletBalance(wallet.address);
    } catch (err) {
      throw new ApiError(
        err instanceof Error && err.message.includes('Invalid public key')
          ? 'This wallet does not have a valid Solana address.'
          : 'Failed to read balance from the network.',
        502,
        'BALANCE_READ_FAILED',
      );
    }

    return jsonResponse({ balance });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch wallet balance', 500));
  }
}
