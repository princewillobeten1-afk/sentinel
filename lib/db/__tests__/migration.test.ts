import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('PostgreSQL Migration DDL File Validation', () => {
  it('verifies that 013_production_data_model.sql exists and contains all 16 domain table definitions', () => {
    const migrationPath = path.resolve(process.cwd(), 'db/migrations/013_production_data_model.sql');
    expect(fs.existsSync(migrationPath)).toBe(true);

    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    // Verify key domain tables
    const requiredTables = [
      'users',
      'user_profiles',
      'user_settings',
      'wallets',
      'chains',
      'tokens',
      'creators',
      'token_holders',
      'wallet_clusters',
      'effective_ownership',
      'liquidity_pools',
      'dexes',
      'trades',
      'blockchain_transactions',
      'token_intelligence',
      'orders',
      'positions',
      'portfolios',
      'alerts',
      'notifications',
      'copy_strategies',
      'launchpads',
      'api_keys',
      'audit_logs',
      'ai_models',
    ];

    for (const table of requiredTables) {
      expect(sqlContent).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }

    // Verify key unique constraints and performance indexes
    expect(sqlContent).toContain('uq_token_chain_address');
    expect(sqlContent).toContain('uq_pool_chain_address');
    expect(sqlContent).toContain('idx_users_email');
    expect(sqlContent).toContain('idx_trades_token_time');
    expect(sqlContent).toContain('idx_orders_user_status');
  });
});
