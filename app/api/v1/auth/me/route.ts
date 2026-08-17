export const dynamic = 'force-dynamic';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { dbRepository } from '@/lib/db/repository';
import { serverStore } from '@/lib/server/store';
import { walletService } from '@/lib/auth/wallet-service';
import { ApiError } from '@/lib/server/errors';

export async function GET(request: Request) {
  try {
    const authUser = await requireAuth(request);
    const dbUser = dbRepository.getUser(authUser.userId) || (await serverStore.findUserById(authUser.userId));

    if (!dbUser) {
      throw new ApiError('User identity not found', 404, 'USER_NOT_FOUND');
    }

    const linkedWallets = await walletService.getUserWallets(dbUser.id);
    const primaryWallet = linkedWallets.find((w) => w.isPrimary) || linkedWallets[0] || null;
    const preferences = await serverStore.getUserPreferences(dbUser.id);

    return jsonResponse({
      user: {
        userId: dbUser.id,
        displayName: ('display_name' in dbUser ? dbUser.display_name : (dbUser as any).displayName) || 'Trader',
        email: dbUser.email || null,
        role: dbUser.role,
        status: dbUser.status,
        createdAt: ('created_at' in dbUser ? dbUser.created_at : (dbUser as any).createdAt),
      },
      primaryWallet,
      linkedWallets,
      preferences,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Unauthorized', 401));
  }
}
