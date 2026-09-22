import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { requireAuth } from '@/lib/server/auth';
import { recordAuditEvent } from '@/lib/server/audit';
import { ApiError } from '@/lib/server/errors';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import { env } from '@/lib/server/env';

export const dynamic = 'force-dynamic';

const submitSchema = z.object({
  preparedId: z.string().min(1),
  signedTransaction: z.string().min(1, 'Signed serialized transaction is required'),
  idempotencyKey: z.string().min(8).max(200),
});

const submitted = new Map<string, { txSignature: string; explorerUrl: string }>();

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const payload = await parseJsonBody(request);
    const data = validateSchema(submitSchema, payload);

    const previous = submitted.get(data.idempotencyKey);
    if (previous) return jsonResponse({ status: 'confirmed', ...previous });

    if (!env.HELIUS_RPC_URL) {
      throw new ApiError('HELIUS_RPC_URL is not configured; transaction was not broadcast.', 503, 'TRADING_NOT_CONFIGURED');
    }

    let rawTransaction: Buffer;
    try {
      rawTransaction = Buffer.from(data.signedTransaction, 'base64');
      if (!rawTransaction.length) throw new Error('empty transaction');
      VersionedTransaction.deserialize(rawTransaction);
    } catch {
      throw new ApiError('Signed transaction payload is invalid.', 400, 'INVALID_SIGNED_TRANSACTION');
    }

    const connection = new Connection(env.HELIUS_RPC_URL, 'confirmed');
    const txSignature = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: false,
      maxRetries: 3,
    });
    const confirmation = await connection.confirmTransaction(txSignature, 'confirmed');
    if (confirmation.value.err) {
      throw new ApiError('The network rejected the transaction.', 422, 'TRANSACTION_FAILED', {
        txSignature,
        error: confirmation.value.err,
      });
    }

    const receipt = {
      txSignature,
      explorerUrl: `https://solscan.io/tx/${txSignature}`,
    };
    submitted.set(data.idempotencyKey, receipt);
    recordAuditEvent({
      userId: user.userId,
      action: 'TRADE_SUBMITTED',
      entityType: 'transaction',
      entityId: data.preparedId,
      changes: { txSignature, preparedId: data.preparedId },
    });
    return jsonResponse({ status: 'confirmed', ...receipt });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to submit signed transaction', 500));
  }
}
