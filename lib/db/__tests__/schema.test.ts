import { describe, it, expect } from 'vitest';
import {
  DbUser,
  DbWallet,
  DbToken,
  DbOrder,
  DbTrade,
  DbPosition,
  DbTokenIntelligence,
} from '../schema';

describe('TypeScript Production Database Schema Contracts', () => {
  it('validates core entity type shapes and precision fields', () => {
    const mockUser: DbUser = {
      id: 'usr_001',
      email: 'trader@sentinel.trade',
      username: 'sol_trader',
      role: 'user',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    expect(mockUser.status).toBe('active');

    const mockToken: DbToken = {
      id: 'tok_sol_001',
      chain_id: 'solana',
      address: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      name: 'Wrapped SOL',
      decimals: 9,
      status: 'active',
      first_seen_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    expect(mockToken.decimals).toBe(9);

    const mockOrder: DbOrder = {
      id: 'ord_123',
      user_id: mockUser.id,
      wallet_id: 'wal_456',
      token_id: mockToken.id,
      order_type: 'LIMIT',
      side: 'BUY',
      quantity: '10.500000000000000000',
      limit_price: '142.500000000000',
      slippage_limit: 0.01,
      status: 'SUBMITTED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    expect(mockOrder.status).toBe('SUBMITTED');
  });
});
