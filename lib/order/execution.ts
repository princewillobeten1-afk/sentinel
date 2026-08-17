import { TransactionService } from '../transaction/service';
import { TransactionIntent, TransactionStatus, TransactionRecord } from '../transaction/simulator';
import { WalletProvider } from '../wallet/provider';
import { RouteOption } from './route';

export interface ExecutionResult {
  status: 'FILLED' | 'PARTIALLY_FILLED' | 'FAILED' | 'REJECTED';
  transactionHash?: string;
  error?: string;
  filledAmount?: string;
  executionPrice?: number;
}

export class OrderExecutionEngine {
  private transactionService: TransactionService;

  constructor(transactionService: TransactionService) {
    this.transactionService = transactionService;
  }

  async execute(
    wallet: WalletProvider,
    intent: TransactionIntent,
    route: RouteOption,
    onStatusChange: (status: TransactionStatus, record: TransactionRecord) => void
  ): Promise<ExecutionResult> {
    
    // In a real implementation, we would build the specific raw transaction
    // required by the chosen route's DEX contract.
    const mockRawTransaction = {
      to: 'DEX_ROUTER',
      data: '0x...',
      value: '0'
    };

    try {
      const record = await this.transactionService.executeTransaction(
        wallet,
        mockRawTransaction,
        intent,
        onStatusChange
      );

      if (record.status === 'CONFIRMED') {
        return {
          status: 'FILLED',
          transactionHash: record.transactionHash,
          filledAmount: route.expectedOutput,
          executionPrice: route.executionPrice
        };
      } else if (record.status === 'USER_REJECTED') {
         return {
           status: 'REJECTED',
           error: record.error
         };
      } else {
        return {
          status: 'FAILED',
          transactionHash: record.transactionHash,
          error: record.error || 'Transaction failed'
        };
      }
    } catch (err: any) {
      return {
        status: 'FAILED',
        error: err.message || 'Unknown execution error'
      };
    }
  }
}
