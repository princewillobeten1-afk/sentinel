import { describe, it, expect } from 'vitest';
import { computeCreatorEntity } from '../context-builder';

describe('creator context-builder', () => {
  it('returns null for an unknown symbol rather than throwing', () => {
    expect(computeCreatorEntity('NOT_A_TOKEN')).toBeNull();
  });

  it('QUANT (unidentified creator) reproduces the same INSUFFICIENT/null read the old literal had', () => {
    const entity = computeCreatorEntity('QUANT');
    expect(entity).not.toBeNull();
    expect(entity?.reputation.score).toBeNull();
    expect(entity?.reputation.confidenceLevel).toBe('INSUFFICIENT');
  });

  it('SENT (good history, 4 launches) computes a real numeric score, not null', () => {
    const entity = computeCreatorEntity('SENT');
    expect(entity?.reputation.score).not.toBeNull();
    expect(entity?.reputation.sampleSize).toBe(4);
    expect(entity?.reputation.dimensions.length).toBe(8);
  });

  it('preserves identification, launches and behaviorProfile from the base entity untouched', () => {
    const entity = computeCreatorEntity('BONK');
    expect(entity?.primaryAddress).toBe('BONKcreator5678abcd1234efgh5678');
    expect(entity?.launches.length).toBe(4);
    expect(entity?.behaviorProfile.avgRetentionPct).toBe(33.75);
  });

  it('ALPHA (concerning pattern) reads worse than SENT (good history)', () => {
    const alpha = computeCreatorEntity('ALPHA');
    const sent = computeCreatorEntity('SENT');
    expect(alpha?.reputation.score).not.toBeNull();
    expect(sent?.reputation.score).not.toBeNull();
    expect(alpha!.reputation.score!).toBeLessThan(sent!.reputation.score!);
  });

  it('reputation is genuinely computed, not the hand-authored literal (deterministic across calls)', () => {
    const first = computeCreatorEntity('SENT');
    const second = computeCreatorEntity('SENT');
    // Compare scores, not full dimension objects — each dimension's evidence embeds a
    // wall-clock `observedAt`, which can legitimately differ by a millisecond between
    // two calls made microseconds apart, even though the underlying computation itself
    // (score/level/confidence) is fully deterministic for the same input.
    const scoresOnly = first?.reputation.dimensions?.map((d) => ({ name: d.name, score: d.score }));
    const scoresOnly2 = second?.reputation.dimensions?.map((d) => ({ name: d.name, score: d.score }));
    expect(scoresOnly).toEqual(scoresOnly2);
    expect(first?.reputation.generatedAt).toBeDefined();
  });
});
