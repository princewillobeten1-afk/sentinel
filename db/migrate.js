/**
 * Minimal Postgres migration runner (Phase 1 — Postgres Foundation).
 *
 * Plain CommonJS, same reasoning as `server.js`: a standalone entry point
 * invoked directly by `node`/`npm run db:migrate`, not through Next's TS
 * pipeline, so it can't `require()` the TypeScript under `lib/`.
 *
 * Applies every `db/migrations/*.sql` file in lexical filename order that
 * isn't already recorded in `schema_migrations`, each inside its own
 * transaction. Filenames are the version key (e.g. "020_auth_identity_wallet_system"),
 * so two files sharing a numeric prefix is a hard error here by design —
 * that collision is exactly what this runner exists to catch (see the
 * 012/018 renumber this same phase).
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Automatically load environment variables from .env / .env.local if not already in process.env
function loadEnv() {
  const envFiles = ['.env.local', '.env', '.env.development'];
  for (const file of envFiles) {
    const filePath = path.join(__dirname, '..', file);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}
loadEnv();

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Splits a migration file into individual statements.
 *
 * Necessary, not cosmetic: sending a whole file as one `client.query()` uses
 * the simple query protocol, which parses *every* statement before executing
 * any of them. A file that does `CREATE TYPE foo_enum ...` and then uses
 * `foo_enum` as a column type fails to parse, because the type doesn't exist
 * yet at parse time — and if that column is also named with a reserved word
 * (`window` in 007_activity_intelligence.sql), the grammar can't disambiguate
 * it and errors with `syntax error at or near "window"`. `psql` doesn't hit
 * this because it sends statements one at a time; this makes the runner match
 * that behavior. Statements still run inside one transaction, so atomicity
 * per migration file is unchanged.
 *
 * Handles `--` line comments and single-quoted literals (including doubled
 * `''` escapes). There are no dollar-quoted blocks in this directory; if a
 * future migration adds a function body, this must learn `$tag$` quoting.
 */
function splitStatements(sql) {
  const statements = [];
  let current = '';
  let inLineComment = false;
  let inBlockComment = false;
  let inString = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      current += ch;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        current += ch + next;
        i++;
        continue;
      }
      current += ch;
      continue;
    }
    if (inString) {
      current += ch;
      if (ch === "'") {
        if (next === "'") {
          current += next;
          i++;
        } else {
          inString = false;
        }
      }
      continue;
    }

    if (ch === '-' && next === '-') {
      inLineComment = true;
      current += ch + next;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      current += ch + next;
      i++;
      continue;
    }
    if (ch === "'") {
      inString = true;
      current += ch;
      continue;
    }
    if (ch === ';') {
      if (current.trim()) statements.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set — cannot run migrations.');
    process.exitCode = 1;
    return;
  }

  const isCloudPostgres =
    databaseUrl.includes('supabase.co') ||
    databaseUrl.includes('pooler.supabase.com') ||
    databaseUrl.includes('sslmode=require') ||
    databaseUrl.includes('neon.tech') ||
    databaseUrl.includes('amazonaws.com');

  const client = new Client({
    connectionString: databaseUrl,
    ssl: isCloudPostgres ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const versions = new Map();
    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      const numericPrefix = version.split('_')[0];
      if (versions.has(numericPrefix)) {
        throw new Error(
          `Duplicate migration prefix "${numericPrefix}": "${versions.get(numericPrefix)}" and "${file}". ` +
            `Renumber one of them before running migrations.`,
        );
      }
      versions.set(numericPrefix, file);
    }

    const { rows: applied } = await client.query('SELECT version FROM schema_migrations');
    const appliedSet = new Set(applied.map((r) => r.version));

    let appliedCount = 0;
    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      if (appliedSet.has(version)) continue;

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`Applying ${file}...`);

      await client.query('BEGIN');
      let currentStatement = '';
      try {
        for (const statement of splitStatements(sql)) {
          currentStatement = statement;
          await client.query(statement);
        }
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
        await client.query('COMMIT');
        appliedCount += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed on statement:\n${currentStatement}\nError: ${err.message}`);
      }
    }

    console.log(appliedCount === 0 ? 'No pending migrations.' : `Applied ${appliedCount} migration(s).`);
  } finally {
    await client.end();
  }
}

migrate().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
