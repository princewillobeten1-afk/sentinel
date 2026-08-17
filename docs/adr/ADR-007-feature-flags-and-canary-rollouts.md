# ADR-007: Feature Flags and Progressive Canary Rollouts

## Status
Accepted (Sprint 32)

## Context
Deploying major financial trading and automated routing features directly to 100% of users in a single deployment introduces high risk of unforeseen smart contract interactions, liquidity drain, or client-side edge cases.

## Decision
1. Implement a lightweight, deterministic `FeatureFlag` engine.
2. Progressive Rollout stages:
   `Internal Admins / Alpha (0%) -> Canary (10%) -> Expanded (50%) -> General Availability (100%)`.
3. Deterministic user hash bucketing: `MD5(featureKey:userId) % 100` ensures that a specific user remains consistently in the enabled or disabled group throughout a rollout without sticky session state.
4. Provide emergency kill switches that instantly disable a feature flag if error rates or anomaly detection alerts fire.

## Consequences
- High-risk trading features can be validated safely in live production with real traders in small controlled cohorts before broad release.
- Zero-downtime feature rollback without code redeployments.
