/**
 * Authorization & Resource Ownership Service (Sprint 43 §40-43, §77).
 *
 * Implements deterministic resource ownership checks and step-up reauthentication.
 */

import { dbRepository } from '../db/repository';
import { identityStore } from './identity-store';
import { UserSession } from './types';
import { ApiError } from '../server/errors';

export class AuthorizationService {
  private static instance: AuthorizationService;

  private constructor() {}

  public static getInstance(): AuthorizationService {
    if (!AuthorizationService.instance) {
      AuthorizationService.instance = new AuthorizationService();
    }
    return AuthorizationService.instance;
  }

  /**
   * Asserts that a user owns the target wallet.
   */
  public async canAccessWallet(userId: string, walletId: string): Promise<boolean> {
    const wallet = await identityStore.getWallet(walletId);
    if (!wallet) return false;
    return wallet.user_id === userId;
  }

  /**
   * Asserts that a user owns the target order.
   */
  public canAccessOrder(userId: string, orderId: string): boolean {
    const order = dbRepository.getOrder(orderId);
    if (!order) return false;
    return order.user_id === userId;
  }

  /**
   * Asserts that a user owns the target session.
   */
  public async canManageSession(userId: string, sessionId: string): Promise<boolean> {
    const session = await identityStore.getSession(sessionId);
    if (!session) return false;
    return session.user_id === userId;
  }

  /**
   * Asserts that a user account is active (not suspended or deleted).
   */
  public async assertUserActive(userId: string): Promise<void> {
    const user = await identityStore.getUser(userId);
    if (!user) {
      throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
    }
    if (user.status === 'suspended') {
      throw new ApiError('Account has been suspended.', 403, 'ACCOUNT_SUSPENDED');
    }
    if (user.status === 'deactivated' || user.status === 'deleted') {
      throw new ApiError('Account has been closed.', 403, 'ACCOUNT_CLOSED');
    }
  }

  /**
   * Enforces step-up reauthentication for sensitive actions if session age exceeds threshold.
   */
  public requireRecentAuthentication(session: UserSession, maxAgeSeconds = 300): void {
    const sessionAgeMs = Date.now() - new Date(session.createdAt).getTime();
    if (sessionAgeMs > maxAgeSeconds * 1000) {
      throw new ApiError(
        'This sensitive action requires recent authentication. Please re-enter your credentials.',
        401,
        'REAUTHENTICATION_REQUIRED'
      );
    }
  }
}

export const authorizationService = AuthorizationService.getInstance();
