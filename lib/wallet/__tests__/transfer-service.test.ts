import { describe, it, expect, beforeEach } from 'vitest';
import { transferService } from '../transfer-service';
import { adminEmergencyEngine } from '@/lib/admin/emergency';
import { eventBus } from '@/lib/events/bus';

describe('TransferService (Crypto Deposit & Withdraw)', () => {
  const userId = 'user_001';
  const solanaWallet = '7xK99zK8mP2xQ5wN3a19';
  const validSolanaDest = '8wJ33nN9pQ4xV6bM2c18';
  const validEvmDest = '0x71C8418320473879172438376b2669b07BF4c48B';

  beforeEach(() => {
    transferService.reset();
    adminEmergencyEngine.reset();
  });

  describe('Address Validation', () => {
    it('validates correct Solana Base58 addresses', () => {
      expect(transferService.validateDestinationAddress('8wJ33nN9pQ4xV6bM2c18', 'solana')).toBe(true);
      expect(transferService.validateDestinationAddress('So11111111111111111111111111111111111111112', 'solana')).toBe(true);
      // Solana Base58 strictly excludes '0', 'O', 'I', 'l'
      expect(transferService.validateDestinationAddress('invalid_with_0_chars0', 'solana')).toBe(false);
      expect(transferService.validateDestinationAddress('', 'solana')).toBe(false);
    });

    it('validates correct EVM Hex addresses', () => {
      expect(transferService.validateDestinationAddress(validEvmDest, 'ethereum')).toBe(true);
      expect(transferService.validateDestinationAddress(validEvmDest, 'base')).toBe(true);
      expect(transferService.validateDestinationAddress('0xinvalid_evm_not_hex', 'ethereum')).toBe(false);
      expect(transferService.validateDestinationAddress('0x123', 'base')).toBe(false);
    });
  });

  describe('Deposit Handling', () => {
    it('generates deposit details and QR payload', () => {
      const details = transferService.getDepositDetails(solanaWallet, 'solana', 'SOL');
      expect(details.walletAddress).toBe(solanaWallet);
      expect(details.network).toBe('solana');
      expect(details.asset).toBe('SOL');
      expect(details.minimumDeposit).toBe(0.01);
      expect(details.qrPayload).toBe(`solana:${solanaWallet}`);
      expect(details.confirmationsRequired).toBe(1);
    });

    it('simulates inbound crypto deposit and updates balance', async () => {
      const initialBalance = transferService.getBalance(userId, solanaWallet, 'SOL');

      const tx = await transferService.simulateDeposit(userId, {
        walletId: 'w_001',
        walletAddress: solanaWallet,
        asset: 'SOL',
        amount: 5.0,
        network: 'solana',
        sourceAddress: 'Binance Hot Wallet',
      });

      expect(tx.direction).toBe('DEPOSIT');
      expect(tx.amount).toBe(5.0);
      expect(tx.status).toBe('CONFIRMED');

      const newBalance = transferService.getBalance(userId, solanaWallet, 'SOL');
      expect(newBalance).toBe(initialBalance + 5.0);
    });
  });

  describe('Withdrawal Execution', () => {
    it('executes a valid withdrawal and deducts balance & fee', async () => {
      transferService.setBalance(userId, solanaWallet, 'SOL', 10.0);

      const result = await transferService.executeWithdrawal(userId, {
        walletId: 'w_001',
        walletAddress: solanaWallet,
        destinationAddress: validSolanaDest,
        asset: 'SOL',
        amount: 2.0,
        network: 'solana',
        priorityFeeTier: 'fast',
      });

      expect(result.success).toBe(true);
      expect(result.grossAmount).toBe(2.0);
      expect(result.fee).toBe(0.00005);
      expect(result.destinationAddress).toBe(validSolanaDest);

      const remainingBalance = transferService.getBalance(userId, solanaWallet, 'SOL');
      expect(remainingBalance).toBeCloseTo(10.0 - (2.0 + 0.00005), 5);
    });

    it('rejects withdrawal if balance is insufficient for amount + fee', async () => {
      transferService.setBalance(userId, solanaWallet, 'SOL', 1.0);

      await expect(
        transferService.executeWithdrawal(userId, {
          walletId: 'w_001',
          walletAddress: solanaWallet,
          destinationAddress: validSolanaDest,
          asset: 'SOL',
          amount: 2.0,
          network: 'solana',
        })
      ).rejects.toThrow(/Insufficient balance/);
    });

    it('rejects withdrawal to own address', async () => {
      transferService.setBalance(userId, solanaWallet, 'SOL', 10.0);

      await expect(
        transferService.executeWithdrawal(userId, {
          walletId: 'w_001',
          walletAddress: solanaWallet,
          destinationAddress: solanaWallet,
          asset: 'SOL',
          amount: 1.0,
          network: 'solana',
        })
      ).rejects.toThrow(/Destination address cannot be the same as your sending address/);
    });

    it('rejects withdrawal when emergency pause is active', async () => {
      transferService.setBalance(userId, solanaWallet, 'SOL', 10.0);
      adminEmergencyEngine.setKillSwitch('pauseWithdrawals', true, {
        updatedBy: 'admin-test',
        updatedByRole: 'SUPER_ADMIN',
        reason: 'Emergency test lock',
      });

      await expect(
        transferService.executeWithdrawal(userId, {
          walletId: 'w_001',
          walletAddress: solanaWallet,
          destinationAddress: validSolanaDest,
          asset: 'SOL',
          amount: 1.0,
          network: 'solana',
        })
      ).rejects.toThrow(/Withdrawals are temporarily paused/);
    });
  });

  describe('Transaction History', () => {
    it('returns records of deposits and withdrawals', async () => {
      transferService.setBalance(userId, solanaWallet, 'SOL', 20.0);

      await transferService.simulateDeposit(userId, {
        walletId: 'w_001',
        walletAddress: solanaWallet,
        asset: 'SOL',
        amount: 3.0,
        network: 'solana',
      });

      await transferService.executeWithdrawal(userId, {
        walletId: 'w_001',
        walletAddress: solanaWallet,
        destinationAddress: validSolanaDest,
        asset: 'SOL',
        amount: 1.5,
        network: 'solana',
      });

      const history = await transferService.getTransactionHistory(userId, 'w_001');
      expect(history.length).toBe(2);
      expect(history.some((tx) => tx.direction === 'DEPOSIT')).toBe(true);
      expect(history.some((tx) => tx.direction === 'WITHDRAWAL')).toBe(true);
    });
  });
});
