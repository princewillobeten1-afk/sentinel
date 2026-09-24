import { describe, expect, it } from 'vitest';
import { capabilityHealth } from '../capability-health';

const open = { state: 'open' as const, lastMessageAt: new Date().toISOString(), consecutiveFailures: 0 };
const closed = { state: 'closed' as const, lastMessageAt: null, consecutiveFailures: 3 };
const polling = { active: true, targetCount: 1, lastSuccessAt: new Date().toISOString() };

describe('capability-level provider health', () => {
  it('does not call QuickNode chain-stream failover healthy primary service', () => {
    const health = capabilityHealth({ birdeye: open, chainLogs: open, chainLogProvider: 'quicknode',
      quickNode: { configured: true, rpcState: 'verified' }, chartPolling: polling, birdeyeConfigured: true });
    expect(health.marketStreaming.state).toBe('healthy');
    expect(health.chainEvents).toMatchObject({ state: 'degraded', source: 'quicknode-wss' });
    expect(health.quickNodeRpcFallback.state).toBe('healthy');
  });

  it('reports a Birdeye streaming outage independently from REST candle polling', () => {
    const health = capabilityHealth({ birdeye: closed, chainLogs: open, chainLogProvider: 'helius',
      quickNode: { configured: true, rpcState: 'paused' }, chartPolling: polling, birdeyeConfigured: true });
    expect(health.marketStreaming.state).toBe('degraded');
    expect(health.chartLive).toMatchObject({ state: 'degraded', source: 'birdeye-ohlcv-rest' });
    expect(health.chainEvents.state).toBe('healthy');
    expect(health.quickNodeRpcFallback.state).toBe('unavailable');
  });
});
