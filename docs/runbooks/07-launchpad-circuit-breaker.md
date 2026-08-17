# Operational Runbook: Launchpad Extreme Impact Circuit Breaker (RUNBOOK-07)

## Severity Tier
P2 High

## Symptoms
- Alert `CIRCUIT_BREAKER_TRIGGERED` for launchpad pair.
- 3 or more consecutive simulation attempts with extreme price impact (>12%) detected within a rolling 60s window.

## Immediate Action Steps
1. **Verify Token Liquidity State**:
   - Inspect whether pool liquidity was drained or creator attempted a rug pull.
2. **Review Holder Clusters**:
   - Run Token Intelligence engine on the contract mint to inspect insider wallet distribution.
3. **Reset or Escalate**:
   - If market stabilized with new organic liquidity, reset circuit breaker via admin API:
     ```bash
     POST /api/v1/admin/security/circuit-breaker/reset
     ```
   - If proven honeypot/rug, flag token in blacklisted metadata registry.
