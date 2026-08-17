/**
 * Enterprise Dual-Control Approval Engine (Sprint 39 §6, §77).
 * Strictly guarantees that sensitive high-risk operations cannot be executed
 * by a single admin acting alone. Anti-self-approval is strictly enforced.
 */

import { DualApprovalActionType, DualApprovalProposal, DualApprovalStatus, AdminRole } from './types';
import { adminAuditService } from './audit';

const PROPOSAL_TTL_MS = 30 * 60 * 1000; // 30 minutes

export class AdminDualApprovalEngine {
  private static instance: AdminDualApprovalEngine;
  private proposals: Map<string, DualApprovalProposal> = new Map();

  private constructor() {
    this.seedDemoProposals();
  }

  public static getInstance(): AdminDualApprovalEngine {
    if (!AdminDualApprovalEngine.instance) {
      AdminDualApprovalEngine.instance = new AdminDualApprovalEngine();
    }
    return AdminDualApprovalEngine.instance;
  }

  /**
   * Propose a critical administrative action for secondary review.
   */
  public propose(opts: {
    actionType: DualApprovalActionType;
    payload: Record<string, any>;
    requestedBy: string;
    requestedByRole: AdminRole;
    reason: string;
  }): DualApprovalProposal {
    const now = new Date();
    const id = `prop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const proposal: DualApprovalProposal = {
      id,
      actionType: opts.actionType,
      payload: opts.payload,
      requestedBy: opts.requestedBy,
      requestedByRole: opts.requestedByRole,
      requestedAt: now.toISOString(),
      reason: opts.reason,
      status: 'PENDING',
      approvedBy: null,
      approvedByRole: null,
      approvedAt: null,
      rejectionReason: null,
      expiresAt: new Date(now.getTime() + PROPOSAL_TTL_MS).toISOString(),
      executedAt: null,
    };

    this.proposals.set(id, proposal);

    // Audit the creation of the proposal
    adminAuditService.record({
      actorId: opts.requestedBy,
      actorRole: opts.requestedByRole,
      action: 'DUAL_APPROVAL_PROPOSED',
      domain: 'system',
      resourceType: 'dual_approval_proposal',
      resourceId: id,
      reason: opts.reason,
      changesAfter: { actionType: opts.actionType, payload: opts.payload },
    });

    return proposal;
  }

  /**
   * Approve and execute a pending proposal.
   * STRICT GUARD: The proposing admin CANNOT approve their own proposal.
   */
  public approve(opts: {
    proposalId: string;
    approvedBy: string;
    approvedByRole: AdminRole;
  }): DualApprovalProposal {
    const proposal = this.getProposal(opts.proposalId);
    if (!proposal) {
      throw new Error(`Proposal with ID "${opts.proposalId}" not found.`);
    }

    if (proposal.status !== 'PENDING') {
      throw new Error(`Proposal cannot be approved: current status is ${proposal.status}.`);
    }

    // STRICT SELF-APPROVAL GUARD
    if (proposal.requestedBy === opts.approvedBy) {
      throw new Error(
        'Dual Control Violation: The proposing admin cannot self-approve their own request. A distinct second admin is required.'
      );
    }

    const now = new Date().toISOString();
    proposal.status = 'APPROVED';
    proposal.approvedBy = opts.approvedBy;
    proposal.approvedByRole = opts.approvedByRole;
    proposal.approvedAt = now;
    proposal.executedAt = now;

    // Record Immutable Audit Log
    adminAuditService.record({
      actorId: opts.approvedBy,
      actorRole: opts.approvedByRole,
      action: 'DUAL_APPROVAL_APPROVED_AND_EXECUTED',
      domain: 'system',
      resourceType: 'dual_approval_proposal',
      resourceId: proposal.id,
      reason: `Dual approval granted for ${proposal.actionType} originally proposed by ${proposal.requestedBy}`,
      changesBefore: { status: 'PENDING' },
      changesAfter: { status: 'APPROVED', executedAt: now },
    });

    return proposal;
  }

  /**
   * Reject a pending proposal.
   */
  public reject(opts: {
    proposalId: string;
    rejectedBy: string;
    rejectedByRole: AdminRole;
    rejectionReason: string;
  }): DualApprovalProposal {
    const proposal = this.getProposal(opts.proposalId);
    if (!proposal) {
      throw new Error(`Proposal with ID "${opts.proposalId}" not found.`);
    }

    if (proposal.status !== 'PENDING') {
      throw new Error(`Proposal cannot be rejected: current status is ${proposal.status}.`);
    }

    proposal.status = 'REJECTED';
    proposal.approvedBy = opts.rejectedBy;
    proposal.approvedByRole = opts.rejectedByRole;
    proposal.rejectionReason = opts.rejectionReason;

    adminAuditService.record({
      actorId: opts.rejectedBy,
      actorRole: opts.rejectedByRole,
      action: 'DUAL_APPROVAL_REJECTED',
      domain: 'system',
      resourceType: 'dual_approval_proposal',
      resourceId: proposal.id,
      reason: opts.rejectionReason,
      changesBefore: { status: 'PENDING' },
      changesAfter: { status: 'REJECTED', rejectionReason: opts.rejectionReason },
    });

    return proposal;
  }

  public getProposal(id: string): DualApprovalProposal | undefined {
    const prop = this.proposals.get(id);
    if (prop && prop.status === 'PENDING' && Date.parse(prop.expiresAt) < Date.now()) {
      prop.status = 'EXPIRED';
    }
    return prop;
  }

  public listPending(): DualApprovalProposal[] {
    return Array.from(this.proposals.values())
      .map((p) => this.getProposal(p.id)!)
      .filter((p) => p.status === 'PENDING')
      .sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt));
  }

  public listAll(): DualApprovalProposal[] {
    return Array.from(this.proposals.values())
      .map((p) => this.getProposal(p.id)!)
      .sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt));
  }

  public reset(): void {
    this.proposals.clear();
    this.seedDemoProposals();
  }

  private seedDemoProposals(): void {
    const now = Date.now();
    this.proposals.set('prop_demo_treasury_01', {
      id: 'prop_demo_treasury_01',
      actionType: 'TREASURY_TRANSFER',
      payload: {
        amountSol: 1500,
        destinationAddress: '7xK99zK8mP2xQ5wN3a19',
        purpose: 'Liquidity Protection Reserve Top-up',
      },
      requestedBy: 'admin_finance_01',
      requestedByRole: 'FINANCE',
      requestedAt: new Date(now - 15 * 60 * 1000).toISOString(),
      reason: 'Scheduled liquidity rebalancing for newly launched tokens',
      status: 'PENDING',
      approvedBy: null,
      approvedByRole: null,
      approvedAt: null,
      rejectionReason: null,
      expiresAt: new Date(now + 15 * 60 * 1000).toISOString(),
      executedAt: null,
    });
  }
}

export const adminDualApprovalEngine = AdminDualApprovalEngine.getInstance();
