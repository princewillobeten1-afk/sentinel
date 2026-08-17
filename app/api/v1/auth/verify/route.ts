export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { verifyEd25519Signature } from '@/lib/server/crypto-auth';
import { serverStore } from '@/lib/server/store';
import { createAuthSession, getClientIp, AuthUser } from '@/lib/server/auth';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { ApiError } from '@/lib/server/errors';
import { mfaStore } from '@/lib/server/mfa-store';
import { mfaChallengeStore } from '@/lib/server/mfa-challenge-store';
import { sessionStore } from '@/lib/server/session-store';
import { recordAuditEvent } from '@/lib/server/audit';

const verifySchema = z.object({
  publicKey: z.string().min(20, 'Invalid Solana public key').max(64),
  signature: z.string().min(1, 'Signature is required'),
  nonce: z.string().min(1, 'Nonce is required'),
  message: z.string().min(1, 'Signed message is required'),
  label: z.string().optional().default('Solana Wallet'),
});

export async function POST(request: Request) {
  try {
    const payload = await parseJsonBody(request);
    const data = validateSchema(verifySchema, payload);

    checkRateLimit(`verify_${data.publicKey}`, 10, 60000);

    // Retrieve and validate challenge nonce
    const challenge = await serverStore.getChallengeByNonce(data.nonce);
    if (!challenge) {
      throw new ApiError('Authentication challenge expired or invalid', 400, 'AUTH_CHALLENGE_EXPIRED');
    }

    if (challenge.address.toLowerCase() !== data.publicKey.toLowerCase()) {
      throw new ApiError('Challenge public key mismatch', 400, 'AUTH_KEY_MISMATCH');
    }

    // Verify Ed25519 signature
    const isValidSig = verifyEd25519Signature(data.publicKey, data.message, data.signature);
    if (!isValidSig) {
      throw new ApiError('Invalid cryptographic wallet signature', 401, 'AUTH_INVALID_SIGNATURE');
    }

    // Consume challenge nonce to prevent replay attacks
    await serverStore.consumeChallenge(data.nonce);

    // Look up or create user identity
    let wallet = await serverStore.findWalletByAddress(data.publicKey);
    let user;

    if (wallet) {
      user = await serverStore.findUserById(wallet.userId);
      if (!user) {
        throw new ApiError('User account missing for wallet', 500, 'USER_ACCOUNT_MISSING');
      }
    } else {
      const created = await serverStore.createUserWithWallet(data.publicKey, data.label);
      user = created.user;
      wallet = created.wallet;
    }

    const authUser: AuthUser = {
      userId: user.id,
      email: user.email || undefined,
      role: user.role,
      displayName: user.displayName,
      primaryWalletAddress: data.publicKey,
    };

    // MFA-enabled accounts don't get a real session yet — a short-lived challenge
    // stands in until the caller proves possession of the second factor.
    if (mfaStore.isEnabled(user.id)) {
      const challenge = mfaChallengeStore.create(authUser);
      recordAuditEvent({
        userId: user.id,
        action: 'AUTH_SUCCESS',
        entityType: 'user',
        entityId: user.id,
        changes: { method: 'SIWS', mfaRequired: true },
        ipAddress: getClientIp(request),
        userAgent: request.headers.get('user-agent'),
      });
      return jsonResponse({ mfaRequired: true, mfaChallengeToken: challenge.id });
    }

    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent');
    const isNewDevice = !(await sessionStore.hasSeenDeviceBefore(user.id, { ip, userAgent }));

    const { token } = await createAuthSession(authUser, { ip, userAgent });
    const userWallets = await serverStore.getUserWallets(user.id);
    const primaryWallet = userWallets.find((w) => w.isPrimary) || userWallets[0] || wallet;
    const preferences = await serverStore.getUserPreferences(user.id);

    recordAuditEvent({
      userId: user.id,
      action: 'AUTH_SUCCESS',
      entityType: 'user',
      entityId: user.id,
      changes: { method: 'SIWS' },
      ipAddress: ip,
      userAgent,
    });
    if (isNewDevice) {
      recordAuditEvent({
        userId: user.id,
        action: 'NEW_DEVICE_LOGIN',
        entityType: 'session',
        changes: { ip, userAgent },
        ipAddress: ip,
        userAgent,
      });
    }

    const response = jsonResponse({
      token,
      user: {
        userId: user.id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      primaryWallet,
      linkedWallets: userWallets,
      preferences,
    });

    // Set HTTP-only session cookie
    response.headers.append(
      'Set-Cookie',
      `sentinel_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
    );

    return response;
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Verification failed', 500));
  }
}
