import { describe, it, expect, beforeEach } from 'vitest';
import {
  BlockchainReconciliationEngine,
  OnChainTxState,
} from '../engine';
import { TransactionStateMachine } from '../../transaction/state-machine';

describe('Eventual Blockchain Reconciliation Engine', () => {
  beforeEach(() => {
    BlockchainReconciliationEngine.reset();
  });

  it('corrects false-positive CONFIRMED state when on-chain state is failed', () => {
    const tx = TransactionStateMachine.createTransaction({
      id: 'tx_discrepancy_01',
      userId: 'user_bob',
      walletAddress: 'So11111111111111111111111111111111111111112',
      symbol: '$SENT',
      side: 'buy',
      amountIn: '2.0',
      minAmountOut: '40000',
    });

    // Step through to CONFIRMED
    TransactionStateMachine.transition(tx, 'SIMULATING');
    TransactionStateMachine.transition(tx, 'AUTHORIZED');
    TransactionStateMachine.transition(tx, 'SIGNED');
    TransactionStateMachine.transition(tx, 'SUBMITTED', { txHash: '0xfailedOnChain123' });
    TransactionStateMachine.transition(tx, 'PENDING');
    TransactionStateMachine.transition(tx, 'CONFIRMED');

    expect(tx.state).toBe('CONFIRMED');

    // On-chain scan reveals transaction reverted / failed on Solana
    const onChainState: OnChainTxState = {
      txHash: '0xfailedOnChain123',
      status: 'failed',
      err: 'InstructionError: Custom(6001) - SlippageExceeded',
    };

    const result = BlockchainReconciliationEngine.reconcileTransaction(tx, onChainState);

    expect(result.reconciled).toBe(true);
    expect(result.discrepancy).toBeDefined();
    expect(result.discrepancy?.discrepancyType).toBe('INTERNAL_CONFIRMED_ONCHAIN_FAILED');
    expect(tx.state).toBe('RECONCILED_CORRECTION');
    expect(BlockchainReconciliationEngine.getDiscrepancies().length).toBe(1);
  });

  it('reconciles stuck PENDING transaction when on-chain state is confirmed', () => {
    const tx = TransactionStateMachine.createTransaction({
      id: 'tx_stuck_pending',
      userId: 'user_alice',
      walletAddress: 'So11111111111111111111111111111111111111112',
      symbol: '$SENT',
      side: 'buy',
      amountIn: '1.0',
      minAmountOut: '20000',
    });

    TransactionStateMachine.transition(tx, 'SIMULATING');
    TransactionStateMachine.transition(tx, 'AUTHORIZED');
    TransactionStateMachine.transition(tx, 'SIGNED');
    TransactionStateMachine.transition(tx, 'SUBMITTED', { txHash: '0xsuccessOnChain456' });
    TransactionStateMachine.transition(tx, 'PENDING');

    expect(tx.state).toBe('PENDING');

    // On-chain scan reveals transaction is confirmed on Solana
    const onChainState: OnChainTxState = {
      txHash: '0xsuccessOnChain456',
      status: 'confirmed',
      blockHeight: 289104915,
    };

    const result = BlockchainReconciliationEngine.reconcileTransaction(tx, onChainState);

    expect(result.reconciled).toBe(true);
    expect(result.discrepancy?.discrepancyType).toBe('INTERNAL_PENDING_ONCHAIN_CONFIRMED');
    expect(tx.state).toBe('CONFIRMED');
  });
});
