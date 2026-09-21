import { describe, it, expect } from 'vitest';
import {
  planTokenTopics,
  topicsToAdd,
  topicsToRemove,
  parseTokenTopic,
  SESSION_TOPIC_BUDGET,
} from '../topic-plan';

const mints = (n: number) => Array.from({ length: n }, (_, i) => `mint${i}`);

describe('planTokenTopics', () => {
  it('gives every token one aggregated card stream', () => {
    const plan = planTokenTopics(mints(20), { tradeStreams: 6 });
    expect(plan.pricedMints).toHaveLength(20);
    expect(plan.droppedMints).toHaveLength(0);
    for (const m of mints(20)) expect(plan.topics).toContain(`token.card:${m}`);
  });

  it('stays within the session cap', () => {
    // Past the cap the server answers SUBSCRIPTION_LIMIT and drops the excess,
    // leaving those cards looking live while never updating.
    const plan = planTokenTopics(mints(40));
    expect(plan.topics.length).toBeLessThanOrEqual(SESSION_TOPIC_BUDGET);
  });

  it('reports the tokens it could not fit rather than dropping them silently', () => {
    const plan = planTokenTopics(mints(40));
    expect(plan.droppedMints.length).toBeGreaterThan(0);
    expect(plan.pricedMints.length + plan.droppedMints.length).toBe(40);
  });

  it('carries trades for every subscribed card without a second topic', () => {
    const plan = planTokenTopics(mints(5), { tradeStreams: 3 });
    expect(plan.tradedMints).toEqual(mints(5));
    expect(plan.topics).toEqual(mints(5).map((mint) => `token.card:${mint}`));
  });

  it('uses only aggregated topics near the budget', () => {
    const plan = planTokenTopics(mints(28), { tradeStreams: 6 });
    expect(plan.tradedMints).toHaveLength(28);
    expect(plan.topics.every((t) => t.startsWith('token.card:'))).toBe(true);
  });

  it('de-duplicates a mint that appears in two lists', () => {
    // The same token legitimately shows up in trending and top; subscribing
    // twice would burn a slot for nothing.
    const plan = planTokenTopics(['a', 'b', 'a', 'b'], { tradeStreams: 0 });
    expect(plan.pricedMints).toEqual(['a', 'b']);
    expect(plan.topics).toEqual(['token.card:a', 'token.card:b']);
  });

  it('ignores empty mints', () => {
    expect(planTokenTopics(['', 'a', ''], { tradeStreams: 0 }).pricedMints).toEqual(['a']);
  });

  it('handles an empty list', () => {
    const plan = planTokenTopics([]);
    expect(plan.topics).toEqual([]);
    expect(plan.droppedMints).toEqual([]);
  });
});

describe('topic diffing', () => {
  it('adds only what is missing and removes only what is unwanted', () => {
    // Re-sending every topic on each token change would waste the message-rate
    // budget the server enforces.
    const held = new Set(['token.price:a', 'token.price:b']);
    const wanted = ['token.price:b', 'token.price:c'];
    expect(topicsToAdd(held, wanted)).toEqual(['token.price:c']);
    expect(topicsToRemove(held, wanted)).toEqual(['token.price:a']);
  });

  it('is a no-op when the plan is unchanged', () => {
    const held = new Set(['token.price:a']);
    expect(topicsToAdd(held, ['token.price:a'])).toEqual([]);
    expect(topicsToRemove(held, ['token.price:a'])).toEqual([]);
  });
});

describe('parseTokenTopic', () => {
  it('splits a token topic into kind and mint', () => {
    expect(parseTokenTopic('token.price:So111')).toEqual({ kind: 'token.price', mint: 'So111' });
    expect(parseTokenTopic('token.trade:So111')).toEqual({ kind: 'token.trade', mint: 'So111' });
    expect(parseTokenTopic('token.card:So111')).toEqual({ kind: 'token.card', mint: 'So111' });
  });

  it('rejects topics this hook does not handle', () => {
    // feed.discovery is a real topic, but belongs to a different consumer;
    // treating it as a token topic would key updates by a section name.
    expect(parseTokenTopic('feed.discovery:all')).toBeNull();
    expect(parseTokenTopic('token.price:')).toBeNull();
    expect(parseTokenTopic('nonsense')).toBeNull();
  });
});
