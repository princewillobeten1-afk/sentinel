export const dynamic = 'force-dynamic';

import { checkReadiness } from '@/lib/server/nfr/health';
import { defaultRpcPool } from '@/lib/blockchain/rpc-provider';
import { queueService } from '@/lib/queue/queue-service';
import { jsonResponse } from '@/lib/server/api';

export async function GET() {
  const readiness = await checkReadiness();
  const rpcMetrics = defaultRpcPool.getMetrics();
  const queueDepths = queueService.getQueueDepth();

  const rpcHealthy = rpcMetrics.length === 0 || rpcMetrics.some((p) => p.status === 'HEALTHY' || p.status === 'DEGRADED');
  const isReady = readiness.ready && rpcHealthy;

  return jsonResponse(
    {
      status: isReady ? 'ready' : 'not_ready',
      ...readiness,
      rpcHealthy,
      queueDepths,
      timestamp: new Date().toISOString(),
    },
    isReady ? 200 : 503
  );
}
