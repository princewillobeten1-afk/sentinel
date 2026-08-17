import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

const mockTradingOps = {
  activeOrdersCount: 4210,
  tradesProcessed24h: 421802,
  averageExecutionLatencyMs: 142,
  averageRealizedSlippagePct: 0.14,
  failedTransactionsCount24h: 38,
  failedRatePct: 0.009,
  routerDistribution: [
    { router: 'Raydium CPMM', volumePct: 48.2, latencyMs: 110 },
    { router: 'Jupiter Smart Router', volumePct: 36.4, latencyMs: 145 },
    { router: 'Orca Whirlpool', volumePct: 11.2, latencyMs: 125 },
    { router: 'Uniswap v3 (Base)', volumePct: 4.2, latencyMs: 180 },
  ],
  recentFailedTrades: [
    {
      txHash: '5xFail...88a1',
      orderId: 'ord_fail_01',
      traderWallet: '7xK9...3a19',
      tokenPair: 'SOL / $SOLM',
      failureReason: 'Slippage Exceeded (Price moved >15% during slot confirmation)',
      gasSpentSol: 0.00005,
      timestamp: '12m ago',
    },
    {
      txHash: '3xFail...44c2',
      orderId: 'ord_fail_02',
      traderWallet: '2zW1...99k0',
      tokenPair: 'SOL / $CYBER',
      failureReason: 'RPC Node Timeout during simulation',
      gasSpentSol: 0.00001,
      timestamp: '24m ago',
    },
  ],
};

/** GET /api/v1/admin/trading — trading operations metrics, failed trades, routing latency. */
export async function GET() {
  try {
    return jsonResponse(mockTradingOps);
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load trading operations telemetry', 500));
  }
}
