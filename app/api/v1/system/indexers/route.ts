export const dynamic = 'force-dynamic';

import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { indexerCursorManager } from '@/lib/indexer/cursor';
import { defaultRpcPool } from '@/lib/blockchain/rpc-provider';
import { reorgDetector } from '@/lib/indexer/reorg';
import { queueService } from '@/lib/queue/queue-service';

/**
 * GET /api/v1/system/indexers — internal indexer monitoring endpoint (Sprint 44 §52-53).
 *
 * Returns sync status, block lag, time lag, RPC status, and reorg history.
 */
export async function GET() {
  try {
    const states = await indexerCursorManager.getAllStates();
    const rpcMetrics = defaultRpcPool.getMetrics();
    const queueDepths = queueService.getQueueDepth();
    const reorgs = reorgDetector.getReorgHistory();

    const indexers = states.map((state) => {
      const chainRpc = rpcMetrics.filter((p) => p.chainId === state.chainId);
      return {
        chain: state.chainId,
        currentBlock: state.currentBlock,
        targetBlock: state.targetBlock,
        lag: {
          blockLag: state.lagBlocks,
          timeLagSeconds: state.lagSeconds,
        },
        status: state.status,
        syncMode: state.syncMode,
        lastSuccess: new Date(state.lastSuccessfulSync).toISOString(),
        lastError: state.lastError || null,
        rpcProviders: chainRpc.map((r) => ({
          providerId: r.providerId,
          latencyMs: r.latencyMs,
          status: r.status,
          successRate:
            r.totalRequests > 0
              ? `${Math.round((r.successfulRequests / r.totalRequests) * 100)}%`
              : '100%',
        })),
      };
    });

    return jsonResponse({
      indexers,
      reorgsCount: reorgs.length,
      recentReorgs: reorgs.slice(-5),
      queueDepths,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new ApiError('Failed to fetch indexer metrics', 500)
    );
  }
}
