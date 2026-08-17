# Operational Runbook: Trading Engine Outage & Execution Recovery (RUNBOOK-04)

## Severity Tier
P1 Critical

## Symptoms
- Alert `TRADING_API_ERROR_RATE_HIGH` (>1%).
- Orders stuck in `SUBMITTED` or `PENDING` states.
- Spike in transaction simulation reverts.

## Immediate Action Steps
1. **Determine Outage Scope**:
   - Is the failure on all pairs or a specific liquidity pool (e.g. Raydium vs Meteora)?
2. **Engage Platform Kill Switch if Risk of Fund Loss**:
   - If anomalous token behavior or pool drain is detected, trigger the kill switch:
     ```bash
     POST /api/v1/admin/security/kill-switch/propose
     ```
3. **Inspect In-Flight Transactions**:
   - Query all transactions in `PENDING` state created within the last 15 minutes.
4. **Trigger Blockchain Reconciliation**:
   - Run `BlockchainReconciliationEngine` to verify whether pending signatures were included on-chain or dropped.
5. **Resume Trading Path**:
   - Once pool state/RPC stabilizes, clear kill switch and verify test swap.
