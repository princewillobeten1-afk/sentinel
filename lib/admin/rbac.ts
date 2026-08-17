/**
 * Enterprise Role-Based Access Control (RBAC) Engine (Sprint 39 §3-6, §74).
 * Governs 11 operational roles, granular domain permissions, and role validation.
 */

import { AdminRole, AdminPermission, PermissionDomain } from './types';

export const ALL_PERMISSIONS: AdminPermission[] = [
  // Users
  'users.view',
  'users.manage',
  'users.restrict',
  'users.terminate',
  // Trading
  'trading.view',
  'trading.cancel',
  'trading.pause',
  // Tokens
  'tokens.view',
  'tokens.restrict',
  'tokens.freeze',
  // Wallets
  'wallets.view',
  'wallets.flag',
  // Launchpad
  'launchpad.view',
  'launchpad.manage',
  'launchpad.pause',
  // Finance
  'treasury.view',
  'treasury.manage',
  'fees.modify',
  // Security
  'security.view',
  'incidents.manage',
  // AI
  'ai.view',
  'ai.manage',
  // Analytics
  'analytics.view',
  'analytics.export',
  // System
  'system.view',
  'system.config',
  'system.emergency',
  // Support
  'support.view',
  'support.act',
];

/**
 * Static Role to Permission Mapping
 */
export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  SUPER_ADMIN: [...ALL_PERMISSIONS],
  ADMIN: [
    'users.view',
    'users.manage',
    'users.restrict',
    'users.terminate',
    'trading.view',
    'trading.cancel',
    'trading.pause',
    'tokens.view',
    'tokens.restrict',
    'tokens.freeze',
    'wallets.view',
    'wallets.flag',
    'launchpad.view',
    'launchpad.manage',
    'launchpad.pause',
    'treasury.view',
    'treasury.manage',
    'fees.modify',
    'security.view',
    'incidents.manage',
    'ai.view',
    'ai.manage',
    'analytics.view',
    'analytics.export',
    'system.view',
    'system.config',
    'system.emergency',
    'support.view',
    'support.act',
  ],
  TRADING_OPERATIONS: [
    'trading.view',
    'trading.cancel',
    'trading.pause',
    'tokens.view',
    'tokens.restrict',
    'tokens.freeze',
    'wallets.view',
    'wallets.flag',
    'launchpad.view',
    'launchpad.manage',
    'launchpad.pause',
    'analytics.view',
    'system.view',
    'support.view',
  ],
  RISK_ANALYST: [
    'users.view',
    'users.restrict',
    'trading.view',
    'tokens.view',
    'tokens.restrict',
    'wallets.view',
    'wallets.flag',
    'launchpad.view',
    'security.view',
    'incidents.manage',
    'ai.view',
    'analytics.view',
    'analytics.export',
    'support.view',
  ],
  COMPLIANCE: [
    'users.view',
    'users.manage',
    'users.restrict',
    'trading.view',
    'tokens.view',
    'tokens.restrict',
    'wallets.view',
    'wallets.flag',
    'launchpad.view',
    'security.view',
    'incidents.manage',
    'analytics.view',
    'analytics.export',
    'support.view',
  ],
  SUPPORT: [
    'users.view',
    'users.manage',
    'trading.view',
    'tokens.view',
    'wallets.view',
    'launchpad.view',
    'support.view',
    'support.act',
  ],
  MODERATOR: [
    'users.view',
    'tokens.view',
    'tokens.restrict',
    'support.view',
    'support.act',
  ],
  FINANCE: [
    'users.view',
    'trading.view',
    'treasury.view',
    'treasury.manage',
    'fees.modify',
    'analytics.view',
    'analytics.export',
  ],
  ANALYST: [
    'users.view',
    'trading.view',
    'tokens.view',
    'wallets.view',
    'launchpad.view',
    'ai.view',
    'analytics.view',
    'analytics.export',
  ],
  DEVELOPER: [
    'users.view',
    'trading.view',
    'tokens.view',
    'wallets.view',
    'launchpad.view',
    'ai.view',
    'ai.manage',
    'analytics.view',
    'system.view',
    'system.config',
  ],
  READ_ONLY: [
    'users.view',
    'trading.view',
    'tokens.view',
    'wallets.view',
    'launchpad.view',
    'security.view',
    'ai.view',
    'analytics.view',
    'system.view',
    'support.view',
  ],
};

export class AdminRbacEngine {
  /**
   * Check if a role possesses a specific permission.
   */
  public static hasPermission(role: AdminRole, permission: AdminPermission): boolean {
    if (role === 'SUPER_ADMIN') return true;
    const permissions = ROLE_PERMISSIONS[role] || [];
    return permissions.includes(permission);
  }

  /**
   * Check if a role possesses all of the specified permissions.
   */
  public static hasAllPermissions(role: AdminRole, permissions: AdminPermission[]): boolean {
    return permissions.every((p) => this.hasPermission(role, p));
  }

  /**
   * Check if a role possesses at least one of the specified permissions.
   */
  public static hasAnyPermission(role: AdminRole, permissions: AdminPermission[]): boolean {
    return permissions.some((p) => this.hasPermission(role, p));
  }

  /**
   * Retrieve all permissions granted to a given role.
   */
  public static getPermissionsForRole(role: AdminRole): AdminPermission[] {
    return [...(ROLE_PERMISSIONS[role] || [])];
  }

  /**
   * Guard function: throws an error if permission check fails.
   */
  public static assertPermission(role: AdminRole, permission: AdminPermission, actionDescription?: string): void {
    if (!this.hasPermission(role, permission)) {
      const desc = actionDescription ? ` to ${actionDescription}` : '';
      throw new Error(`Access Denied: Role "${role}" lacks required permission "${permission}"${desc}.`);
    }
  }

  /**
   * Map legacy/simple roles ('admin' | 'user' | 'analyst') to full AdminRole.
   */
  public static normalizeRole(rawRole: string | undefined): AdminRole {
    if (!rawRole) return 'READ_ONLY';
    const upper = rawRole.toUpperCase();
    if (upper === 'SUPER_ADMIN' || upper === 'SUPERADMIN') return 'SUPER_ADMIN';
    if (upper === 'ADMIN') return 'ADMIN';
    if (upper === 'TRADING_OPERATIONS' || upper === 'TRADING_OPS') return 'TRADING_OPERATIONS';
    if (upper === 'RISK_ANALYST' || upper === 'RISK') return 'RISK_ANALYST';
    if (upper === 'COMPLIANCE') return 'COMPLIANCE';
    if (upper === 'SUPPORT') return 'SUPPORT';
    if (upper === 'MODERATOR') return 'MODERATOR';
    if (upper === 'FINANCE') return 'FINANCE';
    if (upper === 'ANALYST') return 'ANALYST';
    if (upper === 'DEVELOPER' || upper === 'DEV') return 'DEVELOPER';
    if (upper === 'READ_ONLY') return 'READ_ONLY';
    return 'READ_ONLY';
  }
}
