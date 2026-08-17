# ADR-004: Idempotency and Concurrency Locks for Financial Writes

## Status
Accepted (Sprint 32)

## Context
Network retries, browser refreshes, mobile reconnects, double-clicks on trade buttons, or background worker retries can result in accidental duplicate order executions, causing financial loss for traders.

## Decision
1. Require an `Idempotency-Key` HTTP header on all state-mutating financial endpoints (`/api/v1/trading/prepare`, `/api/v1/execution/submit`, `/api/v1/orders`).
2. Pair the key with a cryptographic fingerprint of the request payload (`method + path + body`).
3. If an identical key and fingerprint arrive while the initial request is in-flight or completed within the 24-hour TTL window, return the cached result with `X-Idempotent-Replayed: true`.
4. If the same key is sent with a different payload fingerprint, reject immediately with `409 IDEMPOTENCY_KEY_CONFLICT`.

## Consequences
- Guaranteed zero double-executions on network retries or client double-submits.
- Safe automated retry policy for mobile and programmatic API clients.
