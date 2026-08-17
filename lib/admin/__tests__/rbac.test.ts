import { describe, it, expect } from 'vitest';
import { AdminRbacEngine, ROLE_PERMISSIONS, ALL_PERMISSIONS } from '../rbac';
import { AdminRole } from '../types';

describe('Admin RBAC Engine (Sprint 39 §3-6, §74)', () => {
  it('SUPER_ADMIN possesses all granular domain permissions', () => {
    for (const perm of ALL_PERMISSIONS) {
      expect(AdminRbacEngine.hasPermission('SUPER_ADMIN', perm)).toBe(true);
    }
  });

  it('TRADING_OPERATIONS possesses trading/token/launchpad permissions but lacks treasury/security management', () => {
    expect(AdminRbacEngine.hasPermission('TRADING_OPERATIONS', 'trading.pause')).toBe(true);
    expect(AdminRbacEngine.hasPermission('TRADING_OPERATIONS', 'tokens.restrict')).toBe(true);
    expect(AdminRbacEngine.hasPermission('TRADING_OPERATIONS', 'launchpad.pause')).toBe(true);

    expect(AdminRbacEngine.hasPermission('TRADING_OPERATIONS', 'treasury.manage')).toBe(false);
    expect(AdminRbacEngine.hasPermission('TRADING_OPERATIONS', 'incidents.manage')).toBe(false);
    expect(AdminRbacEngine.hasPermission('TRADING_OPERATIONS', 'users.terminate')).toBe(false);
  });

  it('FINANCE possesses treasury & fee permissions but lacks token freeze or incident creation', () => {
    expect(AdminRbacEngine.hasPermission('FINANCE', 'treasury.view')).toBe(true);
    expect(AdminRbacEngine.hasPermission('FINANCE', 'treasury.manage')).toBe(true);
    expect(AdminRbacEngine.hasPermission('FINANCE', 'fees.modify')).toBe(true);

    expect(AdminRbacEngine.hasPermission('FINANCE', 'tokens.freeze')).toBe(false);
    expect(AdminRbacEngine.hasPermission('FINANCE', 'incidents.manage')).toBe(false);
    expect(AdminRbacEngine.hasPermission('FINANCE', 'system.emergency')).toBe(false);
  });

  it('assertPermission throws an informative error when access is forbidden', () => {
    expect(() => {
      AdminRbacEngine.assertPermission('SUPPORT', 'treasury.manage', 'transfer protocol funds');
    }).toThrow(/Access Denied/);
  });

  it('normalizeRole accurately parses strings and case variations to valid AdminRole', () => {
    expect(AdminRbacEngine.normalizeRole('super_admin')).toBe('SUPER_ADMIN');
    expect(AdminRbacEngine.normalizeRole('Trading_Ops')).toBe('TRADING_OPERATIONS');
    expect(AdminRbacEngine.normalizeRole('compliance')).toBe('COMPLIANCE');
    expect(AdminRbacEngine.normalizeRole('unknown_role')).toBe('READ_ONLY');
  });
});
