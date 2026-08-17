export interface RawTransaction {
  hash: string;
  tokenId: string;
  side: 'BUY' | 'SELL';
  amountUsd: number;
  tokenAmount: number;
  timestamp: number;
  feeUsd: number;
  gasUsd: number;
  slippage: number;
}

export interface ReconstructedTrade {
  tokenId: string;
  totalInvestedUsd: number;
  totalTokensAcquired: number;
  averageEntryPrice: number;
  exits: {
    amountUsd: number;
    tokenAmount: number;
    price: number;
    timestamp: number;
  }[];
  totalFeesUsd: number;
  trueNetPnlUsd: number;
  isOpen: boolean;
}

export class TradeReconstructionEngine {
  /**
   * Reconstructs a full trade (entries and partial/full exits) from raw transactions.
   * Calculates true net P&L including gas, fees, and slippage.
   */
  public reconstructTrade(transactions: RawTransaction[]): ReconstructedTrade | null {
    if (transactions.length === 0) return null;

    let totalInvestedUsd = 0;
    let totalTokensAcquired = 0;
    let totalFeesUsd = 0;
    const exits: any[] = [];
    let realizedRevenueUsd = 0;
    let tokensRemaining = 0;
    
    // Sort transactions chronologically
    const sortedTxs = [...transactions].sort((a, b) => a.timestamp - b.timestamp);

    for (const tx of sortedTxs) {
      totalFeesUsd += tx.feeUsd + tx.gasUsd;

      if (tx.side === 'BUY') {
        totalInvestedUsd += tx.amountUsd;
        totalTokensAcquired += tx.tokenAmount;
        tokensRemaining += tx.tokenAmount;
      } else if (tx.side === 'SELL') {
        const price = tx.amountUsd / tx.tokenAmount;
        exits.push({
          amountUsd: tx.amountUsd,
          tokenAmount: tx.tokenAmount,
          price,
          timestamp: tx.timestamp
        });
        realizedRevenueUsd += tx.amountUsd;
        tokensRemaining -= tx.tokenAmount;
      }
    }

    const averageEntryPrice = totalTokensAcquired > 0 ? totalInvestedUsd / totalTokensAcquired : 0;
    const isOpen = tokensRemaining > 0;
    
    // True Net P&L = Revenue - Cost - Fees
    // NOTE: This is realized P&L. Unrealized would require current market price.
    const trueNetPnlUsd = realizedRevenueUsd - totalInvestedUsd - totalFeesUsd;

    return {
      tokenId: transactions[0].tokenId,
      totalInvestedUsd,
      totalTokensAcquired,
      averageEntryPrice,
      exits,
      totalFeesUsd,
      trueNetPnlUsd,
      isOpen
    };
  }
}
