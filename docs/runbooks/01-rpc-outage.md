# Operational Runbook: Solana RPC Outage & Node Desync (RUNBOOK-01)

## Severity Tier
P1 Critical (if all RPC endpoints failing) / P2 High (if primary endpoint degraded)

## Symptoms
- Alert `RPC_CIRCUIT_BREAKER_OPEN` or `SOLANA_RPC_TIMEOUT` fired.
- `/api/v1/health` reports `solana_rpc` as `unhealthy` or `degraded`.
- Increased rate of `BROADCAST_FAILED` or preflight simulation timeouts.

## Immediate Action Steps
1. **Check Circuit Breaker Status**:
   - Inspect `/api/v1/health` and verify whether secondary/tertiary RPC endpoints are responding.
2. **Engage RPC Failover**:
   - Verify that the multi-node adapter (`SolanaChainAdapter`) has successfully routed traffic to the backup provider (e.g. Helius / Triton / QuickNode).
3. **Verify Node Slot Lag**:
   - Compare current slot reported by Sentinel vs Solana Beach / Solana Explorer:
     ```bash
     curl -s -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getSlot"}' $RPC_ENDPOINT
     ```
   - If slot lag > 50 slots, mark the node dead in the RPC pool.
4. **If All Public & Private Endpoints Failing**:
   - Activate graceful degradation: enable cached quotes and display "Network Delayed" banner on the frontend terminal.
   - If severe, trigger trading pause via the Platform Kill-Switch (`/api/v1/admin/security/kill-switch`).

## Post-Incident Actions
- Complete Incident Postmortem within 24 hours.
- Run `BlockchainReconciliationEngine` to scan all transactions submitted during the outage window.
