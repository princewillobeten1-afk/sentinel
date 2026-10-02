import { describe, it, expect } from 'vitest';
import { GET, POST, DELETE, PATCH } from '../route';

describe('/api/v1/tracked-wallets API', () => {
  it('GET returns success with tracked wallets array', async () => {
    const req = new Request('http://localhost/api/v1/tracked-wallets');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
  });

  it('POST rejects invalid short or malformed Solana address', async () => {
    const req = new Request('http://localhost/api/v1/tracked-wallets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: 'invalid_short',
        label: 'Bad Address',
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain('Invalid Solana wallet address');
  });

  it('POST tracks a valid 44-character Solana address', async () => {
    const validAddr = '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1';
    const req = new Request('http://localhost/api/v1/tracked-wallets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: validAddr,
        label: 'Alpha Trench Lead',
        category: 'SMART_MONEY',
        notes: 'Consistent 80%+ win rate',
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.address).toBe(validAddr);
    expect(json.data.label).toBe('Alpha Trench Lead');
  });

  it('PATCH updates nickname and category', async () => {
    const validAddr = '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1';
    const req = new Request('http://localhost/api/v1/tracked-wallets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: validAddr,
        updates: { label: 'Updated Alpha Lead', category: 'WHALE' },
      }),
    });

    const res = await PATCH(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.label).toBe('Updated Alpha Lead');
    expect(json.data.category).toBe('WHALE');
  });

  it('DELETE untracks address successfully', async () => {
    const validAddr = '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1';
    const req = new Request(`http://localhost/api/v1/tracked-wallets?address=${validAddr}`, {
      method: 'DELETE',
    });

    const res = await DELETE(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });
});
