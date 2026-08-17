# ADR-006: Service-Level Objectives (SLOs), SLIs, and Error Budget Management

## Status
Accepted (Sprint 32)

## Context
High availability requires explicit numeric contracts rather than vague aspirations ("99.9% everything"). Critical financial services have much stricter tolerance for failure than analytical and discovery services.

## Decision
Define explicit Service-Level Objectives (SLOs) and track real-time Service-Level Indicators (SLIs):

| Service | Tier | Availability Target | Error Budget | p95 Latency Target | p99 Latency Target |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Authentication** | Critical | 99.99% | 0.01% | 150 ms | 300 ms |
| **Trading API** | Critical | 99.99% | 0.01% | 100 ms | 250 ms |
| **Market Data** | Critical | 99.99% | 0.01% | 50 ms | 150 ms |
| **Portfolio** | Critical | 99.95% | 0.05% | 200 ms | 500 ms |
| **Discovery** | Standard | 99.95% | 0.05% | 250 ms | 600 ms |
| **Intelligence** | Standard | 99.90% | 0.10% | 400 ms | 1,000 ms |
| **Analytics** | Extended | 99.50% | 0.50% | 500 ms | 1,500 ms |

Telemetry calculations:
- Sliding time windows (1h, 24h, 7d, 30d).
- Error budget burn rate: `actualFailureRate / allowedFailureRate`. A burn rate > 1.0 triggers warning alerts; > 5.0 triggers critical paging alerts.
- Live telemetry exposed at `/api/v1/health/slo`.

## Consequences
- Clear boundary between critical financial path and non-critical enrichment.
- Provides objective data to gate production releases (freezing non-essential deployments if error budgets are depleted).
