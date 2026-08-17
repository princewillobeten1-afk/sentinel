# Operational Runbook: Market Data Provider Failure & Oracle Failover (RUNBOOK-06)

## Severity Tier
P2 High

## Symptoms
- Alert `MARKET_DATA_PROVIDER_FAILOVER` or `ORACLE_CIRCUIT_BREAKER_OPEN`.
- Primary pricing provider (e.g. Birdeye) returning 5xx or timing out.

## Immediate Action Steps
1. **Verify Automatic Failover**:
   - Check `MarketEventPipeline` logs to ensure fallback to secondary provider (e.g. DexScreener / Pyth / Helius direct logs) succeeded.
2. **Apply Price Sanity Clamping**:
   - Verify that anomalous zero-price or negative-price ticks are rejected by normalizers.
3. **Frontend Status Verification**:
   - Confirm frontend displays "Live" or "Delayed" indicator accurately to prevent stale market display.
