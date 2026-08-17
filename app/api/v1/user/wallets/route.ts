import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { verifyEd25519Signature } from '@/lib/server/crypto-auth';
import { serverStore } from '@/lib/server/store';
import { ApiError } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

const linkWalletSchema = z.object({
  publicKey: z.string().min(20, 'Invalid Solana public key'),
  signature: z.string().min(1, 'Signature is required'),
  nonce: z.string().min(1, 'Nonce is required'),
  message: z.string().min(1, 'Signed message is required'),
  label: z.string().optional().default('Secondary Wallet'),
});

export async function GET(request: Request) {
  try {
    const authUser = await requireAuth(request);
    const wallets = await serverStore.getUserWallets(authUser.userId);
    return jsonResponse({ wallets });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch wallets', 500));
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await requireAuth(request);
    const payload = await parseJsonBody(request);
    const data = validateSchema(linkWalletSchema, payload);

    // Verify challenge nonce
    const challenge = await serverStore.getChallengeByNonce(data.nonce);
    if (!challenge) {
      throw new ApiError('Authentication challenge expired or invalid', 400, 'AUTH_CHALLENGE_EXPIRED');
    }

    if (challenge.address.toLowerCase() !== data.publicKey.toLowerCase()) {
      throw new ApiError('Challenge public key mismatch', 400, 'AUTH_KEY_MISMATCH');
    }

    // Verify Ed25519 signature of the secondary wallet
    const isValidSig = verifyEd25519Signature(data.publicKey, data.message, data.signature);
    if (!isValidSig) {
      throw new ApiError('Invalid cryptographic wallet signature', 401, 'AUTH_INVALID_SIGNATURE');
    }

    await serverStore.consumeChallenge(data.nonce);

    // Link wallet to authenticated user account
    const wallet = await serverStore.addWalletToUser(authUser.userId, data.publicKey, data.label);
    const userWallets = await serverStore.getUserWallets(authUser.userId);

    return jsonResponse({
      wallet,
      wallets: userWallets,
      message: `Wallet ${data.publicKey.slice(0, 4)}...${data.publicKey.slice(-4)} successfully linked.`,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to link wallet', 500));
  }
}
