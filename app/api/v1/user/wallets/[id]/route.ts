export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { serverStore } from '@/lib/server/store';
import { ApiError } from '@/lib/server/errors';

const updateWalletSchema = z.object({
  label: z.string().min(1).max(50).optional(),
  isPrimary: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await requireAuth(request);
    const walletId = params.id;
    const payload = await parseJsonBody(request);
    const data = validateSchema(updateWalletSchema, payload);

    const updatedWallet = await serverStore.updateWallet(walletId, authUser.userId, data);
    const allWallets = await serverStore.getUserWallets(authUser.userId);

    return jsonResponse({
      wallet: updatedWallet,
      wallets: allWallets,
      message: 'Wallet settings updated.',
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to update wallet', 500));
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await requireAuth(request);
    const walletId = params.id;

    await serverStore.unlinkWallet(walletId, authUser.userId);
    const remainingWallets = await serverStore.getUserWallets(authUser.userId);

    return jsonResponse({
      wallets: remainingWallets,
      message: 'Wallet unlinked from account.',
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to unlink wallet', 500));
  }
}
