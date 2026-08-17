export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { generateAuthNonce } from '@/lib/server/crypto-auth';
import { serverStore } from '@/lib/server/store';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { ApiError } from '@/lib/server/errors';

const challengeSchema = z.object({
  publicKey: z.string().min(20, 'Invalid Solana public key').max(64),
  network: z.string().optional().default('solana:mainnet'),
});

export async function POST(request: Request) {
  try {
    const payload = await parseJsonBody(request);
    const data = validateSchema(challengeSchema, payload);

    checkRateLimit(`challenge_${data.publicKey}`, 10, 60000);

    const nonce = generateAuthNonce(16);
    const domain = request.headers.get('host') || 'sentinel.app';
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); // 10 mins
    const statement = 'Sign in to Sentinel Trading & Intelligence Platform to verify wallet ownership.';

    const challenge = await serverStore.saveChallenge(data.publicKey, nonce, statement, expiresAt);

    const formattedMessage = [
      `${domain} wants you to sign in with your Solana account:`,
      data.publicKey,
      '',
      statement,
      '',
      `URI: https://${domain}`,
      `Version: 1`,
      `Chain ID: ${data.network}`,
      `Nonce: ${nonce}`,
      `Issued At: ${now.toISOString()}`,
      `Expiration Time: ${expiresAt}`,
    ].join('\n');

    return jsonResponse({
      challenge: {
        id: challenge.id,
        nonce,
        statement,
        address: data.publicKey,
        expiresAt,
        domain,
        issuedAt: now.toISOString(),
        chainId: data.network,
        formattedMessage,
      },
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to generate auth challenge', 500));
  }
}
