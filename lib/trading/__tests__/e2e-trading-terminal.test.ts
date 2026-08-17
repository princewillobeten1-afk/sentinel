import { describe, it, expect, beforeEach } from 'vitest';
import { masterWalletProvider } from '../../wallet/wallet-provider';
import { tokenSearchEngine } from '../../market-data/rankings/search-engine';
import { tokenDiscoveryPipeline } from '../../market-data/discovery/token-discovery-pipeline';
import { quoteService } from '../../quote/quote-service';
import { executionService } from '../../execution/execution-service';

describe('Sprint 46 End-to-End Trading Terminal Fixture Test (§98)', () => {
  beforeEach(() => {
    masterWalletProvider.reset();
    quoteService.reset();
    executionService.reset();
  });

  it('completes full flow: Connect Wallet -> Search Token -> Get Quote -> Preview -> Simulate -> Sign -> Submit -> Finalize', async () => {
    // 1. Connect Wallet
    const wallet = await masterWalletProvider.connect('solana');
    expect(wallet.address).toBeDefined();
    expect(masterWalletProvider.getState()).toBe('CONNECTED');

    // 2. Search for Token
    const searchResults = tokenSearchEngine.search('SOL');
    expect(searchResults.items.length).toBeGreaterThan(0);
    const targetToken = searchResults.items[0];

    // 3. Inspect Token Profile
    const token = tokenDiscoveryPipeline.getToken(targetToken.tokenId);
    expect(token).toBeDefined();
    expect(token?.status).toBe('ACTIVE');

    // 4. Request Authoritative Quote
    const quote = await quoteService.getQuote({
      chainId: 'solana',
      inputToken: 'SOL',
      outputToken: targetToken.tokenId,
      amount: '1.5',
      slippage: 0.5,
    });

    expect(quote.id).toBeDefined();
    expect(parseFloat(quote.outputAmount)).toBeGreaterThan(0);
    expect(quote.isValid).toBe(true);
    expect(quote.priceImpactRating).toBeDefined();

    // 5. Transaction Preview & Preparation
    const { intent, preparedTx } = await executionService.prepareTransaction({
      userId: 'user_e2e',
      walletAddress: wallet.address,
      quoteId: quote.id,
    });

    expect(intent.intentId).toBeDefined();
    expect(preparedTx.simulationRequired).toBe(true);

    // 6. Pre-flight Simulation
    const sim = await executionService.simulateTransaction(intent.intentId);
    expect(sim.success).toBe(true);
    expect(sim.estimatedGasUnits).toBeGreaterThan(0);

    // 7. Wallet Signature Boundary (mocked provider signature)
    const signature = await masterWalletProvider.signTransaction(preparedTx);
    expect(signature).toBeDefined();

    // 8. Submission & Confirmation
    const submission = await executionService.submitTransaction({
      intentId: intent.intentId,
      signatureHexOrBase58: signature,
    });

    expect(submission.status).toBe('CONFIRMED');
    expect(submission.txHash).toBeDefined();

    // 9. Verify Final Transaction State
    const finalTx = executionService.getTransactionStatus(intent.intentId);
    expect(finalTx?.state).toBe('CONFIRMED');
    expect(finalTx?.completedAt).toBeDefined();
  });
});
