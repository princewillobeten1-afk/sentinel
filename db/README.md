# Database

Real PostgreSQL, driven by raw `pg` (node-postgres) + hand-written SQL — no
ORM, no Prisma. See `lib/server/db/` for the repository layer.

## Running it

```bash
docker compose up -d db      # Postgres 15 on host port 5433
npm run db:migrate           # apply pending migrations
npm run db:seed              # development-only demo user/wallet/admins
```

`DATABASE_URL` (`.env`) points at `postgresql://sentinel:sentinel@127.0.0.1:5433/sentinel`.

**Host port 5433, not 5432** — 5432 is commonly already taken by another
project's Postgres container. Use `127.0.0.1` rather than `localhost`: on
Windows, `localhost` can resolve to `::1` first and fail to connect.

When `DATABASE_URL` is unset, `lib/server/store.ts` and
`lib/server/session-store.ts` fall back to their original in-memory `Map`
behavior with a loud warning, so the app still boots without Postgres.

## Migration runner

`db/migrate.js` applies every `db/migrations/*.sql` not yet recorded in
`schema_migrations`, each file inside one transaction. Two files sharing a
numeric prefix is a hard error by design.

It splits each file into individual statements rather than sending the whole
file as one query. That is load-bearing, not cosmetic: a single multi-statement
query is parsed *in full* before any of it executes, so a file that does
`CREATE TYPE foo_enum ...` and then uses `foo_enum` as a column type fails to
parse — the type doesn't exist yet at parse time. `psql` behaves correctly
because it sends statements one at a time; the runner now matches it.

## Status of the migration files — read before adding one

These files were written across many prior sprints as *schema-as-documentation*
and, until Phase 1 (Postgres Foundation), **were never executed against a real
database**. Executing them for the first time revealed that the directory is
not a runnable ordered sequence:

- **`001`–`006` do not exist.** The directory starts at `007`.
- **Ordering is inconsistent with dependencies.** `007`, `008`, and `009` all
  declare `REFERENCES tokens(id)`, but `tokens` is only created in `013` —
  which runs after them.
- **Reserved keywords are used as unquoted identifiers.** `007` declares a
  column named `window` (`syntax error at or near "window"`); it would need
  quoting as `"window"` to execute.

**Verified executable today** (applied cleanly, in order, against a live
Postgres 15 during Phase 1):

| File | Domain |
|---|---|
| `013_production_data_model.sql` | users, sessions, wallets + ~60 other domain tables |
| `020_auth_identity_wallet_system.sql` | auth challenges, reset/verification tokens, security audit events; ALTERs `013`'s users/sessions/wallets |
| `021_wallet_transactions.sql` | self-custodial transfer history |

Those three back the only domain that is really Postgres-backed so far —
identity, wallets, sessions, and audit (`lib/server/db/*-repository.ts`).

Every other file still documents a domain whose runtime state lives in
in-memory stores (`lib/db/repository.ts`, the various `lib/*/engine.ts`
singletons). Making the full directory executable is deliberately **not** part
of Phase 1 — it belongs with the later phases that actually move those domains
onto Postgres, where the DDL can be fixed and verified against real code that
uses it, rather than fixed blind.

If you add a migration now: give it the next free prefix, make it executable,
and verify it with `npm run db:migrate` against a clean database.
