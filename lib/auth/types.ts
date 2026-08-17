/**
 * Master Authentication & Identity Contracts (Sprint 43).
 */

export type AuthMethod = 'EMAIL' | 'WALLET' | 'GOOGLE' | 'APPLE' | 'PASSKEY';
export type AccountStatus = 'active' | 'suspended' | 'deactivated' | 'deleted' | 'closed' | 'inactive';
export type UserRole = 'user' | 'admin' | 'analyst';
export type WalletStatus = 'active' | 'disconnected' | 'suspended' | 'revoked';
export type SecuritySeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type ChallengeStatus = 'PENDING' | 'USED' | 'EXPIRED';

export interface User {
  id: string;
  email?: string | null;
  displayName: string;
  avatarUrl?: string | null;
  emailVerifiedAt?: string | null;
  status: AccountStatus;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
}

export interface UserSession {
  id: string;
  userId: string;
  tokenHash?: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  revokedReason?: string | null;
}

export interface Wallet {
  id: string;
  userId: string;
  chainId: string;
  address: string;
  label?: string | null;
  isPrimary: boolean;
  status: WalletStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WalletVerification {
  id: string;
  walletId: string;
  challengeId: string;
  verifiedAt: string;
  method: 'SIWS' | 'SIWE';
  metadata?: Record<string, any>;
}

export interface AuthChallenge {
  id: string;
  userId?: string | null;
  walletAddress: string;
  chainId: string;
  nonce: string;
  message: string;
  messageHash?: string;
  expiresAt: string;
  usedAt?: string | null;
  createdAt: string;
}

export interface PasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  usedAt?: string | null;
  createdAt: string;
}

export interface EmailVerificationToken {
  id: string;
  userId: string;
  tokenHash: string;
  newEmail?: string | null;
  expiresAt: string;
  usedAt?: string | null;
  createdAt: string;
}

export interface SecurityAuditEvent {
  id: string;
  userId?: string | null;
  action: string;
  severity: SecuritySeverity;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, any>;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface AuthSessionResponse {
  token: string;
  user: User;
  session: UserSession;
}
