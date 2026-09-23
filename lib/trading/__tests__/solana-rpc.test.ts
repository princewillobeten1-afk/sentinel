import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { broadcastSignedTransaction, MAINNET_GENESIS, resetTradingRpcForTests } from '../solana-rpc';

const saved = {
  enabled: process.env.SOLANA_TRADING_ENABLED,
  primary: process.env.SOLANA_TRADING_RPC_URL,
  fallback: process.env.SOLANA_TRADING_FALLBACK_RPC_URL,
};
function reply(result: unknown) { return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), { status: 200 }); }

beforeEach(() => {
  process.env.SOLANA_TRADING_ENABLED = 'true';
  process.env.SOLANA_TRADING_RPC_URL = 'https://rpc-primary.example';
  delete process.env.SOLANA_TRADING_FALLBACK_RPC_URL;
  resetTradingRpcForTests();
});
afterEach(() => {
  if (saved.enabled === undefined) delete process.env.SOLANA_TRADING_ENABLED; else process.env.SOLANA_TRADING_ENABLED = saved.enabled;
  if (saved.primary === undefined) delete process.env.SOLANA_TRADING_RPC_URL; else process.env.SOLANA_TRADING_RPC_URL = saved.primary;
  if (saved.fallback === undefined) delete process.env.SOLANA_TRADING_FALLBACK_RPC_URL; else process.env.SOLANA_TRADING_FALLBACK_RPC_URL = saved.fallback;
  vi.unstubAllGlobals(); resetTradingRpcForTests();
});

describe('Solana mainnet broadcaster', () => {
  it('does not submit to an endpoint on another cluster', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      const method = JSON.parse(String(init.body)).method;
      calls.push(method);
      return reply('wrong-cluster');
    }));
    await expect(broadcastSignedTransaction('signed-bytes', 'expected-signature')).rejects.toMatchObject({ code: 'WRONG_NETWORK' });
    expect(calls).toEqual(['getGenesisHash']);
  });

  it('sends identical signed bytes to fallback after an uncertain primary response', async () => {
    process.env.SOLANA_TRADING_FALLBACK_RPC_URL = 'https://rpc-fallback.example';
    const sends: Array<{ url: string; transaction: string }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      if (body.method === 'getGenesisHash') return reply(MAINNET_GENESIS);
      sends.push({ url, transaction: body.params[0] });
      if (url.includes('primary')) throw new Error('timeout');
      return reply('expected-signature');
    }));
    await expect(broadcastSignedTransaction('signed-bytes', 'expected-signature')).resolves.toEqual({ accepted: true });
    expect(sends).toEqual([
      { url: 'https://rpc-primary.example', transaction: 'signed-bytes' },
      { url: 'https://rpc-fallback.example', transaction: 'signed-bytes' },
    ]);
  });

  it('never treats a different returned signature as success', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      return reply(JSON.parse(String(init.body)).method === 'getGenesisHash' ? MAINNET_GENESIS : 'different-signature');
    }));
    await expect(broadcastSignedTransaction('signed-bytes', 'expected-signature')).resolves.toMatchObject({ accepted: false });
  });
});
