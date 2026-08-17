/**
 * Role enforcement (Sprint 30 — Tier 3).
 *
 * `AuthUser.role` has existed since an early sprint but was never actually
 * checked anywhere in the codebase — any route could be hit by any
 * authenticated user regardless of role. This is the first real enforcement.
 */

import { ApiError } from './errors';
import { requireAuth, type AuthUser } from './auth';

export function requireRole(user: AuthUser, allowed: AuthUser['role'][]): void {
  if (!allowed.includes(user.role)) {
    throw new ApiError(`This action requires one of these roles: ${allowed.join(', ')}.`, 403, 'ROLE_FORBIDDEN', {
      requiredRoles: allowed,
      actualRole: user.role,
    });
  }
}

/** `requireAuth` + role check in one call, for admin-only routes. */
export async function requireAdmin(request: Request): Promise<AuthUser> {
  const user = await requireAuth(request);
  requireRole(user, ['admin']);
  return user;
}
