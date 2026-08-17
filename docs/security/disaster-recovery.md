# Disaster Recovery

## The honest baseline: RPO is 0 for everything, today

Every piece of application state — users, wallets, sessions, MFA
enrollments, API keys, webhooks, audit logs, kill-switch state, approval
requests — lives in an in-memory, `globalThis`-guarded store
(`lib/server/store.ts` and the sibling stores this sprint added). A process
restart loses all of it. There is no real database (`lib/server/database.ts`
is an explicit mock) and no backup mechanism, because there is nothing
durable to back up.

Stating a target RPO/RTO as if real persistence already existed would be
dishonest. This document states the current reality plainly, and the target
once a real database lands.

| System | RPO today | RTO today | Target RPO (with a real DB) | Target RTO |
|---|---|---|---|---|
| User accounts / wallets | 0 (lost on restart) | Immediate (empty state on reboot) | ≤5 min | ≤30 min |
| Sessions | 0 | Immediate (all users re-authenticate) | N/A — sessions are expected to be short-lived; re-auth on restart is acceptable even with a real DB | — |
| API keys / webhooks | 0 | Immediate | ≤5 min | ≤30 min |
| Audit logs | 0 (capped at 500 entries in-memory even while running) | Immediate | ≤1 min (audit logs are the highest-value data to not lose) | ≤15 min |
| Trading / portfolio data | 0 | Immediate | ≤5 min | ≤30 min |

## Why this is acceptable for now, and when it stops being acceptable

This is a development-stage application with simulated execution and no
real funds at risk — an in-memory store that resets on restart is a
reasonable tradeoff for iteration speed, matching every other subsystem's
persistence decision this sprint and Sprint 28 before it (documented
explicitly in each new `db/migrations/*.sql` file's header).

It stops being acceptable the moment real user funds, real custody, or real
on-chain execution is introduced. At that point, disaster recovery needs to
be designed against the actual database chosen (not designed speculatively
now against a database that doesn't exist), with real backup testing (see
below) as a hard prerequisite before going live with real funds.

## Backup testing

Not applicable today — there is nothing to back up. Once a real database
exists: a backup that has never been restored is not considered reliable.
Scheduled restoration tests should be part of that rollout from day one,
not added later.

## Multi-region / infrastructure resilience

Not applicable today — this runs as a single Node process
(`node server.js`) with no cloud infrastructure, load balancer, or
multi-region deployment target. See [`out-of-scope.md`](./out-of-scope.md).
