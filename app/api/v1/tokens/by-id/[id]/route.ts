import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { tokenDiscoveryPipeline } from '@/lib/market-data/discovery/token-discovery-pipeline';
import { snapshotEngine } from '@/lib/market-data/snapshots/snapshot-engine';
import { marketDataQualityService } from '@/lib/market-data/quality/quality-service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/tokens/:id — get full token profile, identity, and verification status */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = tokenDiscoveryPipeline.getToken(id);
    const snapshot = snapshotEngine.getTokenSnapshot(id);
    const quality = marketDataQualityService.evaluateTokenQuality(id);

    return jsonResponse({
      tokenId: id,
      symbol: token?.symbol || snapshot.symbol || 'TOKEN',
      name: token?.name || snapshot.name || 'Token',
      chainId: token?.chainId || 'solana',
      decimals: token?.decimals || 9,
      status: token?.status || 'DISCOVERED', // VERIFIED / ACTIVE / SUSPICIOUS
      verifiedStatus: token?.status === 'ACTIVE' ? 'VERIFIED' : (token?.status === 'SUSPICIOUS' ? 'SUSPICIOUS' : 'UNVERIFIED'),
      logoUrl: token?.logoUrl || null,
      description: token?.description || null,
      websiteUrl: token?.websiteUrl || null,
      twitterHandle: token?.twitterHandle || null,
      supply: token?.supply || null,
      snapshot,
      quality,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch token profile', 500));
  }
}
