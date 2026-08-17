# 13 — Infrastructure, Containerization & CI/CD Pipeline (Sprint 34 §69-73)

## 1. Production Infrastructure Topology

```text
                               INTERNET
                                  │
                           Cloudflare WAF / CDN
                                  │
                           ALB (Load Balancer)
                                  │
    ┌─────────────────────────────┼─────────────────────────────┐
    ▼                             ▼                             ▼
API Gateway Cluster       WebSocket Cluster            Worker Cluster
(Node.js Next.js App)     (Node.js WS Gateway)         (Background Indexers & AI)
    │                             │                             │
    └─────────────────────────────┼─────────────────────────────┘
                                  │ (Private VPC Subnet)
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
PostgreSQL Primary + Replica    Redis Cluster          ClickHouse OLAP
(Multi-AZ RDS)                  (AWS ElastiCache)      (Clustered Storage)
```

- **Containerization**: All services are packaged as lightweight, multi-stage Alpine Docker images with non-root security contexts.
- **Orchestration**: Managed Kubernetes (EKS / GKE) with Horizontal Pod Autoscalers (HPA) targeting 65% CPU / memory utilization.

---

## 2. CI/CD Deployment Pipeline

```text
git push (main)
      │
      ▼
1. LINT & TYPECHECK (`npm run lint`, `tsc --noEmit`)
      │
      ▼
2. AUTOMATED UNIT TESTS (`npx vitest run`)
      │
      ▼
3. INTEGRATION & RISK ENGINE TESTS
      │
      ▼
4. SECURITY & SECRET SCAN (Trivy, GitGuardian, Snyk)
      │
      ▼
5. DOCKER BUILD & CONTAINER SIGNING (Cosign)
      │
      ▼
6. DEPLOY TO STAGING (Automated E2E Playwright Suite)
      │
      ▼
7. PROGRESSIVE CANARY ROLLOUT (10% -> 50% -> 100% with error budget monitoring)
      │
      ▼
8. PRODUCTION RELEASE (Automated Rollback on Error Spike)
```

---

## 3. Key Management & Secrets Architecture
- **Zero Secrets in Code**: Private keys, database credentials, and API tokens are injected strictly via AWS Secrets Manager / HashiCorp Vault.
- **Platform Custody & Signing**: Platform-controlled signing keys (launchpad escrow, fee collection) reside in Hardware Security Modules (AWS CloudHSM) or Multi-Party Computation (MPC) custody services.
