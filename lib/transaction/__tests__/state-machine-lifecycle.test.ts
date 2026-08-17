import { describe, it, expect } from 'vitest';
import { TransactionStateMachine } from '../state-machine';

describe('Deterministic Transaction State Machine (Sprint 46 §46-47)', () => {
  it('enforces valid forward transitions across the 11-stage lifecycle', () => {
    const tx = TransactionStateMachine.createTransaction({
      id: 'tx_lifecycle_test_01',
      userId: 'user_1',
      walletAddress: '0xWallet1',
      symbol: 'SOL',
      side: 'buy',
      amountIn: '10',
      minAmountOut: '1500',
    });

    expect(tx.state).toBe('CREATED');

    TransactionStateMachine.transition(tx, 'SIMULATING');
    expect(tx.state).toBe('SIMULATING');

    TransactionStateMachine.transition(tx, 'AUTHORIZED');
    expect(tx.state).toBe('AUTHORIZED');

    TransactionStateMachine.transition(tx, 'SIGNED');
    expect(tx.state).toBe('SIGNED');

    TransactionStateMachine.transition(tx, 'SUBMITTED');
    expect(tx.state).toBe('SUBMITTED');

    TransactionStateMachine.transition(tx, 'PENDING');
    expect(tx.state).toBe('PENDING');

    TransactionStateMachine.transition(tx, 'CONFIRMED');
    expect(tx.state).toBe('CONFIRMED');
    expect(tx.completedAt).toBeDefined();
  });

  it('strictly rejects invalid state jumps (e.g. CREATED -> CONFIRMED directly)', () => {
    const tx = TransactionStateMachine.createTransaction({
      id: 'tx_invalid_jump_01',
      userId: 'user_1',
      walletAddress: '0xWallet1',
      symbol: 'SOL',
      side: 'buy',
      amountIn: '10',
      minAmountOut: '1500',
    });

    expect(() => {
      TransactionStateMachine.transition(tx, 'CONFIRMED');
    }).toThrow('Invalid transaction state transition');
  });
});
