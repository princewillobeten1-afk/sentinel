export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { dbRepository } from '@/lib/db/repository';
import { identityStore } from '@/lib/auth/identity-store';
import { serverStore } from '@/lib/server/store';
import { authService } from '@/lib/auth/auth-service';
import { walletService } from '@/lib/auth/wallet-service';
import { ApiError } from '@/lib/server/errors';

const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  avatarUrl: z.string().url().max(512).optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const authUser = await requireAuth(request);
    const dbUser = dbRepository.getUser(authUser.userId) || (await serverStore.findUserById(authUser.userId));

    if (!dbUser) {
      throw new ApiError('User identity not found', 404, 'USER_NOT_FOUND');
    }

    const linkedWallets = await walletService.getUserWallets(dbUser.id);
    const primaryWallet = linkedWallets.find((w) => w.isPrimary) || linkedWallets[0] || null;

    return jsonResponse({
      user: {
        id: dbUser.id,
        email: dbUser.email || null,
        displayName: ('display_name' in dbUser ? dbUser.display_name : (dbUser as any).displayName) || 'Trader',
        avatarUrl: ('avatar_url' in dbUser ? dbUser.avatar_url : null),
        emailVerifiedAt: ('email_verified_at' in dbUser ? dbUser.email_verified_at : null),
        role: dbUser.role,
        status: dbUser.status,
        createdAt: ('created_at' in dbUser ? dbUser.created_at : (dbUser as any).createdAt),
      },
      primaryWallet,
      linkedWallets,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Unauthorized', 401));
  }
}

export async function PATCH(request: Request) {
  try {
    const authUser = await requireAuth(request);
    const payload = await parseJsonBody(request);
    const data = validateSchema(updateProfileSchema, payload);

    const dbUser = await identityStore.getUser(authUser.userId);
    if (!dbUser) {
      throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
    }

    const now = new Date().toISOString();
    if (data.displayName !== undefined) {
      // Only `display_name` — `users.username` is UNIQUE (migration 013), so
      // mirroring a display name into it made two users with the same display
      // name a hard database error. See auth-service.ts's register().
      dbUser.display_name = data.displayName;
    }
    if (data.avatarUrl !== undefined) {
      dbUser.avatar_url = data.avatarUrl || undefined;
    }
    dbUser.updated_at = now;
    await identityStore.saveUser(dbUser);

    return jsonResponse({
      user: {
        id: dbUser.id,
        email: dbUser.email,
        displayName: dbUser.display_name,
        avatarUrl: dbUser.avatar_url,
        role: dbUser.role,
        status: dbUser.status,
        updatedAt: dbUser.updated_at,
      },
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to update profile', 400));
  }
}

export async function DELETE(request: Request) {
  try {
    const authUser = await requireAuth(request);
    await authService.deleteAccount(authUser.userId);

    const response = jsonResponse({
      success: true,
      message: 'Account successfully deactivated and closed.',
    });

    response.headers.append(
      'Set-Cookie',
      'sentinel_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
    );

    return response;
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to close account', 400));
  }
}
