import { jsonResponse } from '@/lib/server/api';
import { withApiGateway } from '@/lib/server/api-gateway';
import { getPortfolioForWallet, PRIVATE_RESPONSE_HEADERS } from '@/lib/portfolio/service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/portfolio/:wallet
 *
 * Portfolio overview (spec §3, §45): total value, estimated exit value, risk,
 * P&L and the "what changed" signal in one near-instant read.
 *
 * Sprint 28: rewired through the API gateway. `allowSessionAuth: true` keeps
 * the web app's own dashboard calls working exactly as before (session
 * cookie/JWT); a `sk_live_.../sk_sandbox_...` API key with `READ_PORTFOLIO`
 * works identically. Either way, `getPortfolioForWallet`'s wallet-ownership
 * check (`isWalletAuthorized` in `lib/portfolio/wallet-groups.ts`) runs
 * exactly as it did before — the gateway only changes *how* `user` gets
 * resolved, never what happens after.
 */
export const GET = withApiGateway(
  async (ctx, request, params) => {
    const result = await getPortfolioForWallet({ user: ctx.user, wallet: params.wallet, request });

    return jsonResponse(
      {
        overview: result.overview,
        changes: result.changes.slice(0, 10),
        reconciliation: {
          acceptedEvents: result.reconciliation.acceptedEvents,
          rejectedEvents: result.reconciliation.rejectedEvents,
          duplicateEvents: result.reconciliation.duplicateEvents,
          pendingEvents: result.reconciliation.pendingEvents,
        },
        limitations: result.limitations,
      },
      200,
      PRIVATE_RESPONSE_HEADERS,
    );
  },
  { scopes: ['READ_PORTFOLIO'], allowSessionAuth: true },
);
