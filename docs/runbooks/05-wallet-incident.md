# Operational Runbook: Wallet Compromise & Security Incident (RUNBOOK-05)

## Severity Tier
P1 Critical

## Symptoms
- User reports compromised private key or suspicious session activity.
- Alert `ANOMALOUS_WALLET_ACTIVITY` or `NEW_IP_UNUSUAL_VOLUME`.

## Immediate Action Steps
1. **Revoke Active Sessions Immediately**:
   - Invalidate all active JWT tokens and sessions for the user:
     ```bash
     POST /api/v1/auth/sessions/revoke-all
     ```
2. **De-link Compromised Wallet Address**:
   - Update wallet record to `suspended` status.
3. **Audit Transaction Log**:
   - Pull the last 24 hours of audit events for the `userId` from `audit_logs_partitioned`.
4. **Block Suspicious Destination Wallets**:
   - Add malicious destination addresses to the security risk blacklist.
