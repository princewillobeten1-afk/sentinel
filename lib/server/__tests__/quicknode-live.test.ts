import { loadEnvConfig } from '@next/env';
import { describe, expect, it } from 'vitest';

/** Opt-in, read-only smoke test: QUICKNODE_LIVE_SMOKE=true npx vitest run this file. */
describe.runIf(process.env.QUICKNODE_LIVE_SMOKE === 'true')('live QuickNode status-route fallback', () => {
  it('returns a real mainnet slot when the primary Helius RPC is unavailable', async () => {
    loadEnvConfig(process.cwd());
    expect(process.env.QUICKNODE_SOLANA_RPC_URL).toBeTruthy();
    expect(process.env.QUICKNODE_SOLANA_WSS_URL).toBeTruthy();

    const previousHelius = process.env.HELIUS_RPC_URL;
    const previousStream = process.env.MARKET_STREAM_ENABLED;
    const previousTrading = process.env.SOLANA_TRADING_ENABLED;
    process.env.HELIUS_RPC_URL = 'https://127.0.0.1:1';
    process.env.MARKET_STREAM_ENABLED = 'false';
    process.env.SOLANA_TRADING_ENABLED = 'false';
    try {
      const { GET } = await import('@/app/api/v1/market/live/status/route');
      const response = await GET();
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.data?.quickNode).toMatchObject({ configured: true, rpcState: 'verified' });
      expect(Number.isSafeInteger(body.data?.slot) && body.data.slot > 0).toBe(true);
      expect(JSON.stringify(body.data?.quickNode)).not.toContain(process.env.QUICKNODE_SOLANA_RPC_URL);
    } finally {
      if (previousHelius === undefined) delete process.env.HELIUS_RPC_URL;
      else process.env.HELIUS_RPC_URL = previousHelius;
      if (previousStream === undefined) delete process.env.MARKET_STREAM_ENABLED;
      else process.env.MARKET_STREAM_ENABLED = previousStream;
      if (previousTrading === undefined) delete process.env.SOLANA_TRADING_ENABLED;
      else process.env.SOLANA_TRADING_ENABLED = previousTrading;
    }
  }, 20_000);
});
