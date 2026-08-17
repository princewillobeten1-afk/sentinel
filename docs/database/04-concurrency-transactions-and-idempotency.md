# 04 — ACID Transactions, Concurrency & Idempotency (Sprint 35 §81-87)

## 1. ACID Multi-Table Transactions
Atomic transactions wrap all multi-table state mutations:
```text
BEGIN TRANSACTION;
  1. Insert into orders (status = 'SUBMITTED')
  2. Insert into order_events (event_type = 'ORDER_SUBMITTED')
  3. Update positions (quantity = quantity - swap_amount)
  4. Insert into audit_logs (action = 'ORDER_CREATED')
COMMIT;
```
If any intermediate step fails, the entire transaction is rolled back cleanly.

---

## 2. Idempotency Key Engine (`lib/server/idempotency.ts`)
- Financial POST/PUT endpoints require an `Idempotency-Key` header.
- Cached results in Redis (TTL: 24 hours) prevent duplicate order placement on network retries.
- Concurrency locks (Redlock) ensure that simultaneous identical requests reject secondary submissions with `409 Conflict`.

---

## 3. Immutable Financial Ledgers & Deletion Policy
- **Append-Only Financial Truth**: Executed trades, blockchain events, fee deductions, and P&L entries are immutable append-only records.
- **Reconciliation Invariant**: Errors or blockchain discrepancies are corrected via compensatory entries (`RECONCILED_CORRECTION`), never by mutating historical rows.
- **Soft vs. Hard Deletion**:
  - `Soft Delete` (adds `revoked_at` / `status = 'deleted'`): Users, API keys, Alert rules, Admin roles.
  - `Hard Delete`: Purged strictly in accordance with GDPR/privacy compliance or automated data retention schedules (`data_retention_policies`).
