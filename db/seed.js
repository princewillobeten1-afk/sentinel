/**
 * Development seed data (Phase 1 — Postgres Foundation).
 *
 * Plain CommonJS, same reasoning as `server.js`/`db/migrate.js`.
 *
 * WHY THIS EXISTS: `lib/server/store.ts`'s in-memory fallback seeds a demo
 * user, wallet, and preferences in its constructor, plus two dev-only admin
 * accounts for dual-control flows. A real Postgres database starts empty, so
 * without this the dev-only login (`demo@sentinel.local`) and `demo-token`
 * paths fail outright — `sessions.user_id` has a foreign key to `users(id)`,
 * so creating a session for a user that doesn't exist violates it.
 *
 * ALL DATA HERE IS CLEARLY-MARKED DEVELOPMENT/TEST DATA and is refused in
 * production. Run with `npm run db:seed` after `npm run db:migrate`.
 */

const { Client } = require('pg');

const DEMO_USER_ID = 'user_001';
const DEMO_WALLET_ID = 'w_001';
const DEMO_WALLET_ADDRESS = '7xK99zK8mP2xQ5wN3a19';

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed development data in production.');
    process.exitCode = 1;
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set — cannot seed.');
    process.exitCode = 1;
    return;
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query('BEGIN');

    // Demo trader — mirrors the in-memory seed in lib/server/store.ts.
    await client.query(
      `INSERT INTO users (id, email, display_name, role, status)
       VALUES ($1, 'trader@sentinel.local', 'Sentinel Alpha Trader', 'user', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [DEMO_USER_ID],
    );

    await client.query(
      `INSERT INTO wallets (id, user_id, chain, address, label, is_primary, balance_sol, status, first_seen_at, last_seen_at)
       VALUES ($1, $2, 'solana', $3, 'Phantom Embedded', TRUE, 42.85, 'active', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [DEMO_WALLET_ID, DEMO_USER_ID, DEMO_WALLET_ADDRESS],
    );

    await client.query(
      `INSERT INTO user_settings (user_id, sentinel_preferences)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO NOTHING`,
      [
        DEMO_USER_ID,
        JSON.stringify({
          slippageTolerance: 0.5,
          riskLevel: 'moderate',
          currencyDisplay: 'USD',
          rpcEndpoint: 'mainnet',
          theme: 'dark',
          density: 'standard',
          autoLockMinutes: 30,
          notificationsEnabled: { security: true, priceAlerts: true, tradeExecution: true, system: true },
          updatedAt: new Date().toISOString(),
        }),
      ],
    );

    // Two distinct admins so dual-control approval flows (Sprint 30 — Tier 3)
    // can be smoke-tested without a real admin onboarding process.
    for (const [id, email, displayName] of [
      ['admin_001', 'admin-a@sentinel.local', 'Sentinel Admin A'],
      ['admin_002', 'admin-b@sentinel.local', 'Sentinel Admin B'],
    ]) {
      await client.query(
        `INSERT INTO users (id, email, display_name, role, status)
         VALUES ($1, $2, $3, 'admin', 'active')
         ON CONFLICT (id) DO NOTHING`,
        [id, email, displayName],
      );
    }

    // Chains + tokens: `orders.token_id` has a foreign key to `tokens(id)`, so
    // an order cannot be placed until a token registry exists. The real
    // registry is Phase 5 work; these are clearly-marked development rows so
    // the order API is exercisable now.
    await client.query(
      `INSERT INTO chains (id, name, chain_id, native_asset, status)
       VALUES ('chain_solana', 'Solana', 'solana-mainnet', 'SOL', 'ACTIVE')
       ON CONFLICT (id) DO NOTHING`,
    );

    const tokens = [
      ['tok_sol', 'So11111111111111111111111111111111111111112', 'SOL', 'Wrapped SOL', 9],
      ['tok_usdc', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'USDC', 'USD Coin', 6],
      ['tok_bonk', 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', 'BONK', 'Bonk', 5],
      ['tok_jup', 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', 'JUP', 'Jupiter', 6],
      ['tok_wif', 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', 'WIF', 'dogwifhat', 6],
    ];
    for (const [id, address, symbol, name, decimals] of tokens) {
      await client.query(
        `INSERT INTO tokens (id, chain_id, address, symbol, name, decimals, status, first_seen_at)
         VALUES ($1, 'chain_solana', $2, $3, $4, $5, 'ACTIVE', NOW())
         ON CONFLICT (id) DO NOTHING`,
        [id, address, symbol, name, decimals],
      );
    }

    await client.query('COMMIT');
    console.log('Seeded development data (demo trader + wallet + preferences, 2 dev admins, 1 chain, 5 tokens).');
  } catch (err) {
    await client.query('ROLLBACK');
    throw new Error(`Seed failed: ${err.message}`);
  } finally {
    await client.end();
  }
}

seed().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
