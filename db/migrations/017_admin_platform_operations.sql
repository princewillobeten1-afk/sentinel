-- Migration 017: Sprint 39 — Admin Dashboard & Platform Operations Schema
-- Author: Project Sentinel Architect
-- Date: 2026-08-16
-- Description: Enterprise Admin Operations, RBAC, Tamper-Resistant Hash-Chained Audit Logs,
--              Multi-Entity Investigations, Security Incidents (P0-P3), Feature Flags,
--              Emergency State Switchboard, and Dynamic Configuration Management.

-- 1. Admin RBAC Roles & Permissions
CREATE TABLE IF NOT EXISTS admin_roles (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_permissions (
    id VARCHAR(64) PRIMARY KEY,
    domain VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_role_permissions (
    role_id VARCHAR(64) REFERENCES admin_roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(64) REFERENCES admin_permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS admin_user_assignments (
    user_id VARCHAR(64) NOT NULL,
    role_id VARCHAR(64) REFERENCES admin_roles(id) ON DELETE CASCADE,
    assigned_by VARCHAR(64) NOT NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

-- 2. Admin Sessions & Device Fingerprints
CREATE TABLE IF NOT EXISTS admin_sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    device_fingerprint VARCHAR(128) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    geo_location VARCHAR(128),
    user_agent TEXT,
    mfa_verified BOOLEAN DEFAULT FALSE,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Cryptographically Tamper-Resistant SHA-256 Chained Audit Logs
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    sequence_num BIGSERIAL,
    previous_hash VARCHAR(64) NOT NULL,
    event_hash VARCHAR(64) NOT NULL,
    actor_id VARCHAR(64) NOT NULL,
    actor_role VARCHAR(64) NOT NULL,
    action VARCHAR(128) NOT NULL,
    domain VARCHAR(64) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id VARCHAR(128),
    reason TEXT NOT NULL,
    ip_address VARCHAR(45),
    geo_location VARCHAR(128),
    user_agent TEXT,
    session_id VARCHAR(64),
    changes_before JSONB,
    changes_after JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON admin_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_resource ON admin_audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs(created_at);

-- 4. Enterprise Dual-Approval Workflow Store
CREATE TABLE IF NOT EXISTS admin_dual_approvals (
    id VARCHAR(64) PRIMARY KEY,
    action_type VARCHAR(128) NOT NULL,
    payload JSONB NOT NULL,
    requested_by VARCHAR(64) NOT NULL,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    reason TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, EXPIRED, EXECUTED
    approved_by VARCHAR(64),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    executed_at TIMESTAMPTZ
);

-- 5. Platform Emergency Switchboard & Circuit Breakers
CREATE TABLE IF NOT EXISTS admin_emergency_state (
    id VARCHAR(32) PRIMARY KEY DEFAULT 'primary',
    mode VARCHAR(32) NOT NULL DEFAULT 'NORMAL', -- NORMAL, DEGRADED, TRADING_RESTRICTED, TRADING_PAUSED, FULL_EMERGENCY
    pause_new_trades BOOLEAN DEFAULT FALSE,
    pause_withdrawals BOOLEAN DEFAULT FALSE,
    pause_copy_trading BOOLEAN DEFAULT FALSE,
    pause_launchpad BOOLEAN DEFAULT FALSE,
    disabled_chains JSONB DEFAULT '[]'::jsonb,
    disabled_routers JSONB DEFAULT '[]'::jsonb,
    circuit_breakers JSONB DEFAULT '{}'::jsonb,
    updated_by VARCHAR(64) NOT NULL,
    reason TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Multi-Entity Investigations & Dossiers
CREATE TABLE IF NOT EXISTS admin_investigations (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(256) NOT NULL,
    entity_type VARCHAR(64) NOT NULL, -- TOKEN, WALLET, USER, CREATOR, ORDER, FAILED_TRADE, INCIDENT
    entity_id VARCHAR(128) NOT NULL,
    severity VARCHAR(16) NOT NULL DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, CRITICAL
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN', -- OPEN, INVESTIGATING, CONTAINED, RESOLVED, ARCHIVED
    assigned_to VARCHAR(64),
    ai_summary TEXT,
    evidence_links JSONB DEFAULT '[]'::jsonb,
    timeline JSONB DEFAULT '[]'::jsonb,
    admin_notes JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Security Incident Response Center (P0 - P3)
CREATE TABLE IF NOT EXISTS admin_security_incidents (
    id VARCHAR(64) PRIMARY KEY,
    severity VARCHAR(8) NOT NULL, -- P0, P1, P2, P3
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN', -- OPEN, INVESTIGATING, CONTAINED, RESOLVED, ARCHIVED
    title VARCHAR(256) NOT NULL,
    description TEXT NOT NULL,
    affected_systems JSONB DEFAULT '[]'::jsonb,
    affected_users_count INT DEFAULT 0,
    timeline JSONB DEFAULT '[]'::jsonb,
    evidence JSONB DEFAULT '[]'::jsonb,
    mitigation_steps JSONB DEFAULT '[]'::jsonb,
    assigned_team VARCHAR(64),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Dynamic Feature Flags & Targeting
CREATE TABLE IF NOT EXISTS admin_feature_flags (
    flag_key VARCHAR(128) PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT FALSE,
    rollout_pct INT DEFAULT 0,
    target_roles JSONB DEFAULT '[]'::jsonb,
    target_users JSONB DEFAULT '[]'::jsonb,
    target_regions JSONB DEFAULT '[]'::jsonb,
    updated_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Versioned Configuration Management & Risk Overrides
CREATE TABLE IF NOT EXISTS admin_config_settings (
    config_key VARCHAR(128) PRIMARY KEY,
    config_group VARCHAR(64) NOT NULL,
    value_json JSONB NOT NULL,
    previous_value_json JSONB,
    version INT NOT NULL DEFAULT 1,
    is_dangerous BOOLEAN DEFAULT FALSE,
    updated_by VARCHAR(64) NOT NULL,
    reason TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_risk_overrides (
    id VARCHAR(64) PRIMARY KEY,
    entity_type VARCHAR(32) NOT NULL,
    entity_id VARCHAR(128) NOT NULL,
    override_rules JSONB NOT NULL,
    admin_id VARCHAR(64) NOT NULL,
    reason TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Moderation & Abuse Reports
CREATE TABLE IF NOT EXISTS admin_abuse_reports (
    id VARCHAR(64) PRIMARY KEY,
    reporter_wallet VARCHAR(128) NOT NULL,
    target_type VARCHAR(32) NOT NULL, -- TOKEN, CREATOR, USER, MESSAGE
    target_id VARCHAR(128) NOT NULL,
    category VARCHAR(64) NOT NULL, -- SCAM, IMPERSONATION, MANIPULATION, RUG_PULL, HARASSMENT
    evidence_json JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(32) DEFAULT 'PENDING', -- PENDING, INVESTIGATING, ACTIONED, DISMISSED
    resolution TEXT,
    reviewed_by VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Support Tickets
CREATE TABLE IF NOT EXISTS admin_support_tickets (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64),
    wallet_address VARCHAR(128),
    category VARCHAR(64) NOT NULL,
    priority VARCHAR(16) NOT NULL DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, URGENT
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, ESCALATED, RESOLVED, CLOSED
    subject VARCHAR(256) NOT NULL,
    description TEXT,
    internal_notes JSONB DEFAULT '[]'::jsonb,
    assigned_agent VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
