# Incident Postmortem: [INC-YYYY-MM-DD: Title]

## Summary
- **Date & Time**: YYYY-MM-DD HH:MM UTC
- **Duration**: XX minutes
- **Severity**: P1 Critical / P2 High
- **Services Impacted**: Trading API, Market Data, etc.
- **User Impact**: XX users experienced failed swaps; $0 funds lost.

## Timeline (UTC)
- **HH:MM**: Incident started.
- **HH:MM**: Alert fired (`RPC_CIRCUIT_BREAKER_OPEN`).
- **HH:MM**: On-call engineer acknowledged alert.
- **HH:MM**: Failover initiated to secondary provider.
- **HH:MM**: Traffic normalized; health check returned healthy.
- **HH:MM**: Incident resolved.

## Root Cause Analysis (5 Whys)
1. **Why did trading fail?** Primary RPC provider experienced 504 Gateway Timeouts.
2. **Why did RPC time out?** Upstream Solana validator leader slot congestion during NFT mint.
3. **Why didn't circuit breaker trip immediately?** Failure threshold was set to 5 rather than 3.
4. **Why did user see "Submitting..."?** WebSocket reconnection was retrying with linear rather than exponential backoff.

## Blameless Philosophy (Sprint 32 §79)
This postmortem focuses entirely on **how we make the system harder to break next time**, not on assigning personal blame.

## Corrective & Preventive Action Items
| Action Item | Type | Owner | Target Date |
| :--- | :--- | :--- | :--- |
| Lower RPC circuit breaker threshold from 5 to 3 | Prevent | Core Team | 2026-08-20 |
| Implement full jitter on WebSocket reconnection | Mitigate | Frontend Team | 2026-08-22 |
| Add automated monthly disaster recovery drill | Detect | DevOps | 2026-09-01 |
