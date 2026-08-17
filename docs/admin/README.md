# Sprint 39 — Admin Dashboard & Platform Operations Architecture

This document suite defines the comprehensive operational control center, security governance, and multi-entity investigation platform for Project Sentinel.

## Documentation Index

1. [01 — Admin Architecture, RBAC & Session Security](./01-admin-architecture-and-rbac.md)
   - 11 Admin Roles, Domain Permission Matrix, SuperAdmin Governance, MFA & Device Controls.
2. [02 — Platform Operations, Live Feeds & Emergency Controls](./02-operations-and-emergency-controls.md)
   - Real-Time Operations Feed, 5-State Emergency Mode Switchboard, Granular Kill Switches, Launchpad Controls.
3. [03 — Multi-Entity Investigation Workspace & Graph](./03-investigation-workspace-and-graph.md)
   - Unified Omnibox, Entity Dossiers (User/Token/Wallet/Creator/Order/Failed Trade), Relationship Graph, AI Assistant & Evidence Traceability.
4. [04 — Protocol Treasury, Revenue Analytics & Fee Management](./04-treasury-revenue-and-fee-management.md)
   - Treasury Balance Telemetry, 4-Stream Protocol Revenue Breakdown, Action Simulator for Dynamic Fees.
5. [05 — AI Quality, Hallucination Monitoring & Risk Governance](./05-ai-risk-and-quality-governance.md)
   - AI Telemetry, Grounding Audits, Hallucination Incident Triage, Dynamic Model Switchboard, Auditable Risk Overrides.
6. [06 — Feature Flags, Configuration & DevOps Operations](./06-feature-flags-config-and-devops.md)
   - Dynamic Feature Flags with Multi-Tier Targeting, Versioned Config Rollback, Infrastructure & Blockchain Reorg Telemetry.
7. [07 — Security Incidents, Moderation & Immutable Audit](./07-security-incidents-moderation-and-audit.md)
   - P0-P3 Security Incident Workspace, Moderation Queue, SHA-256 Tamper-Resistant Chained Audit Log, Privacy Controls.

---

## High-Level Operational Architecture

```text
                                  ADMIN USER (11 Roles)
                                           │
                                           ▼
                               ADMIN DASHBOARD (⌘K & Tabs)
                                           │
          ┌────────────────────────────────┼────────────────────────────────┐
          ▼                                ▼                                ▼
      OPERATIONS                     INTELLIGENCE                       SECURITY
   • Trading Ops & Tracing        • Unified Investigation          • Security Incident Center (P0-P3)
   • Launchpad & Creators         • Relationship Graph             • Tamper-Resistant Audit Log
   • User Management              • AI Investigation Assistant     • Abuse Reports & Moderation
   • Treasury & Fees              • Evidence Traceability          • Session & Device Controls
   • 5-State Emergency & Pauses   • AI Quality & Hallucinations    • Privacy & PII Redaction
          │                                │                                │
          └────────────────────────────────┼────────────────────────────────┘
                                           ▼
                                 ADMIN API LAYER (v1)
                                           │
          ┌────────────────────────────────┼────────────────────────────────┐
          ▼                                ▼                                ▼
   Databases & State               Analytics Pipeline              Blockchain & Infrastructure
 (Postgres / ServerStore)       (Lineage / Volume / Models)         (Solana / Base / RPC / Reorg)
                                           │
                                           ▼
                              IMMUTABLE AUDIT SYSTEM
                           (SHA-256 Hash-Chained Logs)
```
