import { describe, it, expect } from 'vitest';
import {
  TransactionStateMachine,
  TransactionLifecycleState,
} from '../state-machine';

describe('Deterministic Transaction Lifecycle State Machine', () => {
  it('initializes a transaction in CREATED state', () => {
    const tx = TransactionStateMachine.createTransaction({
      id: 'tx_001',
      userId: 'user_01',
      walletAddress: 'So11111111111111111111111111111111111111112',
      symbol: '$SENT',
      side: 'buy',
      amountIn: '1.5',
      minAmountOut: '35000',
    });

    expect(tx.state).toBe('CREATED');
    expect(tx.history.length).toBe(1);
    expect(tx.history[0].to).toBe('CREATED');
  });

  it('progresses through valid 7-stage happy path transitions', () => {
    const tx = TransactionStateMachine.createTransaction({
      id: 'tx_happy',
      userId: 'user_01',
      walletAddress: 'So11111111111111111111111111111111111111112',
      symbol: '$SENT',
      side: 'buy',
      amountIn: '1.0',
      minAmountOut: '20000',
    });

    // 1. CREATED -> SIMULATING
    TransactionStateMachine.transition(tx, 'SIMULATING');
    expect(tx.state).toBe('SIMULATING');

    // 2. SIMULATING -> AUTHORIZED
    TransactionStateMachine.transition(tx, 'AUTHORIZED');
    expect(tx.state).toBe('AUTHORIZED');

    // 3. AUTHORIZED -> SIGNED
    TransactionStateMachine.transition(tx, 'SIGNED');
    expect(tx.state).toBe('SIGNED');

    // 4. SIGNED -> SUBMITTED
    TransactionStateMachine.transition(tx, 'SUBMITTED', { txHash: '0xmockhash123' });
    expect(tx.state).toBe('SUBMITTED');
    expect(tx.txHash).toBe('0xmockhash123');

    // 5. SUBMITTED -> PENDING
    TransactionStateMachine.transition(tx, 'PENDING');
    expect(tx.state).toBe('PENDING');

    // 6. PENDING -> CONFIRMED
    TransactionStateMachine.transition(tx, 'CONFIRMED');
    expect(tx.state).toBe('CONFIRMED');
    expect(tx.completedAt).toBeDefined();
    expect(tx.history.length).toBe(7); // 1 init + 6 transitions
  });

  it('rejects illegal state jumps with an error', () => {
    const tx = TransactionStateMachine.createTransaction({
      id: 'tx_illegal',
      userId: 'user_01',
      walletAddress: 'So11111111111111111111111111111111111111112',
      symbol: '$SENT',
      side: 'buy',
      amountIn: '1.0',
      minAmountOut: '20000',
    });

    // Attempt to jump from CREATED directly to CONFIRMED
    expect(() => TransactionStateMachine.transition(tx, 'CONFIRMED')).toThrow(
      "Invalid transaction state transition from 'CREATED' to 'CONFIRMED'."
    );

    // Attempt to jump from CREATED to SIGNED
    expect(() => TransactionStateMachine.transition(tx, 'SIGNED')).toThrow(
      "Invalid transaction state transition from 'CREATED' to 'SIGNED'."
    );
  });

  it('handles simulation failure transition', () => {
    const tx = TransactionStateMachine.createTransaction({
      id: 'tx_sim_fail',
      userId: 'user_01',
      walletAddress: 'So11111111111111111111111111111111111111112',
      symbol: '$SENT',
      side: 'buy',
      amountIn: '1.0',
      minAmountOut: '20000',
    });

    TransactionStateMachine.transition(tx, 'SIMULATING');
    TransactionStateMachine.transition(tx, 'SIMULATION_FAILED', {
      reason: 'Slippage tolerance exceeded in Raydium pool',
    });

    expect(tx.state).toBe('SIMULATION_FAILED');
    expect(tx.error).toBe('Slippage tolerance exceeded in Raydium pool');
    expect(tx.completedAt).toBeDefined();
  });
});
