import { POST as submit } from '@/app/api/v1/trading/submit/route';
import { errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const body = await request.json();
    const forwarded = new Request(request.url, { method: 'POST', headers: request.headers,
      body: JSON.stringify({ preparedId: context.params.id, signedTransaction: body.signedTransaction ?? body.signedPayload, idempotencyKey: body.idempotencyKey }) });
    return submit(forwarded, { params: {} });
  } catch { return errorResponse(new ApiError('Invalid prepared swap submission.', 400)); }
}
