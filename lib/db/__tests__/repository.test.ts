import { describe, it, expect, beforeEach } from 'vitest';
import { ProductionDatabaseRepository } from '../repository';
import { DbUser, DbWallet, DbToken, DbOrder, DbTrade } from '../schema';

describe('Production Database Repository & ACID Access Layer', () => {
  let repo: ProductionDatabaseRepository;

  beforeEach(() => {
    repo = ProductionDatabaseRepository.getInstance();
    repo.reset();
  });

  it('enforces foreign key integrity when linking wallets to users', async () => {
    // Should fail because user does not exist
    await expect(
      repo.linkWallet({
        id: 'wal_001',
        user_id: 'non_existent_user',
        chain: 'solana',
        address: '7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoZNUJnm',
        wallet_type: 'external',
        is_primary: true,
      })
    ).rejects.toThrow('Foreign key violation');

    // Create valid user first
    const user = await repo.createUser({
      id: 'usr_valid_01',
      email: 'alice@sentinel.trade',
      username: 'alice_trades',
      role: 'user',
      status: 'active',
    });

    const wallet = await repo.linkWallet({
      id: 'wal_001',
      user_id: user.id,
      chain: 'solana',
      address: '7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoZNUJnm',
      wallet_type: 'external',
      is_primary: true,
    });

    expect(wallet.user_id).toBe(user.id);
    const userWallets = await repo.getWalletsByUserId(user.id);
    expect(userWallets.length).toBe(1);
  });

  it('guarantees idempotency when placing orders with duplicate Idempotency-Key', async () => {
    const user = await repo.createUser({
      id: 'usr_trader_99',
      email: 'bob@sentinel.trade',
      role: 'user',
      status: 'active',
    });

    const orderData: Omit<DbOrder, 'created_at' | 'updated_at'> = {
      id: 'ord_idem_001',
      user_id: user.id,
      wallet_id: 'wal_bob',
      token_id: 'tok_sol',
      order_type: 'LIMIT',
      side: 'BUY',
      quantity: '500',
      limit_price: '142.50',
      slippage_limit: 0.01,
      status: 'CREATED',
    };

    const first = await repo.createOrder(orderData, 'idem_key_unique_123');
    const second = await repo.createOrder(orderData, 'idem_key_unique_123');

    expect(first.id).toBe(second.id);
    expect(first.created_at).toBe(second.created_at);
  });

  it('executes atomic order fill, trade recording, position upsert, and audit logging', async () => {
    const user = await repo.createUser({
      id: 'usr_trader_88',
      email: 'carol@sentinel.trade',
      role: 'user',
      status: 'active',
    });

    const order = await repo.createOrder({
      id: 'ord_fill_001',
      user_id: user.id,
      wallet_id: 'wal_carol',
      token_id: 'tok_sol',
      order_type: 'MARKET',
      side: 'BUY',
      quantity: '10',
      slippage_limit: 0.01,
      status: 'SUBMITTED',
    });

    const mockTrade: DbTrade = {
      id: 'trd_exec_001',
      chain_id: 'solana',
      transaction_hash: '5Kj8xWv...',
      block_number: 289104000,
      pool_id: 'pool_raydium_01',
      token_in: 'tok_usdc',
      token_out: 'tok_sol',
      trader_address: 'wal_carol_pubkey',
      amount_in: '1425.00',
      amount_out: '10.00',
      price: '142.50',
      usd_value: '1425.00',
      timestamp: new Date().toISOString(),
    };

    const {
      order: filledOrder,
      trade,
      position,
    } = await repo.recordExecutionAndTrade({
      orderId: order.id,
      trade: mockTrade,
      execution: { quantity: '10', price: '142.50', fees: '0.005', slippage: 0.005 },
      userId: user.id,
      walletId: 'wal_carol',
    });

    expect(filledOrder.status).toBe('FILLED');
    expect(trade.id).toBe('trd_exec_001');
    expect(position.quantity).toBe('10');

    // Verify audit log entry
    const audits = repo.getAuditLogs(user.id);
    expect(audits.length).toBe(1);
    expect(audits[0].action).toBe('TRADE_EXECUTED');
    expect(audits[0].resource_id).toBe('ord_fill_001');
  });
});
