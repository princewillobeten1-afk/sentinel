# Operational Runbook: Indexer Lag & WebSocket Desync (RUNBOOK-03)

## Severity Tier
P2 High

## Symptoms
- Alert `INDEXER_SLOT_LAG_EXCEEDED` (>100 slots).
- Traders report stale price updates or missing trade activity on the live chart.
- Frontend footer status displays `WS: DELAYED`.

## Immediate Action Steps
1. **Inspect WebSocket Event Pipeline**:
   - Check WebSocket connection metrics in `/api/v1/health`.
   - Inspect active topic subscription counts and queue depths.
2. **Restart Geyser / Helius Logs Stream**:
   - Restart the lagging indexing worker instance to reconnect to the streaming log endpoint.
3. **Trigger Catch-Up Backfill**:
   - Trigger the slot backfill worker to query missing blocks from REST RPC and emit normalized events.
4. **Notify Traders**:
   - Status bar will automatically indicate `Market Data: Delayed` to ensure traders are not misled by stale data.
