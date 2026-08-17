export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { optionalAuth, getClientIp } from '@/lib/server/auth';
import { walletService } from '@/lib/auth/wallet-service';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { ApiError } from '@/lib/server/errors';

const challengeRequestSchema = z.object({
  walletAddress: z.string().min(10, 'Invalid wallet address'),
  chainId: z.string().min(1, 'Chain ID is required'),
  statement: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const payload = await parseJsonBody(request);
    const data = validateSchema(challengeRequestSchema, payload);
    const ip = getClientIp(request);

    checkRateLimit(`wallet_req_${ip || data.walletAddress}`, 20, 60000);

    const authUser = await optionalAuth(request);

    const challenge = await walletService.createChallenge({
      walletAddress: data.walletAddress,
      chainId: data.chainId,
      userId: authUser?.userId || null,
      statement: data.statement,
    });

    return jsonResponse({
      challengeId: challenge.id,
      nonce: challenge.nonce,
      message: challenge.message,
      expiresAt: challenge.expiresAt,
      walletAddress: challenge.walletAddress,
      chainId: challenge.chainId,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to generate challenge', 400));
  }
}
