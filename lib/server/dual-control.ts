/**
 * Dual-control approval workflow (Sprint 30 — Tier 3).
 *
 * The real, non-theatrical core of "two people must agree" is the
 * self-approval guard in `approve()` — a single admin proposing and then
 * approving their own request is rejected outright. Everything else here is
 * bookkeeping around that one guarantee. In-memory, `globalThis`-guarded.
 */

import { generateId } from './id';

export type ApprovalAction = 'PAUSE_TRADING' | 'RESUME_TRADING' | 'PAUSE_LAUNCHPAD' | 'RESUME_LAUNCHPAD';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface ApprovalRequest {
  id: string;
  action: ApprovalAction;
  requestedBy: string;
  requestedAt: string;
  status: ApprovalStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  reason: string;
  expiresAt: string;
}

const TTL_MS = 30 * 60 * 1000;

class DualControlStore {
  private requestsById = new Map<string, ApprovalRequest>();

  propose(action: ApprovalAction, requestedBy: string, reason: string): ApprovalRequest {
    const now = new Date();
    const request: ApprovalRequest = {
      id: generateId('appr'),
      action,
      requestedBy,
      requestedAt: now.toISOString(),
      status: 'PENDING',
      approvedBy: null,
      approvedAt: null,
      reason,
      expiresAt: new Date(now.getTime() + TTL_MS).toISOString(),
    };
    this.requestsById.set(request.id, request);
    return request;
  }

  get(id: string): ApprovalRequest | undefined {
    const request = this.requestsById.get(id);
    if (request && request.status === 'PENDING' && Date.parse(request.expiresAt) < Date.now()) {
      request.status = 'EXPIRED';
    }
    return request;
  }

  approve(id: string, approvedBy: string): ApprovalRequest {
    const request = this.get(id);
    if (!request) throw new Error('Approval request not found.');
    if (request.status !== 'PENDING') throw new Error(`Approval request is already ${request.status.toLowerCase()}.`);
    if (request.requestedBy === approvedBy) {
      throw new Error('The account that proposed this action cannot also approve it — a second, distinct admin is required.');
    }

    request.status = 'APPROVED';
    request.approvedBy = approvedBy;
    request.approvedAt = new Date().toISOString();
    return request;
  }

  reject(id: string, rejectedBy: string): ApprovalRequest {
    const request = this.get(id);
    if (!request) throw new Error('Approval request not found.');
    if (request.status !== 'PENDING') throw new Error(`Approval request is already ${request.status.toLowerCase()}.`);

    request.status = 'REJECTED';
    request.approvedBy = rejectedBy;
    request.approvedAt = new Date().toISOString();
    return request;
  }

  listPending(): ApprovalRequest[] {
    return [...this.requestsById.values()]
      .map((request) => this.get(request.id)!) // refresh expiry status
      .filter((request) => request.status === 'PENDING')
      .sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt));
  }
}

const globalForDualControl = globalThis as unknown as { dualControlStore?: DualControlStore };
export const dualControlStore = globalForDualControl.dualControlStore ?? new DualControlStore();
if (process.env.NODE_ENV !== 'production') globalForDualControl.dualControlStore = dualControlStore;
