import { describe, it, expect, beforeEach } from 'vitest';
import {
  isFeatureEnabled,
  computeUserBucket,
  setFeatureFlag,
  updateRolloutPercentage,
  resetFeatureFlags,
} from '../feature-flags';

describe('Feature Flags & Progressive Canary Rollouts', () => {
  beforeEach(() => {
    resetFeatureFlags();
  });

  it('computes deterministic user hash bucket between 0 and 99', () => {
    const bucket1 = computeUserBucket('user_alice_123', 'advanced_copy_trading');
    const bucket2 = computeUserBucket('user_alice_123', 'advanced_copy_trading');
    expect(bucket1).toBe(bucket2); // deterministic!
    expect(bucket1).toBeGreaterThanOrEqual(0);
    expect(bucket1).toBeLessThan(100);
  });

  it('allows access for 100% rollout flags', () => {
    expect(isFeatureEnabled('subsecond_order_stream', { userId: 'user_random_999' })).toBe(true);
  });

  it('respects role whitelist for low-rollout flags', () => {
    // 10% rollout flag
    expect(isFeatureEnabled('advanced_copy_trading', { userId: 'user_admin', role: 'admin' })).toBe(true);
    expect(isFeatureEnabled('advanced_copy_trading', { userId: 'user_analyst', role: 'analyst' })).toBe(true);
  });

  it('allows gradual rollout expansion via updateRolloutPercentage', () => {
    setFeatureFlag({
      key: 'experimental_feature',
      description: 'Test flag',
      enabled: true,
      rolloutPercentage: 0,
    });

    expect(isFeatureEnabled('experimental_feature', { userId: 'user_test' })).toBe(false);

    updateRolloutPercentage('experimental_feature', 100);
    expect(isFeatureEnabled('experimental_feature', { userId: 'user_test' })).toBe(true);
  });
});
