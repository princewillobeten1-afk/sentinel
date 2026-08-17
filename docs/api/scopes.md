# Scopes

A closed enum (`lib/server/scopes.ts`) — a scope is only ever granted
because a key's creator explicitly checked it when creating or rotating the
key. Nothing is implied or bundled automatically.

| Scope | Grants |
|---|---|
| `READ_MARKET_DATA` | Discovery feeds, launch listings |
| `READ_TOKEN_INTELLIGENCE` | Intelligence, exitability, launch analysis |
| `READ_WALLET_DATA` | Reserved — not yet enforced on a route |
| `READ_REPUTATION` | Ownership, creator |
| `READ_PORTFOLIO` | Portfolio (P&L, positions, risk, exposure, performance) |
| `READ_ALERTS` | Reserved — see [`alerts.md`](./alerts.md) |
| `TRADE` | **Dangerous.** Execution quote/simulate/submit, `trading/prepare` |
| `CREATE_ORDER` | **Dangerous.** Reserved — not yet enforced on a route |
| `CANCEL_ORDER` | **Dangerous.** Reserved — not yet enforced on a route |
| `CREATE_LAUNCH` | **Dangerous.** Launch preflight analysis and deployment |
| `MANAGE_LAUNCH` | **Dangerous.** Reserved for future launch-management routes |
| `MANAGE_WEBHOOKS` | Create/list/delete/test webhooks |

## Dangerous scopes

`TRADE`, `CREATE_ORDER`, `CANCEL_ORDER`, `MANAGE_LAUNCH` are never
auto-granted and the developer dashboard's key-creation UI never pre-checks
them — a key holder must explicitly opt in to each one.

## Scope combination rule

`MANAGE_LAUNCH` requires `CREATE_LAUNCH` to also be requested — a key that
can manage a launch it was never able to create is a shape that shouldn't
exist. Requesting `MANAGE_LAUNCH` without `CREATE_LAUNCH` is rejected at key
creation with `400 INVALID_SCOPE_COMBINATION`.

## How scopes are enforced

Only on **API-key**-authenticated requests. A session-authenticated request
(the web app's own logged-in user) is not scope-checked — it has whatever
access the account has, the same as before this sprint. This means scopes
are purely an API-key concept: they bound what a *given key* can do, not
what the account behind it can do.

A request missing a required scope gets `403 INSUFFICIENT_SCOPE` with the
missing scopes named in `error.details.requiredScopes` /
`error.details.grantedScopes`.
