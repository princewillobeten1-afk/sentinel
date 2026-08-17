# ADR-003: Multi-State Circuit Breakers and Graceful Subsystem Degradation

## Status
Accepted (Sprint 32)

## Context
Project Sentinel depends on external and internal subsystems: Solana RPC nodes, price oracles, Token Intelligence graph engines, notification webhooks, and analytics stores. A slow or failing dependency must never cascade into taking down core trading or wallet operations.

## Decision
1. Implement a unified, multi-state `CircuitBreaker` pattern (`CLOSED`, `OPEN`, `HALF_OPEN`) per dependency.
2. If failures exceed threshold (e.g. 3 consecutive RPC errors or 4 Intelligence timeouts), the breaker trips to `OPEN`, immediately rejecting traffic for `recoveryTimeoutMs` without wasting system resources.
3. After timeout, transition to `HALF_OPEN` for canary trial calls. If trials succeed, reset to `CLOSED`; if any trial fails, return to `OPEN`.
4. Decouple critical trading from non-critical intelligence:
   - Intelligence Failure -> Graceful degradation to basic market view with clear status badge.
   - Core Trading and Wallet operations remain fully operational.

## Consequences
- Protects downstream systems from thundering herds during outages.
- Provides immediate fail-fast responses (503 with recovery hints) rather than 30-second hanging timeouts.
- Preserves core platform revenue and trader execution capabilities even when secondary AI/analytics are offline.
