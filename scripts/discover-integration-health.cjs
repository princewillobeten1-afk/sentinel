// Read-only diagnostics. Never print connection strings or provider credentials.
require('@next/env').loadEnvConfig(process.cwd());
const { Client } = require('pg');
const Redis = require('ioredis');

function endpoint(value) {
  try {
    const url = new URL(value);
    return { host: url.hostname, port: url.port || (url.protocol.startsWith('postgres') ? '5432' : '6379') };
  } catch { return { host: 'invalid', port: null }; }
}

async function databaseHealth() {
  if (!process.env.DATABASE_URL) return { configured: false };
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, query_timeout: 5000 });
  try {
    await client.connect();
    const result = await client.query("SELECT to_regclass('public.token_card_evidence_snapshots') IS NOT NULL AS evidence_table");
    return { configured: true, ...endpoint(process.env.DATABASE_URL), reachable: true, ...result.rows[0] };
  } catch (error) {
    return { configured: true, ...endpoint(process.env.DATABASE_URL), reachable: false, error: error.code || error.name };
  } finally { await client.end(); }
}

async function redisHealth() {
  if (!process.env.REDIS_URL) return { configured: false };
  const client = new Redis(process.env.REDIS_URL, { lazyConnect: true, connectTimeout: 5000, retryStrategy: () => null, maxRetriesPerRequest: 0 });
  client.on('error', () => {});
  try { await client.connect(); return { configured: true, ...endpoint(process.env.REDIS_URL), reachable: (await client.ping()) === 'PONG' }; }
  catch (error) { return { configured: true, ...endpoint(process.env.REDIS_URL), reachable: false, error: error.code || error.name }; }
  finally { client.disconnect(); }
}

const deadline = setTimeout(() => { console.log(JSON.stringify({ error: 'Health check timed out' })); process.exit(1); }, 12000);
Promise.all([databaseHealth(), redisHealth()]).then(([database, redis]) => {
  console.log(JSON.stringify({ database, redis, credentials: {
    birdeye: Boolean(process.env.BIRDEYE_API_KEY), helius: Boolean(process.env.HELIUS_API_KEY || process.env.HELIUS_RPC_URL),
  } }, null, 2));
}).catch(() => { console.log(JSON.stringify({ error: 'Health check failed' })); process.exitCode = 1; })
  .finally(() => clearTimeout(deadline));
