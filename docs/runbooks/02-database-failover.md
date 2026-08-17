# Operational Runbook: Database Outage & Read-Replica Failover (RUNBOOK-02)

## Severity Tier
P1 Critical

## Symptoms
- Alert `DATABASE_CONNECTION_EXHAUSTED` or `DATABASE_UNREACHABLE`.
- `/api/v1/health/readiness` returns HTTP 503 `not_ready`.
- Read and write timeouts across multiple API endpoints.

## Immediate Action Steps
1. **Assess Primary DB Node Health**:
   - Check CPU, active connections, and replication lag on primary PostgreSQL cluster.
2. **Promote Standby Read Replica**:
   - If primary is unresponsive or crashed, initiate automated standby promotion:
     - Verify replication lag < 1s.
     - Promote standby replica to primary master.
     - Update database connection pool URI in environment / secrets manager.
3. **Drain Connection Pool**:
   - Reset connection poolers (e.g. PgBouncer) to flush stale connections to old primary.
4. **Verify Readiness**:
   - Confirm `/api/v1/health/readiness` returns 200 OK.

## Post-Incident Actions
- Restore standby replication pool.
- Run database integrity checks across financial ledger tables.
