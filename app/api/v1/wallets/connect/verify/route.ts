export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { optionalAuth, getClientIp } from '@/lib/server/auth';
import { walletService } from '@/lib/auth/wallet-service';
import { ApiError } from '@/lib/server/errors';

const verifyChallengeSchema = z.object({
  challengeId: z.string().min(1, 'Challenge ID is required'),
  signature: z.string().min(1, 'Signature is required'),
  label: z.string().max(50).optional(),
});

export async function POST(request: Request) {
  try {
    const payload = await parseJsonBody(request);
    const data = validateSchema(verifyChallengeSchema, payload);
    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent');

    const authUser = await optionalAuth(request);

    if (authUser) {
      // User is already logged in — link wallet to their account
      const result = await walletService.verifyAndLinkWallet({
        userId: authUser.userId,
        challengeId: data.challengeId,
        signature: data.signature,
        label: data.label,
      });

      return jsonResponse({
        success: true,
        mode: 'LINKED',
        wallet: result.wallet,
        verificationId: result.verificationId,
      });
    }

    // User is unauthenticated — authenticate / login via wallet
    const authResult = await walletService.authenticateWithWallet({
      challengeId: data.challengeId,
      signature: data.signature,
      ip,
      userAgent,
    });

    const response = jsonResponse({
      success: true,
      mode: 'AUTHENTICATED',
      user: authResult.user,
      wallet: authResult.wallet,
      session: authResult.session,
      token: authResult.token,
    });

    response.headers.append(
      'Set-Cookie',
      `sentinel_session=${encodeURIComponent(authResult.token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
    );

    return response;
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Wallet verification failed', 400));
  }
}
