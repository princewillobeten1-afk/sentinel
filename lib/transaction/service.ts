import { TransactionRecord, TransactionIntent, TransactionStatus, TransactionSimulator } from './simulator';
import { ChainAdapter } from '../chain/adapter';
import { WalletProvider } from '../wallet/provider';

export class TransactionService {
  private simulator: TransactionSimulator;
  private chainAdapter: ChainAdapter;

  constructor(chainAdapter: ChainAdapter) {
    this.chainAdapter = chainAdapter;
    this.simulator = new TransactionSimulator(chainAdapter);
  }

  createIntent(action: TransactionIntent['action'], details: Partial<TransactionIntent>): TransactionIntent {
    let humanReadable = 'Unknown Transaction';
    if (action === 'BUY' && details.tokenOut) {
      humanReadable = `BUY ${details.amountIn} of ${details.tokenOut}`;
    } else if (action === 'SELL' && details.tokenIn) {
      humanReadable = `SELL ${details.amountIn} ${details.tokenIn} for at least ${details.minAmountOut || 0}`;
    }

    return {
      action,
      amountIn: details.amountIn || 0,
      tokenIn: details.tokenIn,
      tokenOut: details.tokenOut,
      minAmountOut: details.minAmountOut,
      destination: details.destination,
      humanReadable
    };
  }

  async executeTransaction(
    wallet: WalletProvider, 
    transaction: any, 
    intent: TransactionIntent,
    onStatusChange: (status: TransactionStatus, record: TransactionRecord) => void
  ): Promise<TransactionRecord> {
    
    const record: TransactionRecord = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      walletAddress: wallet.getAddress() || '',
      chainId: this.chainAdapter.chainId,
      intent,
      status: 'CREATED',
      createdAt: Date.now()
    };
    
    const updateStatus = (status: TransactionStatus, error?: string) => {
      record.status = status;
      if (error) record.error = error;
      onStatusChange(status, record);
    };

    try {
      updateStatus('PREPARING');
      // Build transaction step would happen here

      updateStatus('SIMULATING');
      const simResult = await this.simulator.preflight(transaction, intent);
      
      if (!simResult.success) {
        updateStatus('SIMULATION_FAILED', simResult.error);
        return record;
      }
      
      updateStatus('SIMULATED');
      updateStatus('AWAITING_SIGNATURE');

      let signedTx;
      try {
        signedTx = await wallet.signTransaction(transaction);
        updateStatus('SIGNED');
      } catch (err: any) {
        updateStatus('USER_REJECTED', 'User rejected signature');
        return record;
      }

      updateStatus('BROADCASTING');
      try {
        record.submittedAt = Date.now();
        const txHash = await this.chainAdapter.broadcastTransaction(signedTx);
        record.transactionHash = txHash;
        updateStatus('SUBMITTED');
      } catch (err: any) {
        updateStatus('BROADCAST_FAILED', err.message);
        return record;
      }

      updateStatus('CONFIRMING');
      // Monitor confirmation status
      // setTimeout mocked confirmation
      record.confirmedAt = Date.now();
      updateStatus('CONFIRMED');

      return record;
    } catch (err: any) {
      updateStatus('UNKNOWN', err.message);
      return record;
    }
  }
}
