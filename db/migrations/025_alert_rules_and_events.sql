-- ============================================================================
-- Migration 025 — Alert Rules & Events (Phase 4)
--
-- Makes the alert domain real. Before this, `app/api/v1/alerts/route.ts`
-- returned a hardcoded 2-item array and its POST was a no-op returning a
-- fabricated id; `app/api/v1/alert-rules/route.ts` was the same. Meanwhile
-- lib/alert/{engine,router,conflict,story,correlation}.ts were fully written
-- but had ZERO importers — real logic with nothing calling it.
--
-- TWO DISTINCT LIFECYCLES, deliberately not merged:
--
--   * RULE lifecycle (alerts.status) — the standing subscription:
--       ACTIVE ⇄ PAUSED, either → DELETED; ACTIVE → TRIGGERED → ACTIVE;
--       ACTIVE/PAUSED → EXPIRED.
--     This is what Sprint 42 §37/§77 asks for and it did not exist.
--
--   * READ state (alert_events.read_state) — one user's interaction with one
--     firing: UNREAD → READ → ACTIONED / DISMISSED.
--     `AlertReadState` in lib/alert/types.ts already modelled this, and it was
--     being mistaken for the rule lifecycle. A paused RULE and a dismissed
--     EVENT are unrelated facts.
-- ============================================================================

-- 013's `alerts` table holds only (alert_type, name, enabled). `AlertRule`
-- (lib/alert/types.ts) additionally carries scope, a nested AND/OR condition
-- group, severity, channels and a cooldown.
ALTER TABLE alerts
    ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS category VARCHAR(32),
    ADD COLUMN IF NOT EXISTS severity VARCHAR(16),
    ADD COLUMN IF NOT EXISTS scope JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS channels JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS cooldown_minutes INTEGER NOT NULL DEFAULT 0,
    -- Soft delete (Sprint 42 §44): an alert that has already fired is part of
    -- the user's history, so DELETED hides the rule without destroying the
    -- events that reference it.
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMPTZ;

ALTER TABLE alerts
    DROP CONSTRAINT IF EXISTS chk_alerts_status,
    ADD CONSTRAINT chk_alerts_status CHECK (status IN ('ACTIVE', 'PAUSED', 'TRIGGERED', 'EXPIRED', 'DELETED'));

-- Rule lifecycle audit trail, same shape as order_state_transitions (024) so
-- "why is this rule in this state" is answerable from one table.
CREATE TABLE IF NOT EXISTS alert_rule_transitions (
    id VARCHAR(64) PRIMARY KEY,
    alert_id VARCHAR(64) NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    from_state VARCHAR(16),
    to_state VARCHAR(16) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 013's alert_events has only (alert_id, triggered_at, payload, status). The
-- UI (components/views/alert-center-view.tsx) renders title/severity/summary
-- and a per-user read state.
ALTER TABLE alert_events
    ADD COLUMN IF NOT EXISTS user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS title VARCHAR(200),
    ADD COLUMN IF NOT EXISTS summary TEXT,
    ADD COLUMN IF NOT EXISTS severity VARCHAR(16),
    ADD COLUMN IF NOT EXISTS category VARCHAR(32),
    ADD COLUMN IF NOT EXISTS token_symbol VARCHAR(32),
    ADD COLUMN IF NOT EXISTS read_state VARCHAR(16) NOT NULL DEFAULT 'UNREAD';

ALTER TABLE alert_events
    DROP CONSTRAINT IF EXISTS chk_alert_events_read_state,
    ADD CONSTRAINT chk_alert_events_read_state CHECK (read_state IN ('UNREAD', 'READ', 'ACTIONED', 'DISMISSED'));

CREATE INDEX IF NOT EXISTS idx_alerts_user_status ON alerts (user_id, status);
CREATE INDEX IF NOT EXISTS idx_alert_events_user_time ON alert_events (user_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_events_read_state ON alert_events (user_id, read_state);
CREATE INDEX IF NOT EXISTS idx_alert_rule_transitions ON alert_rule_transitions (alert_id, created_at);
