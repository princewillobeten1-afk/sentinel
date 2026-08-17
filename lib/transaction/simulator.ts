import { ChainAdapter } from '../chain/adapter';

export type TransactionStatus = 
  | 'CREATED' 
  | 'PREPARING' 
  | 'SIMULATING' 
  | 'SIMULATED' 
  | 'AWAITING_SIGNATURE' 
  | 'SIGNED' 
  | 'BROADCASTING' 
  | 'SUBMITTED' 
  | 'CONFIRMING' 
  | 'CONFIRMED'
  | 'SIMULATION_FAILED'
  | 'USER_REJECTED'
  | 'SIGNATURE_FAILED'
  | 'BROADCAST_FAILED'
  | 'CONFIRMATION_FAILED'
  | 'EXPIRED'
  | 'UNKNOWN';

export interface TransactionIntent {
  action: 'BUY' | 'SELL' | 'TRANSFER' | 'APPROVE' | 'SWAP' | 'CUSTOM';
  tokenIn?: string;
  tokenOut?: string;
  amountIn: number;
  minAmountOut?: number;
  destination?: string;
  humanReadable: string;
}

export interface TransactionRecord {
  id: string;
  walletAddress: string;
  chainId: string;
  intent: TransactionIntent;
  transactionHash?: string;
  status: TransactionStatus;
  createdAt: number;
  submittedAt?: number;
  confirmedAt?: number;
  error?: string;
}

export class TransactionSimulator {
  private chainAdapter: ChainAdapter;

  constructor(chainAdapter: ChainAdapter) {
    this.chainAdapter = chainAdapter;
  }

  async preflight(transaction: any, intent: TransactionIntent): Promise<{ success: boolean; error?: string; expectedOut?: number; priceImpact?: number }> {
    try {
      const result = await this.chainAdapter.simulateTransaction(transaction);
      
      if (!result.success) {
        return { success: false, error: result.errorReason || 'Simulation failed on chain' };
      }

      // Check intent minimums against simulation
      if (intent.minAmountOut && result.expectedOut && result.expectedOut < intent.minAmountOut) {
        return { 
          success: false, 
          error: `Expected output (${result.expectedOut}) is below minimum required (${intent.minAmountOut}). Possible cause: Pool state changed.` 
        };
      }

      return {
        success: true,
        expectedOut: result.expectedOut,
        priceImpact: result.priceImpact
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Unknown simulation error' };
    }
  }
}
