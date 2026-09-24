import type { ConnectionHealth } from './types';

export type CapabilityState = 'healthy' | 'degraded' | 'unavailable' | 'idle';
export interface CapabilityHealth { state: CapabilityState; source: string | null; reason?: string }

/** Read-only status for distinct capabilities, not one misleading provider flag. */
export function capabilityHealth(input: {
  birdeye: ConnectionHealth;
  chainLogs: ConnectionHealth;
  chainLogProvider: 'helius' | 'quicknode' | null;
  quickNode: { configured: boolean; rpcState: string };
  chartPolling: { active: boolean; targetCount: number; lastSuccessAt: string | null };
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
  const chartLive: CapabilityHealth = input.chartPolling.targetCount === 0
    ? { state: 'idle', source: null }
    : marketStreaming.state === 'healthy'
      ? { state: 'healthy', source: 'birdeye-ws' }
      : input.chartPolling.active && recentPoll
        ? { state: 'degraded', source: 'birdeye-ohlcv-rest', reason: 'Live candles are polling.' }
        : { state: 'degraded', source: 'birdeye-ohlcv-rest', reason: 'Waiting for a measured candle.' };

  const quickNodeRpcFallback: CapabilityHealth = !input.quickNode.configured
    ? { state: 'unavailable', source: null, reason: 'QuickNode RPC is not configured.' }
    : input.quickNode.rpcState === 'verified'
      ? { state: 'healthy', source: 'quicknode-rpc' }
      : input.quickNode.rpcState === 'paused'
        ? { state: 'unavailable', source: 'quicknode-rpc', reason: 'QuickNode RPC is temporarily paused.' }
        : { state: 'degraded', source: 'quicknode-rpc', reason: 'QuickNode mainnet identity has not been verified recently.' };

  return { marketStreaming, chainEvents, chartLive, quickNodeRpcFallback };
}
