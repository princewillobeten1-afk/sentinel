import { describe, it, expect } from 'vitest';
import {
  PLATFORM_QUALITY_PROFILES,
  getServiceQualityProfile,
  getAllQualityProfiles,
  getServicesByCriticality,
} from '../quality-matrix';

describe('Master Quality Matrix & Criticality Classification', () => {
  it('defines quality profiles for all core platform subsystems', () => {
    const profiles = getAllQualityProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(10);

    const trading = getServiceQualityProfile('trading_execution');
    expect(trading).toBeDefined();
    expect(trading?.criticality).toBe('P0_FINANCIAL');
    expect(trading?.availabilityTarget).toBe(0.9999);
    expect(trading?.latencyClass).toBe('L0_ULTRA_CRITICAL');
    expect(trading?.consistencyModel).toBe('STRONG_CONSISTENCY');
    expect(trading?.drTier).toBe('TIER_A_FINANCIAL');
    expect(trading?.rpoMinutes).toBe(1);
    expect(trading?.rtoMinutes).toBe(15);
  });

  it('correctly filters services by criticality level', () => {
    const p0Services = getServicesByCriticality('P0_FINANCIAL');
    const p0Ids = p0Services.map((s) => s.serviceId);
    expect(p0Ids).toContain('trading_execution');
    expect(p0Ids).toContain('order_management');
    expect(p0Ids).toContain('wallet_service');
    expect(p0Ids).toContain('authentication');

    const p1Services = getServicesByCriticality('P1_TRADING');
    const p1Ids = p1Services.map((s) => s.serviceId);
    expect(p1Ids).toContain('market_data');
    expect(p1Ids).toContain('portfolio');
    expect(p1Ids).toContain('risk_engine');
  });

  it('verifies latency budgets across classes', () => {
    const trading = getServiceQualityProfile('trading_execution');
    const market = getServiceQualityProfile('market_data');
    const analytics = getServiceQualityProfile('analytics');

    expect(trading?.maxPlatformLatencyMs).toBeLessThanOrEqual(500);
    expect(market?.maxPlatformLatencyMs).toBeLessThanOrEqual(250);
    expect(analytics?.maxPlatformLatencyMs).toBeGreaterThanOrEqual(1000);
  });
});
