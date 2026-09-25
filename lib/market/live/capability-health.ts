import type { ConnectionHealth } from './types';

export type CapabilityState = 'healthy' | 'degraded' | 'unavailable' | 'idle';
export interface CapabilityHealth { state: CapabilityState; source: string | null; reason?: string }

/** Read-only status for distinct capabilities, not one misleading provider flag. */
export function capabilityHealth(input: {
  birdeye: ConnectionHealth;
  chainLogs: ConnectionHealth;
  chainLogProvider: 'helius' | 'quicknode' | null;
  quickNode: { configured: boolean; rpcState: string };
  chartPolling: { active: boolean; targetCount: number; lastSuccessAt: string | null; lastSource?: string | null };
  chartStreaming?: { connected: boolean; lastTradeAt: string | null; pausedUntil: string | null };
  birdeyeConfigured: boolean;
}): Record<'marketStreaming' | 'chainEvents' | 'chartLive' | 'quickNodeRpcFallback', CapabilityHealth> {
  const marketStreaming: CapabilityHealth = !input.birdeyeConfigured
    ? { state: 'unavailable', source: null, reason: 'Birdeye is not configured.' }
    : input.birdeye.state === 'open' && !input.birdeye.providerError
      ? { state: 'healthy', source: 'birdeye-ws' }
      : { state: 'degraded', source: 'birdeye-ws', reason: 'Market stream is reconnecting or rejected.' };

  const chainEvents: CapabilityHealth = input.chainLogs.state === 'open'
    && !input.chainLogs.providerError && input.chainLogProvider === 'helius'
    ? { state: 'healthy', source: 'helius-ws' }
    : input.chainLogs.state === 'open' && !input.chainLogs.providerError
      && input.chainLogProvider === 'quicknode'
      ? { state: 'degraded', source: 'quicknode-wss', reason: 'Primary chain stream is on standby.' }
      : input.chainLogs.state === 'connecting' || input.chainLogs.state === 'reconnecting'
        ? { state: 'degraded', source: input.chainLogProvider, reason: 'Chain stream is reconnecting.' }
        : { state: 'unavailable', source: input.chainLogProvider, reason: 'No active chain event stream.' };

  const recentPoll = input.chartPolling.lastSuccessAt !== null
    && Date.now() - Date.parse(input.chartPolling.lastSuccessAt) < 45_000;
  const recentTrade = input.chartStreaming?.connected && input.chartStreaming.lastTradeAt !== null
    && Date.now() - Date.parse(input.chartStreaming!.lastTradeAt!) < 30_000;
  const chartLive: CapabilityHealth = input.chartPolling.targetCount === 0
    ? { state: 'idle', source: null }
    : recentTrade
      ? { state: 'healthy', source: 'quicknode-pool-ws' }
      : marketStreaming.state === 'healthy'
      ? { state: 'healthy', source: 'birdeye-ws' }
      : input.chartPolling.active && recentPoll
        ? { state: 'degraded', source: input.chartPolling.lastSource ?? 'birdeye-ohlcv-rest', reason: 'Candles are reconciling through REST.' }
        : { state: 'degraded', source: input.chartStreaming?.connected ? 'quicknode-pool-ws' : 'ohlcv-rest',
          reason: input.chartStreaming?.pausedUntil ? 'Chart stream data budget is paused.' : 'Waiting for a measured candle or swap.' };

  const quickNodeRpcFallback: CapabilityHealth = !input.quickNode.configured
    ? { state: 'unavailable', source: null, reason: 'QuickNode RPC is not configured.' }
    : input.quickNode.rpcState === 'verified'
      ? { state: 'healthy', source: 'quicknode-rpc' }
      : input.quickNode.rpcState === 'paused'
        ? { state: 'unavailable', source: 'quicknode-rpc', reason: 'QuickNode RPC is temporarily paused.' }
        : { state: 'degraded', source: 'quicknode-rpc', reason: 'QuickNode mainnet identity has not been verified recently.' };

  return { marketStreaming, chainEvents, chartLive, quickNodeRpcFallback };
}
