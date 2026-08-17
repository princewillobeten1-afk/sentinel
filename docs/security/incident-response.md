# Incident Response

## ⚠ Immediate flag: rotate the exposed provider keys

During this sprint's recon, a real, populated `.env` file was found sitting
in the project's working directory root with live-looking
`HELIUS_API_KEY` and `BIRDEYE_API_KEY` values, unprotected by a
`.gitignore` (none existed until this sprint added one — see
[`README.md`](./README.md)). No `.git` history exists yet for these values
to have leaked into, but the file existed unprotected regardless.

**Action for a human, not this codebase**: rotate both keys via the Helius
and Birdeye provider dashboards. This is a manual action outside the scope
of any script here — nothing in this repository can rotate a third-party
API key.

## Severity framework

| Severity | Definition | Example |
|---|---|---|
| SEV-1 | Critical security compromise | A session-signing secret leaked; an admin account compromised |
| SEV-2 | Major financial/security impact | The pre-trade risk engine or kill switch found to be bypassable |
| SEV-3 | Limited impact | A single user's session hijacked via a leaked token |
| SEV-4 | Minor issue | A rate limit set too loosely, a non-exploitable info leak |

## Today's primary in-app IR tool: the kill switch

Until a fuller incident-response tooling exists, `lib/server/kill-switch.ts`
is the concrete, working lever available during an active incident:

- **Pause trading platform-wide**: `POST /api/v1/admin/kill-switch/request` with `action: "PAUSE_TRADING"`, approved by a second, distinct admin via `POST /api/v1/admin/kill-switch/approve`. Takes effect immediately once approved — every `execution/submit`/`trading/prepare` call checks `killSwitch.isPaused('TRADING')` before doing anything else.
- **Pause launchpad deployments**: same flow with `PAUSE_LAUNCHPAD` — gates the `DEPLOY` branch of `POST /api/v1/launches`.
- **Revoke a compromised session**: `DELETE /api/v1/auth/sessions/:id` (self-service) or, for now, direct `sessionStore.revoke()` for an admin-initiated response — there's no dedicated "admin revokes another user's session" route yet (see [`out-of-scope.md`](./out-of-scope.md)).
- **Revoke all of a user's sessions**: `POST /api/v1/auth/sessions/revoke-all` (self-service "log out everywhere").

Every one of these actions is audited (`KILL_SWITCH_*`, `SESSION_REVOKED*`
actions in `lib/server/audit.ts`), so the audit log
(`GET /api/v1/admin/audit-log`) is the first place to look when
reconstructing what happened during an incident.

## Generic response process

```
Detect → Classify (severity above) → Contain (kill switch / session
revocation) → Investigate (audit log) → Remediate → Recover → Review
```

## Breach response (credential compromise)

If a session token, API key, or webhook secret is suspected compromised:

1. Revoke it — `DELETE /api/v1/auth/sessions/:id`, `DELETE /api/v1/user/api-keys/:id` (Sprint 28), or delete the webhook (`DELETE /api/v1/webhooks/:id`) to invalidate its secret.
2. Rotate — API keys support rotation (`POST /api/v1/user/api-keys/:id/rotate`); a compromised webhook should be deleted and recreated (secrets aren't rotatable in place today).
3. Investigate — the audit log for the affected user/entity.
4. Notify affected users — no automated notification path exists yet; this is currently a manual step.

## Emergency contacts

Not established — this is a single-developer/small-team project at this
stage. A real escalation structure (not relying on one person) is listed in
[`out-of-scope.md`](./out-of-scope.md) as something that needs an actual
team to exist first, not something this codebase can build for.
