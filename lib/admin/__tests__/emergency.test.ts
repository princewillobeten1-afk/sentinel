import { describe, it, expect, beforeEach } from 'vitest';
import { adminEmergencyEngine } from '../emergency';

describe('Platform Emergency Switchboard & Circuit Breakers (Sprint 39 §30-31)', () => {
  beforeEach(() => {
    adminEmergencyEngine.reset();
  });

  it('starts in NORMAL mode with all subsystems active', () => {
    const state = adminEmergencyEngine.getState();
    expect(state.mode).toBe('NORMAL');
    expect(adminEmergencyEngine.isTradeAllowed()).toBe(true);
    expect(adminEmergencyEngine.isWithdrawalAllowed()).toBe(true);
    expect(adminEmergencyEngine.isLaunchpadAllowed()).toBe(true);
  });

  it('transitions to TRADING_PAUSED and blocks new orders while preserving withdrawals', () => {
    adminEmergencyEngine.setEmergencyMode({
      mode: 'TRADING_PAUSED',
      updatedBy: 'admin_ops',
      updatedByRole: 'TRADING_OPERATIONS',
      reason: 'Oracle desynchronization alert',
    });

    expect(adminEmergencyEngine.isTradeAllowed()).toBe(false);
    expect(adminEmergencyEngine.isWithdrawalAllowed()).toBe(true);
  });

  it('transitions to FULL_EMERGENCY and locks all trades, withdrawals, and launches', () => {
    adminEmergencyEngine.setEmergencyMode({
      mode: 'FULL_EMERGENCY',
      updatedBy: 'admin_super',
      updatedByRole: 'SUPER_ADMIN',
      reason: 'Critical protocol vulnerability investigation',
    });

    const state = adminEmergencyEngine.getState();
    expect(state.mode).toBe('FULL_EMERGENCY');
    expect(adminEmergencyEngine.isTradeAllowed()).toBe(false);
    expect(adminEmergencyEngine.isWithdrawalAllowed()).toBe(false);
    expect(adminEmergencyEngine.isLaunchpadAllowed()).toBe(false);
    expect(state.killSwitches.pauseWithdrawals).toBe(true);
  });

  it('supports granular targeted kill switches without full mode change', () => {
    adminEmergencyEngine.setKillSwitch('disabledChains', ['base'], {
      updatedBy: 'admin_dev',
      updatedByRole: 'DEVELOPER',
      reason: 'Base sequencer maintenance',
    });

    expect(adminEmergencyEngine.isChainDisabled('base')).toBe(true);
    expect(adminEmergencyEngine.isChainDisabled('solana')).toBe(false);
  });

  it('trips circuit breaker and auto-elevates mode from NORMAL to DEGRADED', () => {
    adminEmergencyEngine.tripCircuitBreaker('rpcPoolCircuitBreaker', 'High latency on Solana RPC');
    const state = adminEmergencyEngine.getState();
    expect(state.mode).toBe('DEGRADED');
    expect(state.circuitBreakers.rpcPoolCircuitBreaker.tripped).toBe(true);
  });
});
