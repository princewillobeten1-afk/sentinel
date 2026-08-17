import { describe, it, expect, beforeEach } from 'vitest';
import { allowanceManager } from '../allowance-manager';
import { dbRepository } from '../../db/repository';

describe('Allowance Manager (Sprint 47 §31-34)', () => {
  beforeEach(() => {
    dbRepository.reset();
  });

  it('recognizes native assets (SOL, ETH) do not require ERC-20 approval', async () => {
    const res = await allowanceManager.checkAllowance(
      '0xWalletAddress',
      'SOL',
      '0xSpenderAddress',
      '10.0'
    );

    expect(res.isApproved).toBe(true);
    expect(res.approvalPayload).toBeUndefined();
  });

  it('detects unapproved ERC-20 token and creates exact bounded approval payload', async () => {
    const res = await allowanceManager.checkAllowance(
      '0xWalletAddress',
      '0xTokenContractAddress',
      '0xSpenderRouter',
      '500.0'
    );

    expect(res.isApproved).toBe(false);
    expect(res.approvalPayload).toBeDefined();
    expect(res.approvalPayload?.amountToApprove).toBe('500.0');
  });

  it('records confirmed token approval and updates state to approved', async () => {
    allowanceManager.recordApproval(
      'user_1',
      '0xWalletAddress',
      '0xTokenContractAddress',
      '0xSpenderRouter',
      '1000.0'
    );

    const res = await allowanceManager.checkAllowance(
      '0xWalletAddress',
      '0xTokenContractAddress',
      '0xSpenderRouter',
      '500.0'
    );

    expect(res.isApproved).toBe(true);
    expect(parseFloat(res.currentAllowance)).toBe(1000.0);
  });
});
