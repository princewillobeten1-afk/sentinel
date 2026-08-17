# 02 — Multi-Domain PostgreSQL Production Schemas (Sprint 35 §7-78)

## 1. Complete Domain Table Directory

```text
1. Identity Domain:      users, user_profiles, user_settings, devices, sessions
2. Wallet Domain:        wallets, wallet_addresses, wallet_verifications, watched_wallets
3. Chain & Token Domain: chains, tokens, token_metadata, token_contracts, token_holders
4. Creator & Rep Domain: creators, creator_launches, creator_reputation, creator_reputation_snapshots, reputation_events
5. Clustering Domain:    wallet_clusters, wallet_cluster_members, effective_ownership, ownership_evidence
6. Liquidity & DEX:      dexes, liquidity_pools, liquidity_snapshots
7. Blockchain & Trades:  blocks, blockchain_transactions, blockchain_events, trades
8. Token Intelligence:   token_intelligence, token_intelligence_snapshots, risk_signals, organic_volume_analysis, insider_signals, exitability_scores, token_reports
9. Orders & Portfolio:   orders, order_events, executions, positions, portfolios, portfolio_holdings, pnl_events, fee_events, risk_rules
10. Alerts & Messaging:  alerts, alert_conditions, alert_events, notifications, notification_deliveries
11. Copy Trading:        copy_strategies, copy_targets, copied_trades
12. Launchpad Domain:    launchpads, launch_projects, launch_events
13. API & Social:        api_keys, api_usage, referrals, reward_events
14. Admin & Security:    audit_logs, admin_actions, feature_flags
15. AI Infrastructure:   ai_models, ai_requests, ai_outputs
```

---

## 2. Core Entity Constraints & Precision Standards

- **UUID Strategy**: All entities utilize UUIDv7 or prefixed alphanumeric identifiers (`usr_...`, `ord_...`, `tok_...`).
- **Precision Standards**:
  - Token Balances & Quantities: `NUMERIC(36, 18)` (handles up to 18 decimal places without precision loss).
  - USD Prices & Values: `NUMERIC(24, 12)` (accommodates micro-cap meme token prices down to 12 decimal places).
  - P&L & Fee Aggregations: `NUMERIC(24, 6)`.
- **Unique Invariants**:
  - `tokens`: `UNIQUE(chain_id, address)`
  - `liquidity_pools`: `UNIQUE(chain_id, pool_address)`
  - `positions`: `UNIQUE(user_id, wallet_id, token_id)`
  - `blockchain_events`: `UNIQUE(chain_id, transaction_id, event_index)`
