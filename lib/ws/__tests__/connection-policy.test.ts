import { describe, expect, it } from 'vitest';
import {
  checkMessageRate,
  createRateLimitState,
  nextTopicSequence,
  shouldCoalesce,
} from '../connection-policy';

describe('checkMessageRate', () => {
  it('allows messages under the limit within a window', () => {
    let state = createRateLimitState(0);
    for (let i = 0; i < 30; i++) {
      const result = checkMessageRate(state, 100, 30, 10_000);
      expect(result.allowed).toBe(true);
      expect(result.terminate).toBe(false);
      state = result.state;
    }
  });

  it('disallows (but does not terminate) once over the limit within a window', () => {
    let state = createRateLimitState(0);
    for (let i = 0; i < 30; i++) {
      state = checkMessageRate(state, 100, 30, 10_000).state;
    }
    const result = checkMessageRate(state, 100, 30, 10_000);
    expect(result.allowed).toBe(false);
    expect(result.terminate).toBe(false);
  });

  it('signals terminate once sustained abuse crosses 3x the limit in one window', () => {
    let state = createRateLimitState(0);
    let result = checkMessageRate(state, 0, 30, 10_000);
    state = result.state;
    for (let i = 0; i < 89; i++) {
      result = checkMessageRate(state, 100, 30, 10_000);
      state = result.state;
    }
    // 90 messages within the window — right at 3x, not yet over.
    expect(result.terminate).toBe(false);
    result = checkMessageRate(state, 100, 30, 10_000);
    expect(result.terminate).toBe(true);
  });

  it('resets the window once windowMs has elapsed', () => {
    let state = createRateLimitState(0);
    for (let i = 0; i < 30; i++) {
      state = checkMessageRate(state, 100, 30, 10_000).state;
    }
    expect(checkMessageRate(state, 100, 30, 10_000).allowed).toBe(false);

    const afterWindow = checkMessageRate(state, 10_101, 30, 10_000);
    expect(afterWindow.allowed).toBe(true);
    expect(afterWindow.state.count).toBe(1);
  });

  it('does not mutate the state object passed in', () => {
    const state = createRateLimitState(0);
    const frozen = { ...state };
    checkMessageRate(state, 100, 30, 10_000);
    expect(state).toEqual(frozen);
  });
});

describe('nextTopicSequence', () => {
  it('starts each topic at 1 and increments independently per topic', () => {
    const topicSequences = new Map<string, number>();
    expect(nextTopicSequence(topicSequences, 'token.price:A')).toBe(1);
    expect(nextTopicSequence(topicSequences, 'token.price:A')).toBe(2);
    expect(nextTopicSequence(topicSequences, 'token.price:B')).toBe(1);
    expect(nextTopicSequence(topicSequences, 'token.price:A')).toBe(3);
  });
});

describe('shouldCoalesce', () => {
  it('is false under the default threshold', () => {
    expect(shouldCoalesce(500_000)).toBe(false);
  });

  it('is true over the default threshold', () => {
    expect(shouldCoalesce(1_500_000)).toBe(true);
  });

  it('respects a custom threshold', () => {
    expect(shouldCoalesce(2000, 1000)).toBe(true);
    expect(shouldCoalesce(500, 1000)).toBe(false);
  });
});
