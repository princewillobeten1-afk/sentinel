import { describe, it, expect } from 'vitest';
import {
  encodeClientMessage,
  pingMessage,
  subscribeMessage,
  unsubscribeMessage,
} from '../client-messages';
import { parseClientMessage } from '../protocol';

/**
 * The client and the server agree on the wire format.
 *
 * This is the regression that motivated the module: the client sent
 * `{action:'subscribe'}`, the server parsed `type`, and every subscription was
 * silently refused. Each case below sends exactly what the browser sends
 * through exactly what the server runs.
 */
describe('client messages parse on the server', () => {
  it('accepts a subscribe', () => {
    const raw = encodeClientMessage(subscribeMessage(['token.price:MintOne']));
    const parsed = parseClientMessage(raw);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.message).toEqual({ type: 'subscribe', topics: ['token.price:MintOne'] });
  });

  it('accepts an unsubscribe', () => {
    const raw = encodeClientMessage(unsubscribeMessage(['token.trade:MintOne']));
    const parsed = parseClientMessage(raw);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.message).toEqual({ type: 'unsubscribe', topics: ['token.trade:MintOne'] });
  });

  it('accepts a ping', () => {
    const parsed = parseClientMessage(encodeClientMessage(pingMessage()));
    expect(parsed.ok).toBe(true);
  });

  it('carries the discovery topics the store subscribes to', () => {
    // These are the topics the server has been publishing to all along with
    // nothing listening. If the shape breaks, the Discover feed loses its
    // socket and silently falls back to polling.
    const topics = ['feed.discovery:new', 'feed.discovery:migrating', 'feed.discovery:graduated'];
    const parsed = parseClientMessage(encodeClientMessage(subscribeMessage(topics)));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.message).toEqual({ type: 'subscribe', topics });
  });

  it('rejects the legacy `action` shape that caused the outage', () => {
    // Pinning the bug itself: this is what the client used to send.
    const parsed = parseClientMessage(JSON.stringify({ action: 'subscribe', topics: ['x'] }));

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.code).toBe('UNKNOWN_MESSAGE_TYPE');
  });
});
