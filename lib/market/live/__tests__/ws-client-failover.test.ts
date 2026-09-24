import { once } from 'node:events';
import { WebSocketServer } from 'ws';
import { describe, expect, it } from 'vitest';
import { ReconnectingWebSocketClient } from '../ws-client';

async function until(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('WebSocket state did not settle.');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

describe('single-socket RPC subscription failover', () => {
  it('closes the previous transport before opening the standby and ignores its stale close', async () => {
    const primary = new WebSocketServer({ port: 0 });
    const standby = new WebSocketServer({ port: 0 });
    await Promise.all([once(primary, 'listening'), once(standby, 'listening')]);
    const primaryPort = (primary.address() as { port: number }).port;
    const standbyPort = (standby.address() as { port: number }).port;
    let opens = 0;
    const client = new ReconnectingWebSocketClient({
      name: 'test-chain-logs', url: `ws://127.0.0.1:${primaryPort}`,
      onMessage: () => {}, onOpen: () => { opens += 1; },
    });
    try {
      client.connect();
      await until(() => opens === 1 && primary.clients.size === 1);
      client.switchEndpoint(`ws://127.0.0.1:${standbyPort}`);
      await until(() => opens === 2 && primary.clients.size === 0 && standby.clients.size === 1);
      expect(client.getHealth().state).toBe('open');
      expect(primary.clients.size + standby.clients.size).toBe(1);
    } finally {
      client.stop();
      for (const socket of [...primary.clients, ...standby.clients]) socket.terminate();
      await Promise.all([
        new Promise<void>(resolve => primary.close(() => resolve())),
        new Promise<void>(resolve => standby.close(() => resolve())),
      ]);
    }
  });
});
