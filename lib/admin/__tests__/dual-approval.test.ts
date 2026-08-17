import { describe, it, expect, beforeEach } from 'vitest';
import { adminDualApprovalEngine } from '../dual-approval';

describe('Enterprise Dual-Approval Governance (Sprint 39 §6, §77)', () => {
  beforeEach(() => {
    adminDualApprovalEngine.reset();
  });

  it('creates a proposal in PENDING status with TTL expiration', () => {
    const proposal = adminDualApprovalEngine.propose({
      actionType: 'GLOBAL_TRADING_PAUSE',
      payload: { reason: 'Severe market volatility anomaly' },
      requestedBy: 'admin_a',
      requestedByRole: 'TRADING_OPERATIONS',
      reason: 'Safety halt on new trade executions',
    });

    expect(proposal.id).toBeDefined();
    expect(proposal.status).toBe('PENDING');
    expect(proposal.requestedBy).toBe('admin_a');
    expect(Date.parse(proposal.expiresAt)).toBeGreaterThan(Date.now());
  });

  it('STRICTLY REJECTS self-approval when proposing admin attempts to approve their own request', () => {
    const proposal = adminDualApprovalEngine.propose({
      actionType: 'TREASURY_TRANSFER',
      payload: { amountSol: 1000, to: '7xK9...3a19' },
      requestedBy: 'admin_alice',
      requestedByRole: 'FINANCE',
      reason: 'Monthly operational disbursement',
    });

    expect(() => {
      adminDualApprovalEngine.approve({
        proposalId: proposal.id,
        approvedBy: 'admin_alice', // Same admin!
        approvedByRole: 'SUPER_ADMIN',
      });
    }).toThrow(/The proposing admin cannot self-approve/);
  });

  it('successfully approves and executes when reviewed by a distinct second administrator', () => {
    const proposal = adminDualApprovalEngine.propose({
      actionType: 'FEE_RATE_CHANGE',
      payload: { newFee: 0.25 },
      requestedBy: 'admin_alice',
      requestedByRole: 'FINANCE',
      reason: 'Competitiveness fee cut',
    });

    const approved = adminDualApprovalEngine.approve({
      proposalId: proposal.id,
      approvedBy: 'admin_bob', // Distinct admin!
      approvedByRole: 'SUPER_ADMIN',
    });

    expect(approved.status).toBe('APPROVED');
    expect(approved.approvedBy).toBe('admin_bob');
    expect(approved.executedAt).toBeDefined();
  });

  it('rejects a proposal and records rejection reason', () => {
    const proposal = adminDualApprovalEngine.propose({
      actionType: 'RISK_ENGINE_GLOBAL_OVERRIDE',
      payload: { disableSlippageCap: true },
      requestedBy: 'admin_alice',
      requestedByRole: 'RISK_ANALYST',
      reason: 'Temporary test',
    });

    const rejected = adminDualApprovalEngine.reject({
      proposalId: proposal.id,
      rejectedBy: 'admin_bob',
      rejectedByRole: 'SUPER_ADMIN',
      rejectionReason: 'Too dangerous for production environment',
    });

    expect(rejected.status).toBe('REJECTED');
    expect(rejected.rejectionReason).toContain('Too dangerous');
  });
});
