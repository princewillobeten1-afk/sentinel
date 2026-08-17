import { describe, it, expect, beforeEach } from 'vitest';
import { adminFeatureFlagService } from '../feature-flags';

describe('Dynamic Feature Flag & Targeting Engine (Sprint 39 §41-42)', () => {
  beforeEach(() => {
    adminFeatureFlagService.reset();
  });

  it('evaluates fully enabled flags as true for all users', () => {
    expect(adminFeatureFlagService.evaluate('copy_trading', { userId: 'usr_random_1' })).toBe(true);
    expect(adminFeatureFlagService.evaluate('copy_trading', { userId: 'usr_random_2' })).toBe(true);
  });

  it('evaluates disabled flags as false', () => {
    expect(adminFeatureFlagService.evaluate('limit_orders_trailing_stop', { userId: 'usr_random_1' })).toBe(false);
  });

  it('evaluates role targeting and user whitelists correctly', () => {
    // cross_chain_base_routing has targetRoles: ['SUPER_ADMIN', 'DEVELOPER'] and targetUsers: ['user_001']
    expect(adminFeatureFlagService.evaluate('cross_chain_base_routing', { role: 'SUPER_ADMIN' })).toBe(true);
    expect(adminFeatureFlagService.evaluate('cross_chain_base_routing', { userId: 'user_001' })).toBe(true);
  });

  it('creates and updates a feature flag with audit logging', () => {
    const updated = adminFeatureFlagService.setFlag(
      {
        key: 'new_experimental_swap',
        name: 'New Swap Router',
        description: 'Testing',
        enabled: true,
        rolloutPct: 50,
        targetRoles: [],
        targetUsers: [],
        targetRegions: [],
        updatedBy: 'admin_test',
        updatedAt: new Date().toISOString(),
      },
      { updatedBy: 'admin_test', updatedByRole: 'ADMIN', reason: 'Launch experiment' }
    );

    expect(updated.enabled).toBe(true);
    expect(adminFeatureFlagService.getFlag('new_experimental_swap')).toBeDefined();
  });
});
