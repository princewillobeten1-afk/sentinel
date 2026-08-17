-- ============================================================================
-- Migration 024 — Order Consolidation (Phase 3)
--
-- Makes `orders` (013) the single canonical order record, replacing four
-- disconnected systems:
--   1. app/api/v1/orders/route.ts   — `let orders: any[] = []`, no auth, no
--                                     validation, parseFloat money, free-text status
--   2. lib/limit-order/*            — real service, its own status union
--   3. lib/execution/* + lib/transaction/* — real transaction lifecycle
--   4. lib/trading/*                — older quote/order pipeline
--
-- Division of responsibility, deliberately kept separate rather than merged:
--   * ORDER lifecycle   (this table) = the user's standing intent to trade.
--     CREATED → PENDING → SUBMITTED → PARTIALLY_FILLED → FILLED, plus
--     CANCELLED / FAILED / EXPIRED. Enforced by lib/order/state-machine.ts.
--   * TRANSACTION lifecycle (execution attempts) = one on-chain attempt to
--     execute that order (SIMULATING → SIGNED → SUBMITTED → CONFIRMED).
--     Enforced by the pre-existing lib/transaction/state-machine.ts.
--   One order can have many attempts, so collapsing the two into a single
--   status column would lose information (e.g. "second retry is signing while
--   the order is still only partially filled").
-- ============================================================================

ALTER TABLE orders
    -- Partial fills: FILLED means filled_quantity = quantity.
    ADD COLUMN IF NOT EXISTS filled_quantity NUMERIC(36, 18) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS average_fill_price NUMERIC(24, 12),
    -- Idempotency (Sprint 42 §63-64): repeated BUY clicks must not create
    -- duplicate orders. UNIQUE so the database is the final defence, not just
    -- an application-level check.
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128),
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- Scoped per user: two different users may legitimately send the same key.
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_user_idempotency
    ON orders (user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

ALTER TABLE orders
    DROP CONSTRAINT IF EXISTS chk_orders_status,
    ADD CONSTRAINT chk_orders_status CHECK (status IN (
        'CREATED', 'PENDING', 'SUBMITTED', 'PARTIALLY_FILLED',
        'FILLED', 'CANCELLED', 'FAILED', 'EXPIRED'
    ));

ALTER TABLE orders
    DROP CONSTRAINT IF EXISTS chk_orders_side,
    ADD CONSTRAINT chk_orders_side CHECK (side IN ('BUY', 'SELL'));

ALTER TABLE orders
    DROP CONSTRAINT IF EXISTS chk_orders_type,
    ADD CONSTRAINT chk_orders_type CHECK (order_type IN ('MARKET', 'LIMIT', 'STOP_LOSS'));

-- Full transition history. `order_events` (013) is a generic event log; this is
-- specifically the state machine's audit trail, so an illegal-transition
-- investigation reads one table with a guaranteed shape.
CREATE TABLE IF NOT EXISTS order_state_transitions (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_state VARCHAR(32),          -- NULL for the initial CREATED record
    to_state VARCHAR(32) NOT NULL,
    reason TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_order_state_transitions_order ON order_state_transitions (order_id, created_at);
