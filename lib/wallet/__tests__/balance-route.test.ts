import { describe, it, expect } from 'vitest';
import { GET as getBalance } from '@/app/api/v1/wallet/balance/route';
import { NextRequest } from 'next/server';

describe('GET /api/v1/wallet/balance — Real-Time Solana Balance API', () => {
  it('rejects requests without an address query parameter with 400', async () => {
    const req = new NextRequest('http://localhost/api/v1/wallet/balance');
    const res = await getBalance(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.message).toMatch(/address is required/i);
  });

  it('rejects invalid Solana base58 addresses with 400', async () => {
    const req = new NextRequest('http://localhost/api/v1/wallet/balance?address=not-a-valid-address');
    const res = await getBalance(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.message).toMatch(/invalid solana base58 address/i);
  });

  it('queries on-chain balance for a valid Solana public key', async () => {
    const targetAddress = 'C468C8s5awDSbmeRpWobrk6zxxSxFPJ9K9sBhinuu4sv';
    const req = new NextRequest(`http://localhost/api/v1/wallet/balance?address=${targetAddress}`);
    const res = await getBalance(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.address).toBe(targetAddress);
    expect(typeof json.data.lamports).toBe('number');
    expect(typeof json.data.sol).toBe('number');
    expect(json.data.sol).toBeGreaterThanOrEqual(0);
    expect(json.data.network).toBeDefined();
    expect(json.data.timestamp).toBeDefined();
  });
});
