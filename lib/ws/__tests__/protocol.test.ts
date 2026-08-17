import { describe, it, expect } from 'vitest';
import { parseClientMessage, serialize } from '../protocol';
import { parseTopic, buildTopic, TOPIC_SCOPES } from '../topics';

describe('ws protocol — parseClientMessage', () => {
  it('parses a valid subscribe frame', () => {
    const result = parseClientMessage(JSON.stringify({ type: 'subscribe', topics: ['token.price:abc'] }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.message).toEqual({ type: 'subscribe', topics: ['token.price:abc'] });
  });

  it('parses a valid unsubscribe frame', () => {
    const result = parseClientMessage(JSON.stringify({ type: 'unsubscribe', topics: ['token.price:abc'] }));
    expect(result.ok).toBe(true);
  });

  it('parses a ping frame', () => {
    const result = parseClientMessage(JSON.stringify({ type: 'ping' }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.message.type).toBe('ping');
  });

  it('rejects malformed JSON without throwing', () => {
    const result = parseClientMessage('{not json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID_JSON');
  });

  it('rejects a non-object payload', () => {
    const result = parseClientMessage('"just a string"');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID_MESSAGE');
  });

  it('rejects an unknown message type', () => {
    const result = parseClientMessage(JSON.stringify({ type: 'launch_missiles' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('UNKNOWN_MESSAGE_TYPE');
  });

  it('rejects subscribe with a non-array or empty topics list', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'subscribe', topics: 'nope' })).ok).toBe(false);
    expect(parseClientMessage(JSON.stringify({ type: 'subscribe', topics: [] })).ok).toBe(false);
    expect(parseClientMessage(JSON.stringify({ type: 'subscribe', topics: [1, 2] })).ok).toBe(false);
  });

  it('serialize round-trips a server message', () => {
    const encoded = serialize({ type: 'pong' });
    expect(JSON.parse(encoded)).toEqual({ type: 'pong' });
  });
});

describe('ws topics', () => {
  it('parses a well-formed topic', () => {
    expect(parseTopic('token.price:So111')).toEqual({ kind: 'token.price', target: 'So111', raw: 'token.price:So111' });
  });

  it('rejects an unknown topic kind', () => {
    expect(parseTopic('token.nonsense:abc')).toBeNull();
  });

  it('rejects a topic with no target or no separator', () => {
    expect(parseTopic('token.price:')).toBeNull();
    expect(parseTopic('token.price')).toBeNull();
    expect(parseTopic(':abc')).toBeNull();
  });

  it('preserves targets containing a colon (only the first separator splits)', () => {
    expect(parseTopic('token.price:a:b')?.target).toBe('a:b');
  });

  it('buildTopic is the inverse of parseTopic', () => {
    const topic = buildTopic('token.risk', 'mint123');
    expect(parseTopic(topic)).toEqual({ kind: 'token.risk', target: 'mint123', raw: topic });
  });

  it('every topic kind declares a required scope (no topic is accidentally ungated)', () => {
    expect(TOPIC_SCOPES['token.price']).toBe('READ_MARKET_DATA');
    expect(TOPIC_SCOPES['token.trade']).toBe('READ_MARKET_DATA');
    expect(TOPIC_SCOPES['token.risk']).toBe('READ_TOKEN_INTELLIGENCE');
  });
});
