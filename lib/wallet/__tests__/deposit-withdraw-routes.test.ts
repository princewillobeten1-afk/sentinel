import { describe, it, expect, beforeEach } from 'vitest';
import { GET as getDeposit, POST as postDeposit } from '@/app/api/v1/wallets/deposit/route';
import { POST as postWithdraw } from '@/app/api/v1/wallets/withdraw/route';
import { GET as getTransactions } from '@/app/api/v1/wallets/transactions/route';
import { transferService } from '../transfer-service';
import { adminEmergencyEngine } from '@/lib/admin/emergency';

describe('Wallet Deposit & Withdraw API Routes', () => {
  const walletAddress = '7xK99zK8mP2xQ5wN3a19';
  const destinationAddress = '8wJ33nN9pQ4xV6bM2c18';

  beforeEach(() => {
    transferService.reset();
    adminEmergencyEngine.reset();
  });

  it('GET /api/v1/wallets/deposit returns deposit instructions and QR payload', async () => {
    const req = new Request(`http://localhost/api/v1/wallets/deposit?address=${walletAddress}&network=solana&asset=SOL`);
    const res = await getDeposit(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.walletAddress).toBe(walletAddress);
    expect(json.data.qrPayload).toBe(`solana:${walletAddress}`);
    expect(json.data.minimumDeposit).toBe(0.01);
  });

  it('POST /api/v1/wallets/deposit cannot credit funds without authentication or an on-chain transfer', async () => {
    const originalBalance = transferService.getBalance('user_001', walletAddress, 'SOL');
    const req = new Request('http://localhost/api/v1/wallets/deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletId: 'w_001',
        walletAddress,
        asset: 'SOL',
        amount: 10.0,
        network: 'solana',
      }),
    });

    const res = await postDeposit(req);
    expect(res.status).toBe(401);
    expect(transferService.getBalance('user_001', walletAddress, 'SOL')).toBe(originalBalance);
  });

  it('POST /api/v1/wallets/withdraw cannot fabricate a confirmed transfer', async () => {
    transferService.setBalance('user_001', walletAddress, 'SOL', 20.0);

    const req = new Request('http://localhost/api/v1/wallets/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletId: 'w_001',
        walletAddress,
        destinationAddress,
        asset: 'SOL',
        amount: 3.5,
        network: 'solana',
        priorityFeeTier: 'turbo',
      }),
    });

    const res = await postWithdraw(req);
    expect(res.status).toBe(401);
    expect(transferService.getBalance('user_001', walletAddress, 'SOL')).toBe(20);
  });

  it('GET /api/v1/wallets/transactions retrieves the transaction history', async () => {
    transferService.setBalance('user_001', walletAddress, 'SOL', 20.0);

    await transferService.simulateDeposit('user_001', {
      walletId: 'w_001',
      walletAddress,
      asset: 'SOL',
      amount: 4.0,
      network: 'solana',
    });

    const req = new Request('http://localhost/api/v1/wallets/transactions?walletId=w_001');
    const res = await getTransactions(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.count).toBeGreaterThan(0);
    expect(json.data.transactions[0].direction).toBe('DEPOSIT');
  });
});
