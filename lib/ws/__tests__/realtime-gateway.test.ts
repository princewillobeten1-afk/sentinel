import { describe, it, expect, beforeEach } from 'vitest';
import { WebSocketGateway, webSocketGateway, WSClientSession } from '../gateway';
import { eventBus } from '@/lib/events/bus';

describe('Sprint 44: Realtime WebSocket Gateway & Authorization', () => {
  beforeEach(() => {
    webSocketGateway.reset();
  });

  it('allows unauthenticated and authenticated clients to subscribe to public channels (market, token)', () => {
    const messages: string[] = [];
    const client: WSClientSession = {
      id: 'client_anon_1',
      authenticated: false,
      subscriptions: new Set(),
      throttleIntervalMs: 0,
      lastSentByTopic: new Map(),
      send: (msg) => messages.push(msg),
    };

    webSocketGateway.registerClient(client);

    const subMarket = webSocketGateway.subscribe(client.id, 'market:mkt_sol_raydium_58oQChx4');
    expect(subMarket.success).toBe(true);

    const subToken = webSocketGateway.subscribe(client.id, 'token:DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');
    expect(subToken.success).toBe(true);
  });

  it('blocks unauthenticated or unauthorized clients from subscribing to private channels (user, wallet, order)', () => {
    const unauthClient: WSClientSession = {
      id: 'client_anon_2',
      authenticated: false,
      subscriptions: new Set(),
      throttleIntervalMs: 0,
      lastSentByTopic: new Map(),
      send: () => {},
    };

    webSocketGateway.registerClient(unauthClient);

    const subPrivate = webSocketGateway.subscribe(unauthClient.id, 'user:usr_alice_123');
    expect(subPrivate.success).toBe(false);
    expect(subPrivate.error).toContain('Unauthorized');

    // Authenticated client trying to subscribe to another user's channel
    const authClientBob: WSClientSession = {
      id: 'client_bob',
      userId: 'usr_bob_456',
      authenticated: true,
      subscriptions: new Set(),
      throttleIntervalMs: 0,
      lastSentByTopic: new Map(),
      send: () => {},
    };

    webSocketGateway.registerClient(authClientBob);

    const subForbidden = webSocketGateway.subscribe(authClientBob.id, 'user:usr_alice_123');
    expect(subForbidden.success).toBe(false);
    expect(subForbidden.error).toContain('Forbidden');

    const subOwnUser = webSocketGateway.subscribe(authClientBob.id, 'user:usr_bob_456');
    expect(subOwnUser.success).toBe(true);
  });

  it('broadcasts stable versioned event payloads: { type, version: 1, timestamp, data }', async () => {
    const messages: string[] = [];
    const client: WSClientSession = {
      id: 'client_sub_1',
      authenticated: true,
      userId: 'usr_charlie',
      subscriptions: new Set(),
      throttleIntervalMs: 0,
      lastSentByTopic: new Map(),
      send: (msg) => messages.push(msg),
    };

    webSocketGateway.registerClient(client);
    webSocketGateway.subscribe(client.id, 'market:mkt_1');

    await eventBus.publish({
      eventId: 'evt_price_1',
      eventType: 'market.price_updated',
      version: '1',
      chain: 'solana',
      timestamp: new Date().toISOString(),
      source: 'test',
      payload: {
        marketId: 'mkt_1',
        price: 145.2,
      },
    });

    expect(messages.length).toBe(1);
    const parsed = JSON.parse(messages[0]);
    expect(parsed.type).toBe('market.price_updated');
    expect(parsed.version).toBe(1);
    expect(parsed.timestamp).toBeDefined();
    expect(parsed.data.price).toBe(145.2);
  });
});
