/**
 * Crypto Deposit & Withdrawal Transfer Service (Sprint 44+ Wallet Operations).
 *
 * Implements:
 *   - Deposit address generation & network parameters
 *   - Withdrawal execution with balance verification & fee calculations
 *   - Address format validation (Solana Base58 & EVM hex)
 *   - Emergency kill-switch enforcement (pauseWithdrawals)
 *   - Storage in wallet_transactions table & in-memory store
 *   - Real-time event broadcasting (wallet.activity, wallet.balance_updated)
 */

import { SupportedChain } from '@/lib/blockchain/types';
import { eventBus } from '@/lib/events/bus';
import { logger } from '@/lib/server/logger';
import { adminEmergencyEngine } from '@/lib/admin/emergency';
import { pgWalletTransactionRepository } from '@/lib/server/db/wallet-transaction-repository';
import { isPostgresConfigured } from '@/lib/server/db/pool';
import { serverStore } from '@/lib/server/store';

export type CryptoAsset = 'SOL' | 'USDC' | 'ETH' | string;
export type PriorityFeeTier = 'normal' | 'fast' | 'turbo';

export interface DepositDetails {
  walletAddress: string;
  network: SupportedChain;
  asset: CryptoAsset;
  minimumDeposit: number;
  confirmationsRequired: number;
  qrPayload: string;
  networkNotice: string;
}

export interface WithdrawalRequest {
  walletId: string;
  walletAddress: string;
  destinationAddress: string;
  asset: CryptoAsset;
  amount: number;
  network: SupportedChain;
  priorityFeeTier?: PriorityFeeTier;
}

export interface WithdrawalResult {
  success: boolean;
  transactionId: string;
  signature: string;
  asset: CryptoAsset;
  grossAmount: number;
  fee: number;
  netAmount: number;
  network: SupportedChain;
  destinationAddress: string;
  timestamp: string;
}

export interface DepositSimulationRequest {
  walletId: string;
  walletAddress: string;
  asset: CryptoAsset;
  amount: number;
  network: SupportedChain;
  sourceAddress?: string;
}

export interface WalletTransactionItem {
  id: string;
  userId: string;
  walletId: string;
  direction: 'DEPOSIT' | 'WITHDRAWAL' | 'SEND' | 'RECEIVE';
  asset: CryptoAsset;
  amount: number;
  destinationAddress?: string;
  sourceAddress?: string;
  signature: string;
  network: SupportedChain;
  fee?: number;
  status: 'CONFIRMED' | 'PENDING' | 'FAILED';
  createdAt: string;
}

export class TransferService {
  private static instance: TransferService;

  // In-memory fallback balance tracker: key is `${userId}:${walletAddress.toLowerCase()}:${asset}`
  private inMemoryBalances: Map<string, number> = new Map();
  // In-memory transaction log
  private inMemoryTransactions: WalletTransactionItem[] = [];

  private constructor() {
    // Seed initial demo balances
    this.inMemoryBalances.set('user_001:7xk99zk8mp2xq5wn3a19:SOL', 42.85);
    this.inMemoryBalances.set('user_001:7xk99zk8mp2xq5wn3a19:USDC', 12500.0);
    this.inMemoryBalances.set('user_001:7xk99zk8mp2xq5wn3a19:ETH', 2.5);

    this.inMemoryBalances.set('user_001:3mr88xk1pq99zw5a71b2:SOL', 18.4);
    this.inMemoryBalances.set('user_001:3mr88xk1pq99zw5a71b2:USDC', 4500.0);
  }

  public static getInstance(): TransferService {
    if (!TransferService.instance) {
      TransferService.instance = new TransferService();
    }
    return TransferService.instance;
  }

  private getBalanceKey(userId: string, walletAddress: string, asset: CryptoAsset): string {
    return `${userId}:${walletAddress.toLowerCase()}:${asset.toUpperCase()}`;
  }

  public getBalance(userId: string, walletAddress: string, asset: CryptoAsset): number {
    const key = this.getBalanceKey(userId, walletAddress, asset);
    if (!this.inMemoryBalances.has(key)) {
      // Default initial balance if not yet tracked
      const def = asset.toUpperCase() === 'SOL' ? 10.0 : asset.toUpperCase() === 'USDC' ? 1000.0 : 1.0;
      this.inMemoryBalances.set(key, def);
    }
    return this.inMemoryBalances.get(key) || 0;
  }

  public setBalance(userId: string, walletAddress: string, asset: CryptoAsset, amount: number): void {
    const key = this.getBalanceKey(userId, walletAddress, asset);
    this.inMemoryBalances.set(key, Math.max(0, amount));
  }

  /**
   * Validates address format based on destination blockchain network.
   */
  public validateDestinationAddress(address: string, network: SupportedChain): boolean {
    if (!address || typeof address !== 'string') return false;
    const clean = address.trim();

    if (network === 'solana') {
      // Solana Base58 public key check (20 to 44 characters, strictly no 0, O, I, l)
      return /^[1-9A-HJ-NP-Za-km-z]{20,44}$/.test(clean);
    } else if (network === 'ethereum' || network === 'base') {
      // EVM 0x hex address (0x + 40 hex chars)
      return /^0x[a-fA-F0-9]{40}$/.test(clean);
    }

    return clean.length >= 20;
  }

  /**
   * Estimates network gas/priority fee for a withdrawal.
   */
  public estimateWithdrawalFee(network: SupportedChain, asset: CryptoAsset, tier: PriorityFeeTier = 'normal'): number {
    if (network === 'solana') {
      if (tier === 'turbo') return 0.00015;
      if (tier === 'fast') return 0.00005;
      return 0.000005; // Normal SOL fee (5000 lamports)
    } else if (network === 'base') {
      if (tier === 'turbo') return 0.0001;
      if (tier === 'fast') return 0.00005;
      return 0.00002; // Base L2 ETH fee
    } else {
      // Ethereum mainnet
      if (tier === 'turbo') return 0.004;
      if (tier === 'fast') return 0.0025;
      return 0.0015; // Ethereum mainnet ETH fee
    }
  }

  /**
   * Retrieves deposit instructions, QR payload, and network parameters.
   */
  public getDepositDetails(walletAddress: string, network: SupportedChain = 'solana', asset: CryptoAsset = 'SOL'): DepositDetails {
    const minDep = asset.toUpperCase() === 'SOL' ? 0.01 : asset.toUpperCase() === 'USDC' ? 1.0 : 0.005;
    const confirmations = network === 'solana' ? 1 : network === 'base' ? 5 : 12;

    let qrPayload = walletAddress;
    if (network === 'solana') {
      qrPayload = `solana:${walletAddress}`;
    } else if (network === 'ethereum' || network === 'base') {
      qrPayload = `ethereum:${walletAddress}`;
    }

    return {
      walletAddress,
      network,
      asset,
      minimumDeposit: minDep,
      confirmationsRequired: confirmations,
      qrPayload,
      networkNotice: `Send only ${asset} to this address via ${network.toUpperCase()} network. Deposits from other networks or assets cannot be recovered.`,
    };
  }

  /**
   * Executes a cryptocurrency withdrawal from the user's wallet.
   */
  public async executeWithdrawal(userId: string, req: WithdrawalRequest): Promise<WithdrawalResult> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Withdrawal requires a wallet-signed transaction; simulated signatures are disabled.');
    }
    // 1. Check emergency kill switch
    const emergencyState = adminEmergencyEngine.getState();
    if (emergencyState.killSwitches.pauseWithdrawals || emergencyState.mode === 'FULL_EMERGENCY') {
      throw new Error('Withdrawals are temporarily paused by protocol security controls.');
    }

    // 2. Validate destination address
    if (!this.validateDestinationAddress(req.destinationAddress, req.network)) {
      throw new Error(`Invalid destination ${req.network.toUpperCase()} address format.`);
    }

    if (req.destinationAddress.toLowerCase() === req.walletAddress.toLowerCase()) {
      throw new Error('Destination address cannot be the same as your sending address.');
    }

    if (req.amount <= 0) {
      throw new Error('Withdrawal amount must be greater than zero.');
    }

    // 3. Compute network fee & verify balance
    const tier = req.priorityFeeTier || 'normal';
    const fee = this.estimateWithdrawalFee(req.network, req.asset, tier);

    const currentBalance = this.getBalance(userId, req.walletAddress, req.asset);
    const requiredTotal = req.asset.toUpperCase() === (req.network === 'solana' ? 'SOL' : 'ETH')
      ? req.amount + fee
      : req.amount;

    if (currentBalance < requiredTotal) {
      throw new Error(
        `Insufficient balance. Available: ${currentBalance.toFixed(4)} ${req.asset}, required: ${requiredTotal.toFixed(4)} ${req.asset} (including fee).`
      );
    }

    // 4. Deduct balance
    const newBalance = currentBalance - requiredTotal;
    this.setBalance(userId, req.walletAddress, req.asset, newBalance);

    // 5. Generate transaction signature & record
    const signature = req.network === 'solana'
      ? `5wTx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      : `0xwith_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const txItem: WalletTransactionItem = {
      id: `wtx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      walletId: req.walletId,
      direction: 'WITHDRAWAL',
      asset: req.asset,
      amount: req.amount,
      destinationAddress: req.destinationAddress,
      signature,
      network: req.network,
      fee,
      status: 'CONFIRMED',
      createdAt: new Date().toISOString(),
    };

    this.inMemoryTransactions.unshift(txItem);

    // Persist to Postgres if configured
    if (isPostgresConfigured()) {
      try {
        await pgWalletTransactionRepository.recordWalletTransaction(userId, {
          walletId: req.walletId,
          direction: 'SEND',
          asset: req.asset as any,
          amount: req.amount,
          destinationAddress: req.destinationAddress,
          signature,
          network: req.network,
          feeLamports: req.network === 'solana' ? Math.round(fee * 1e9) : undefined,
        });
      } catch (err: any) {
        logger.debug(`[TRANSFER_SERVICE] Postgres persistence fallback: ${err.message}`);
      }
    }

    // 6. Broadcast realtime events across platform
    await eventBus.publish({
      eventId: `evt_with_${txItem.id}`,
      eventType: 'wallet.activity',
      version: '1',
      chain: req.network,
      timestamp: txItem.createdAt,
      source: 'wallet_transfer_service',
      payload: {
        userId,
        walletAddress: req.walletAddress,
        activityType: 'OUTGOING_TRANSFER',
        destinationAddress: req.destinationAddress,
        amount: req.amount,
        asset: req.asset,
        transactionHash: signature,
      },
    });

    await eventBus.publish({
      eventId: `evt_bal_${txItem.id}`,
      eventType: 'wallet.balance_updated',
      version: '1',
      chain: req.network,
      timestamp: txItem.createdAt,
      source: 'wallet_transfer_service',
      payload: {
        userId,
        walletAddress: req.walletAddress,
        chainId: req.network,
        asset: req.asset,
        delta: -req.amount,
        newBalance,
      },
    });

    logger.info(
      `[WITHDRAWAL] User ${userId} withdrew ${req.amount} ${req.asset} to ${req.destinationAddress} (${req.network})`
    );

    return {
      success: true,
      transactionId: txItem.id,
      signature,
      asset: req.asset,
      grossAmount: req.amount,
      fee,
      netAmount: req.amount,
      network: req.network,
      destinationAddress: req.destinationAddress,
      timestamp: txItem.createdAt,
    };
  }

  /**
   * Simulates an inbound deposit for devnet, test, and interactive user flows.
   */
  public async simulateDeposit(userId: string, req: DepositSimulationRequest): Promise<WalletTransactionItem> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Simulated deposits are disabled outside tests.');
    }
    if (req.amount <= 0) {
      throw new Error('Deposit amount must be greater than zero.');
    }

    // Increment balance
    const currentBalance = this.getBalance(userId, req.walletAddress, req.asset);
    const newBalance = currentBalance + req.amount;
    this.setBalance(userId, req.walletAddress, req.asset, newBalance);

    const signature = req.network === 'solana'
      ? `5dep_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      : `0xdep_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const txItem: WalletTransactionItem = {
      id: `wtx_dep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      walletId: req.walletId,
      direction: 'DEPOSIT',
      asset: req.asset,
      amount: req.amount,
      sourceAddress: req.sourceAddress || 'External Exchange / Wallet',
      destinationAddress: req.walletAddress,
      signature,
      network: req.network,
      status: 'CONFIRMED',
      createdAt: new Date().toISOString(),
    };

    this.inMemoryTransactions.unshift(txItem);

    // Broadcast events
    await eventBus.publish({
      eventId: `evt_dep_${txItem.id}`,
      eventType: 'wallet.activity',
      version: '1',
      chain: req.network,
      timestamp: txItem.createdAt,
      source: 'wallet_transfer_service',
      payload: {
        userId,
        walletAddress: req.walletAddress,
        activityType: 'INCOMING_TRANSFER',
        sourceAddress: txItem.sourceAddress,
        amount: req.amount,
        asset: req.asset,
        transactionHash: signature,
      },
    });

    await eventBus.publish({
      eventId: `evt_bal_dep_${txItem.id}`,
      eventType: 'wallet.balance_updated',
      version: '1',
      chain: req.network,
      timestamp: txItem.createdAt,
      source: 'wallet_transfer_service',
      payload: {
        userId,
        walletAddress: req.walletAddress,
        chainId: req.network,
        asset: req.asset,
        delta: req.amount,
        newBalance,
      },
    });

    logger.info(`[DEPOSIT_SIMULATION] User ${userId} deposited ${req.amount} ${req.asset} on ${req.network}`);

    return txItem;
  }

  /**
   * Retrieves transaction history for the user.
   */
  public async getTransactionHistory(userId: string, walletId?: string): Promise<WalletTransactionItem[]> {
    let list = this.inMemoryTransactions.filter((tx) => tx.userId === userId);
    if (walletId) {
      list = list.filter((tx) => tx.walletId === walletId);
    }
    return list;
  }

  public reset(): void {
    this.inMemoryBalances.clear();
    this.inMemoryTransactions = [];
    this.inMemoryBalances.set('user_001:7xk99zk8mp2xq5wn3a19:SOL', 42.85);
    this.inMemoryBalances.set('user_001:7xk99zk8mp2xq5wn3a19:USDC', 12500.0);
    this.inMemoryBalances.set('user_001:7xk99zk8mp2xq5wn3a19:ETH', 2.5);
  }
}

export const transferService = TransferService.getInstance();
