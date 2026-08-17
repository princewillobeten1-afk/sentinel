import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import {
  getSentActivityData,
  getQuantActivityData,
  getBonkActivityData,
  getAlphaActivityData,
} from '@/lib/mocks/activity-mocks';
import { analyzeInsiderCandidates } from '@/lib/activity/insider-engine';
import { buildWalletProfile } from '@/lib/activity/pipeline';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { chain: string; address: string } },
) {
  try {
    const { chain, address } = params;

    if (chain !== 'solana') {
      throw new ApiError(`Unsupported chain: ${chain}`, 400, 'UNSUPPORTED_CHAIN');
    }

    if (!address) {
      throw new ApiError('Wallet address is required', 400, 'INVALID_ADDRESS');
    }

    // Search across mock token contexts for matching trades/participants
    const datasets = [
      getAlphaActivityData(),
      getQuantActivityData(),
      getSentActivityData(),
      getBonkActivityData(),
    ];

    let matchedData = datasets.find((d) => d.trades.some((t) => t.wallet === address));
    if (!matchedData) {
      // Default to ALPHA dataset context to render demo wallet profile if arbitrary address passed
      matchedData = getAlphaActivityData();
    }

    const currentPositionsUsd = 'currentPositionsUsd' in matchedData ? (matchedData.currentPositionsUsd as Record<string, number>) : undefined;
    const realizedPnlUsd = 'realizedPnlUsd' in matchedData ? (matchedData.realizedPnlUsd as Record<string, number>) : undefined;
    const unrealizedPnlUsd = 'unrealizedPnlUsd' in matchedData ? (matchedData.unrealizedPnlUsd as Record<string, number>) : undefined;

    const insiderReport = analyzeInsiderCandidates({
      trades: matchedData.trades,
      context: matchedData.context,
      currentPositionsUsd,
      realizedPnlUsd,
      unrealizedPnlUsd,
    });

    const walletProfile = buildWalletProfile(
      address,
      chain,
      matchedData.trades,
      matchedData.context,
      insiderReport,
    );

    return jsonResponse({
      address,
      chain,
      profile: walletProfile,
      insiderCandidate: insiderReport.candidates.find((candidate) => candidate.wallet === address),
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new ApiError('Failed to fetch wallet detail profile', 500),
    );
  }
}
