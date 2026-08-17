# 06 — Backup, Disaster Recovery & Database Security (Sprint 35 §93-95)

## 1. Backup & Point-in-Time Recovery (PITR)
- **Continuous Write-Ahead Logging (WAL)**: WAL stream continuously archived to cross-region object storage (S3/GCS).
- **Daily Automated Physical Snapshots**: Retained for 35 days with automated integrity verification.
- **RPO Target**: ≤ 1 minute for Tier A financial data.
- **RTO Target**: ≤ 15 minutes to spin up a fully operational replacement cluster.

---

## 2. Database Security & Access Governance
- **Encryption at Rest**: AWS KMS / AES-256 encryption across all storage volumes, WAL archives, and automated backups.
- **Encryption in Transit**: Strict TLS 1.3 required for all database client connections (`sslmode=require`).
- **Network Isolation**: PostgreSQL cluster resides strictly within private VPC subnets with zero public IP exposure.
- **Least-Privilege Roles**:
  - `app_reader`: `SELECT` privileges only on specified read replica tables.
  - `app_writer`: `SELECT, INSERT, UPDATE` on OLTP tables (no `DROP` or `TRUNCATE`).
  - `migration_admin`: DDL execution privileges restricted to automated CI/CD runners.
