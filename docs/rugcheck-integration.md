# Rugcheck report integration

Rugcheck supplements the existing ownership and LP-lock readers. Birdeye remains
the primary analytics provider; Helius and QuickNode keep their existing roles.
No discovery lifecycle, layout, chart, or transaction-broadcasting behavior changes.

## Server-only configuration

- `RUGCHECK_API_KEY`: a key from **FluxRPC → RugCheck → API Keys**, not a Solana RPC key.
- `RUGCHECK_API_ENDPOINT`: `https://api.rugcheck.xyz`, or the copied endpoint containing `?key=...`.
  The explicit API key takes precedence. Private authentication is sent as `X-API-KEY`, with query credentials removed.
- `RUGCHECK_SHIELD_KEY`: the Shield key alone, or the copied `https://shield.rugcheck.xyz?key=...` URL.
  This is a **Rugcheck report endpoint**, not Solana JSON-RPC or a WebSocket.

The application never exposes these values to the browser. Only the official
HTTPS report hosts are accepted, and authenticated redirects are disabled.

## Reads and fallback

Both `fetchRugcheckOwnership` and `getLiquidityLock` use the shared report reader.
Concurrent reads for the same mint share a request. Existing enrichment scheduling
and LP-lock caching remain in place. Report request starts are paced at one per
second across workers. A report must identify the requested mint.

The main API is used first. Shield is tried on access rejection or a transient
server/transport failure. Public reports retain the existing no-key behavior and
can recover from a rejected optional key. A quota error or HTTP 429 does **not**
switch credentials to bypass the account limit. The provider cooldown honors
Retry-After; rotating the configured key resets that key's access cooldown.

The report reader supplies top-account concentration, holder counts, creator
holdings when present in the returned list, and the deepest reported pool's
LP-lock percentage. An empty cached holder report is not displayed as a measured
zero. Classification percentages need their own provider evidence; this credential
integration does not validate any inferred values from risk labels or equal holder
amounts. A key does not grant paid features automatically.

The configured Shield is a standby: health reports it as unverified until the
application actually needs it. This does not mean the URL is invalid.

## Verification

Run `node scripts/rugcheck-provider-smoke.cjs [mint]` for a read-only check of the
real ownership/LP readers plus an independent Shield report read. It prints only
sanitized status and measured fields, never credentials or raw reports.

`GET /api/v1/market/live/status` includes `rugcheck` configuration/access status,
last successful mode/time, current requests, and retry timing.

On 2026-09-26, both configured report endpoints returned HTTP 200, the running
application reported authenticated access verified, and the shared reader returned
measured holder concentration/count and LP-lock data for the smoke-test mint.
This verifies report access, not paid streaming entitlements or every token field.

Official references: [authentication](https://fluxrpc.com/docs/rugcheck/getting-started),
[report API and plan capabilities](https://fluxrpc.com/docs/rugcheck).
