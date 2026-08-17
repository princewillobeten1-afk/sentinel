import { describe, it, expect, beforeEach } from 'vitest';
import { modelRouter } from '../model-router';

describe('Provider-Agnostic Model Router (Sprint 37 §4-5)', () => {
  beforeEach(() => {
    modelRouter.reset();
  });

  it('routes FAST_MODEL category requests to low-latency models', () => {
    const model = modelRouter.routeModel({ category: 'FAST_MODEL' });
    expect(model.category).toBe('FAST_MODEL');
    expect(model.averageLatencyMs).toBeLessThanOrEqual(1000);
    expect(model.isAvailable).toBe(true);
  });

  it('routes REASONING_MODEL category requests to high-accuracy reasoning models', () => {
    const model = modelRouter.routeModel({ category: 'REASONING_MODEL' });
    expect(model.category).toBe('REASONING_MODEL');
    expect(model.accuracyScore).toBeGreaterThanOrEqual(95);
  });

  it('falls back to deterministic local stub when models are unavailable', () => {
    // Disable external models
    modelRouter.setModelAvailability('gemini-1.5-flash', false);
    modelRouter.setModelAvailability('claude-3-5-haiku', false);

    const model = modelRouter.routeModel({ category: 'FAST_MODEL' });
    expect(model.id).toBe('deterministic-stub');
    expect(model.category).toBe('SPECIALIZED_MODEL');
  });
});
