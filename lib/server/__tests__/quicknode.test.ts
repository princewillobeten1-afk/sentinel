import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickNodeService } from '../quicknode';
import { MAINNET_GENESIS } from '@/lib/trading/solana-rpc';

const savedRpc = process.env.QUICKNODE_SOLANA_RPC_URL;
const savedWss = process.env.QUICKNODE_SOLANA_WSS_URL;

function rpcReply(result: unknown) {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: '1', result }), {
    status: 200, headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  process.env.QUICKNODE_SOLANA_RPC_URL = 'https://quicknode.example/secret';
  process.env.QUICKNODE_SOLANA_WSS_URL = 'wss://quicknode.example/secret';
});
afterEach(() => {
  if (savedRpc === undefined) delete process.env.QUICKNODE_SOLANA_RPC_URL;
  else process.env.QUICKNODE_SOLANA_RPC_URL = savedRpc;
  if (savedWss === undefined) delete process.env.QUICKNODE_SOLANA_WSS_URL;
  else process.env.QUICKNODE_SOLANA_WSS_URL = savedWss;
  vi.unstubAllGlobals();
});

describe('QuickNode server-only infrastructure fallback', () => {
  it('does not call QuickNode when the primary RPC succeeds', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(JSON.parse(String(init.body)).method).toBe('getSlot');
      return rpcReply(123);
    });
    vi.stubGlobal('fetch', fetchMock);
    const read = await new QuickNodeService().read('https://helius.example/secret', rpc => rpc.getSlot());
    expect(read).toEqual({ value: 123, source: 'helius' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('verifies mainnet before retrying a failed read on QuickNode', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string, init: RequestInit) => {
      const method = JSON.parse(String(init.body)).method;
      calls.push(`${input.includes('quicknode') ? 'quicknode' : 'helius'}:${method}`);
      if (input.includes('helius')) throw new Error('primary unavailable');
      return rpcReply(method === 'getGenesisHash' ? MAINNET_GENESIS : 456);
    }));
    const service = new QuickNodeService();
    expect(await service.read('https://helius.example/secret', rpc => rpc.getSlot())).toEqual({ value: 456, source: 'quicknode' });
    expect(calls).toEqual(['helius:getSlot', 'quicknode:getGenesisHash', 'quicknode:getSlot']);
    expect(service.getHealth()).toMatchObject({ configured: true, rpcState: 'verified', consecutiveFailures: 0 });
    expect(JSON.stringify(service.getHealth())).not.toContain('secret');
  });

  it('never reads data from a QuickNode endpoint on the wrong cluster', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_input: string, init: RequestInit) => {
      const method = JSON.parse(String(init.body)).method;
      calls.push(method);
      return rpcReply('wrong-cluster');
    }));
    const service = new QuickNodeService();
    await expect(service.read('', rpc => rpc.getSlot())).rejects.toThrow('No healthy mainnet RPC');
    expect(calls).toEqual(['getGenesisHash']);
    expect(await service.websocketEndpoint()).toBeNull();
  });

  it('retries the existing JSON-RPC transaction request only after mainnet verification', async () => {
    const methods: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_input: string, init: RequestInit) => {
      const method = JSON.parse(String(init.body)).method;
      methods.push(method);
      return rpcReply(method === 'getGenesisHash' ? MAINNET_GENESIS : { slot: 77 });
    }));
    const service = new QuickNodeService();
    const request = { jsonrpc: '2.0', id: 1, method: 'getTransaction', params: ['signature'] };
    expect(await service.request(request)).toMatchObject({ status: 200, body: { result: { slot: 77 } } });
    expect(methods).toEqual(['getGenesisHash', 'getTransaction']);
    expect(await service.websocketEndpoint()).toBe('wss://quicknode.example/secret');
  });

  it('rejects insecure endpoints and keeps WebSocket failover disabled without a paired RPC', async () => {
    process.env.QUICKNODE_SOLANA_RPC_URL = 'http://quicknode.example/secret';
    const service = new QuickNodeService();
    expect(service.getHealth().configured).toBe(false);
    expect(await service.websocketEndpoint()).toBeNull();
  });
});
