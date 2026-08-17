# AI System Specifications (Sprint 37)

This directory contains the comprehensive architectural, algorithmic, and operational specifications for the **Project Sentinel AI Intelligence Layer**.

---

## Document Index

1. [**01 — AI Architecture & AI Gateway**](./01-ai-architecture-and-gateway.md)
   - Decoupled two-tier intelligence model.
   - Unified 8-step AI Gateway pipeline.
   - Provider-agnostic Model Router and latency SLAs.
   - High availability and deterministic fallback rules.

2. [**02 — Evidence Grounding, Claim Validation & Schemas**](./02-evidence-grounding-and-schemas.md)
   - Hierarchy of evidence priority.
   - Structured `EvidencePackage` data schema.
   - Automated Claim Validation & Evidence Checking pipeline.
   - Confidence vs. certainty definitions.

3. [**03 — Feature Registry & Specialized Analysts**](./03-feature-registry-and-analysts.md)
   - AI Feature Registry policies and SLAs.
   - Deep Token AI Analyst & 12-section token report.
   - "What Changed?" 15m/1h/24h state diff engine.
   - AI Anomaly Synthesizer & Creator/Wallet Analysts.

4. [**04 — Trader Copilot, Pre-Trade Check & Discovery**](./04-copilot-trading-and-discovery.md)
   - Context-aware screen binding.
   - Pre-trade advisory risk check & human confirmation.
   - Natural language discovery search to deterministic SQL compiler.
   - Post-trade educational review journal.

5. [**05 — Safety Boundaries, Security & Personalization**](./05-safety-security-and-personalization.md)
   - Fact vs Analysis vs Estimate vs Prediction taxonomy.
   - Hard safety rules (Zero private key / Zero autonomous signing).
   - Untrusted input sanitization & prompt injection defense.
   - Personalized risk profiles (Conservative, Balanced, Aggressive, Custom).

6. [**06 — Evaluation, Observability & Cost Controls**](./06-evaluation-observability-and-cost.md)
   - Golden Evaluation Dataset benchmarks and regression testing.
   - Response caching & event-driven invalidation.
   - Domain token budgeting and audit trail versioning.

---

## Core Operational Axiom

```text
AI NEVER:
    ↓
Invents blockchain facts
    ↓
Controls private keys
    ↓
Executes trades autonomously
    ↓
Overrides risk controls
    ↓
Claims certainty about future prices
```
