// lib/wallet/engine.ts

import { 
  WalletPermissions, 
  TransactionRequest, 
  TransactionSimulationResult,
  WalletRecord
} from './system-types';

export class WalletSystemEngine {

  /**
   * Evaluates whether a wallet is permitted to execute a requested transaction.
   * This is a critical security boundary.
   */
  public checkPermissions(wallet: WalletRecord, request: TransactionRequest): { allowed: boolean, reason?: string } {
    
    if (wallet.permissions.walletType === 'WATCH_ONLY') {
      return { allowed: false, reason: 'WATCH_ONLY wallets are strictly prohibited from trading or signing transactions.' };
    }

    if (!wallet.permissions.canTrade) {
      return { allowed: false, reason: 'This wallet does not have active trading permissions.' };
    }

    if (wallet.permissions.maxTradeUsd && request.amountUsd > wallet.permissions.maxTradeUsd) {
      return { allowed: false, reason: `Requested amount ($${request.amountUsd}) exceeds maximum trade size limit ($${wallet.permissions.maxTradeUsd}).` };
    }

    return { allowed: true };
  }

  /**
   * Mocks the simulation of a transaction against a blockchain node.
   */
  public async simulateTransaction(wallet: WalletRecord, request: TransactionRequest): Promise<TransactionSimulationResult> {
    
    // Safety check first
    const permCheck = this.checkPermissions(wallet, request);
    if (!permCheck.allowed) {
      return {
        success: false,
        errorMessage: `Permission Denied: ${permCheck.reason}`,
        expectedReceiveUsd: 0,
        priceImpactPct: 0,
        networkFeeUsd: 0,
        route: [],
        contractRisk: 'LOW'
      };
    }

    if (wallet.gasReserveStatus === 'CRITICAL') {
      return {
        success: false,
        errorMessage: 'TRANSACTION SIMULATION FAILED: Insufficient native gas balance to cover network fees.',
        expectedReceiveUsd: 0,
        priceImpactPct: 0,
        networkFeeUsd: 0,
        route: [],
        contractRisk: 'LOW'
      };
    }

    // Mock successful simulation
    const priceImpactPct = Math.random() * 3;
    const networkFeeUsd = 1.25;
    const expectedReceiveUsd = request.amountUsd - (request.amountUsd * (priceImpactPct / 100)) - networkFeeUsd;

    return {
      success: true,
      expectedReceiveUsd,
      priceImpactPct,
      networkFeeUsd,
      route: ['Jupiter Aggregator', 'Orca'],
      contractRisk: 'LOW'
    };
  }

  /**
   * Generates mock connected wallets for the MVP
   */
  public getConnectedWallets(): WalletRecord[] {
    return [
      {
        id: 'w-main',
        address: '0x82...91A',
        chain: 'SOLANA',
        label: 'Main Trading',
        isPrimary: true,
        connectionState: 'CONNECTED',
        permissions: {
          walletType: 'TRADING',
          canTrade: true,
          canTransfer: true,
          canCopyTrade: false,
          canUseAutomation: false,
          maxTradeUsd: 25000
        },
        balances: {
          native: 4.2,
          usdTotal: 42120
        },
        gasReserveStatus: 'HEALTHY'
      },
      {
        id: 'w-degen',
        address: '0x4F...77B',
        chain: 'SOLANA',
        label: 'Degen Wallet',
        isPrimary: false,
        connectionState: 'CONNECTED',
        permissions: {
          walletType: 'TRADING',
          canTrade: true,
          canTransfer: true,
          canCopyTrade: true,
          canUseAutomation: true,
          maxTradeUsd: 2000
        },
        balances: {
          native: 0.1,
          usdTotal: 8420
        },
        gasReserveStatus: 'LOW'
      },
      {
        id: 'w-watch',
        address: '0xABC...123',
        chain: 'SOLANA',
        label: 'Whale Watch',
        isPrimary: false,
        connectionState: 'CONNECTED',
        permissions: {
          walletType: 'WATCH_ONLY',
          canTrade: false,
          canTransfer: false,
          canCopyTrade: false,
          canUseAutomation: false
        },
        balances: {
          native: 124,
          usdTotal: 124300
        },
        gasReserveStatus: 'HEALTHY'
      }
    ];
  }
}
