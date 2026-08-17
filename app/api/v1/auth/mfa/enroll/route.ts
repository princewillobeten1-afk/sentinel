import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { requireAuth } from '@/lib/server/auth';
import { mfaStore } from '@/lib/server/mfa-store';
import { generateTotpSecret, buildOtpauthUri, generateBackupCodes, hashBackupCode } from '@/lib/server/mfa';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/auth/mfa/enroll — starts TOTP enrollment. Returns the secret,
 * an otpauth:// URI (QR-code-able), and backup codes — all shown exactly
 * once, matching the API-key "shown once" convention. Enrollment isn't
 * active until confirmed with a real code via /enroll/confirm.
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);

    if (mfaStore.isEnabled(user.userId)) {
      throw new ApiError('MFA is already enabled on this account.', 409, 'MFA_ALREADY_ENABLED');
    }

    const secret = generateTotpSecret();
    const backupCodes = generateBackupCodes();
    mfaStore.setPendingSecret(user.userId, secret, backupCodes.map(hashBackupCode));

    const otpauthUri = buildOtpauthUri(secret, user.email ?? user.userId);

    return jsonResponse({
      secret,
      otpauthUri,
      backupCodes,
      notice: 'Store these now — the secret and backup codes are shown only once. Confirm enrollment with a live code from your authenticator app.',
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to start MFA enrollment', 500));
  }
}
