import { describe, it, expect, beforeEach } from 'vitest';
import { swapExecutionEngine } from '../engine';
import { quoteService } from '../../quote/quote-service';
import { masterWalletProvider } from '../../wallet/wallet-provider';
import { dbRepository } from '../../db/repository';

describe('Sprint 47 End-to-End Swap Execution Pipeline Fixture (§100)', () => {
  beforeEach(() => {
    swapExecutionEngine.reset();
    quoteService.reset();
    masterWalletProvider.reset();
    dbRepository.reset();
  });

  it('executes full pipeline: Quote -> Validate -> Build -> Simulate -> Sign -> Broadcast -> Monitor -> Finalize -> Receipt', async () => {
    // 1. Connect User Wallet
    const wallet = await masterWalletProvider.connect('solana');
    expect(wallet.address).toBeDefined();

    // 2. Request Authoritative Server Quote
    const quote = await quoteService.getQuote({
      chainId: 'solana',
      inputToken: 'SOL',
      outputToken: 'So11111111111111111111111111111111111111112',
      amount: '2.0',
      slippage: 0.5,
    });

    expect(quote.id).toBeDefined();
    expect(quote.isValid).toBe(true);

    // 3. Initiate & Prepare Swap Execution (Validate -> Route -> Simulate -> Build)
    const prep = await swapExecutionEngine.prepareExecution({
      idempotencyKey: 'idemp_e2e_swap_01',
      userId: 'user_e2e',
      walletAddress: wallet.address,
      chainId: 'solana',
      tokenIn: 'SOL',
      tokenOut: 'So11111111111111111111111111111111111111112',
      amountIn: '2.0',
      slippage: 0.5,
      quoteId: quote.id,
    });

    expect(prep.executionId).toBeDefined();
    expect(prep.status).toBe('READY_FOR_SIGNATURE');
    expect(prep.simulation.success).toBe(true);
    expect(prep.gasEstimate.sufficientNativeBalance).toBe(true);
    expect(prep.intent.payload).toBeDefined();

    // 4. User Wallet Signs Unsigned Payload
    const signature = await masterWalletProvider.signTransaction(prep.intent.payload);
    expect(signature).toBeDefined();

    // 5. Submit Signed Payload (Broadcast -> Monitor -> Reconcile -> Receipt)
    const finalize = await swapExecutionEngine.submitAndConfirmExecution({
      executionId: prep.executionId,
      signedPayload: signature,
    });

    expect(finalize.status).toBe('CONFIRMED');
    expect(finalize.transactionHash).toBeDefined();
    expect(finalize.confirmation.isConfirmed).toBe(true);
    expect(finalize.receipt).toBeDefined();
    expect(finalize.receipt?.effectivePrice).toBeDefined();
    expect(finalize.quality).toBeDefined();

    // 6. Verify Execution Record in Database
    const dbExec = dbRepository.getExecution(prep.executionId);
    expect(dbExec?.status).toBe('CONFIRMED');
    expect(dbExec?.actual_output).toBeDefined();

    // 7. Verify Audit Trail Events
    const events = dbRepository.getExecutionEvents(prep.executionId);
    expect(events.length).toBeGreaterThanOrEqual(5);
    expect(events.map((e) => e.event_type)).toContain('execution.created');
    expect(events.map((e) => e.event_type)).toContain('execution.submitted');
    expect(events.map((e) => e.event_type)).toContain('execution.confirmed');
  });
});
