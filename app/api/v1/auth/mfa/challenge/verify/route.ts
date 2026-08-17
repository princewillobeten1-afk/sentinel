import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { createAuthSession, getClientIp } from '@/lib/server/auth';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { mfaStore } from '@/lib/server/mfa-store';
import { mfaChallengeStore } from '@/lib/server/mfa-challenge-store';
import { verifyTotp, verifyAndConsumeBackupCode } from '@/lib/server/mfa';
import { sessionStore } from '@/lib/server/session-store';
import { serverStore } from '@/lib/server/store';
import { recordAuditEvent } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';

const verifySchema = z.object({
  mfaChallengeToken: z.string().min(1),
  code: z.string().min(6).max(64),
});

/**
 * POST /api/v1/auth/mfa/challenge/verify — completes a login that was
 * paused for MFA (see auth/verify and auth/login). No auth header expected
 * — the caller isn't authenticated yet, that's the whole point of this route.
 */
export async function POST(request: Request) {
  try {
    const payload = await parseJsonBody(request);
    const data = validateSchema(verifySchema, payload);

    checkRateLimit(`mfa_challenge_${data.mfaChallengeToken}`, 5, 5 * 60000);

    const challenge = mfaChallengeStore.peek(data.mfaChallengeToken);
    if (!challenge) {
      throw new ApiError('MFA challenge expired or invalid. Please log in again.', 400, 'MFA_CHALLENGE_INVALID');
    }

    const record = mfaStore.get(challenge.user.userId);
    if (!record.enabled || !record.secret) {
      // MFA was disabled between challenge creation and now — shouldn't normally happen, fail safe.
      throw new ApiError('MFA is no longer enabled on this account. Please log in again.', 400, 'MFA_NOT_ENABLED');
    }

    const totpValid = verifyTotp(record.secret, data.code);
    let usedBackupCode = false;

    if (!totpValid) {
      const backupResult = verifyAndConsumeBackupCode(record.backupCodeHashes, data.code);
      if (!backupResult.valid) {
        recordAuditEvent({
          userId: challenge.user.userId,
          action: 'MFA_CHALLENGE_FAILED',
          entityType: 'mfa',
          entityId: challenge.user.userId,
          ipAddress: getClientIp(request),
        });
        throw new ApiError('Incorrect code.', 401, 'MFA_CODE_INVALID');
      }
      mfaStore.consumeBackupCode(challenge.user.userId, backupResult.remaining);
      usedBackupCode = true;
    }

    mfaChallengeStore.consume(data.mfaChallengeToken);

    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent');
    const isNewDevice = !(await sessionStore.hasSeenDeviceBefore(challenge.user.userId, { ip, userAgent }));

    const { token } = await createAuthSession(challenge.user, { ip, userAgent }, undefined, true);

    if (usedBackupCode) {
      recordAuditEvent({ userId: challenge.user.userId, action: 'BACKUP_CODE_USED', entityType: 'mfa', entityId: challenge.user.userId });
    }
    recordAuditEvent({ userId: challenge.user.userId, action: 'AUTH_SUCCESS', entityType: 'user', entityId: challenge.user.userId, changes: { method: 'mfa_challenge' }, ipAddress: ip, userAgent });
    if (isNewDevice) {
      recordAuditEvent({ userId: challenge.user.userId, action: 'NEW_DEVICE_LOGIN', entityType: 'session', changes: { ip, userAgent }, ipAddress: ip, userAgent });
    }

    const userWallets = await serverStore.getUserWallets(challenge.user.userId);
    const primaryWallet = userWallets.find((w) => w.isPrimary) || userWallets[0] || null;
    const preferences = await serverStore.getUserPreferences(challenge.user.userId);

    const response = jsonResponse({
      token,
      user: {
        userId: challenge.user.userId,
        displayName: challenge.user.displayName,
        email: challenge.user.email,
        role: challenge.user.role,
      },
      primaryWallet,
      linkedWallets: userWallets,
      preferences,
    });

    response.headers.append(
      'Set-Cookie',
      `sentinel_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`,
    );

    return response;
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to verify MFA challenge', 500));
  }
}
