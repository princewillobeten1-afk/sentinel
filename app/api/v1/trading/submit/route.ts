import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { requireAuth } from '@/lib/server/auth';
import { recordAuditEvent } from '@/lib/server/audit';
import { ApiError } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

const submitSchema = z.object({
  preparedId: z.string().min(1),
  signedTransaction: z.string().min(1, 'Signed transaction signature is required'),
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const payload = await parseJsonBody(request);
    const data = validateSchema(submitSchema, payload);

    // Deliberately refuses rather than fabricating.
    //
    // This route accepted a signed transaction, discarded it, and answered:
    //
    //     txSignature: `8kL9_${Date.now()}_${Math.random()...}`
    //     status:      'confirmed'
    //     explorerUrl: https://solscan.io/tx/<that fabricated signature>
    //
    // Nothing was ever broadcast. It has no UI callers today, so the fake
    // confirmation was a landmine for whoever wired it up next rather than an
    // active defect — but a route that lies on success is worse than one that
    // is honestly unfinished.
    //
    // Completing it means broadcasting `signedTransaction` via the RPC's
    // `sendTransaction` and returning the signature the network assigns, then
    // confirming it. That is real money movement and is left unimplemented
    // rather than shipped unverified.
    recordAuditEvent({
      userId: user.userId,
      action: 'AUTH_SUCCESS',
      entityType: 'session',
      entityId: data.preparedId,
      changes: { action: 'TRADE_SUBMIT_REFUSED_NOT_IMPLEMENTED', preparedId: data.preparedId },
    });

    throw new ApiError(
      'Transaction submission is not implemented. The signed transaction was not broadcast, ' +
        'and no signature exists. Sign and send through your wallet instead.',
      501,
    );
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to submit signed transaction', 500));
  }
}
