# MEV Protection & Operational Security

This specification outlines the MEV-aware execution architecture, private relay routing, emergency kill switches, and access controls.

---

## 1. MEV Protection Policies

To protect large orders and high-value swaps from frontrunning, sandwiching, and predatory MEV bots:

```typescript
export enum MEVProtectionStrategy {
  PUBLIC_MEMPOOL = 'PUBLIC_MEMPOOL',         // Standard public broadcast
  PROTECTED_ROUTE = 'PROTECTED_ROUTE',       // Priority compute units + slippage bounding
  PRIVATE_RPC = 'PRIVATE_RPC',               // Flashbots Protect / Jito Bundle Relays
  CHAIN_SPECIFIC = 'CHAIN_SPECIFIC'          // Fast-lane sequencer / Private Mempools
}
```

### Routing Criteria:
- **Trade Value $> \$5,000$ or Price Impact $> 2.0\%$**: Automatically routes via `PRIVATE_RPC` (Jito on Solana, Flashbots Protect on EVM).
- **Fallback Rule**: If private relay broadcast fails, the system does **NOT** fall back to public mempool unless explicitly allowed by the user's `ExecutionPolicy`.

---

## 2. Emergency Execution Kill Switch

Administrators have access to an instant circuit breaker:

- `ExecutionKillSwitch.enableKillSwitch(reason, adminId)`:
  - All new incoming execution requests (`POST /api/v1/executions`) are immediately rejected with `EXECUTION_SERVICE_DISABLED`.
  - In-flight pending transactions continue being monitored to confirmation.
- `ExecutionKillSwitch.disableKillSwitch(adminId)`: Restores normal operation after system clearance.

---

## 3. Operational Token & Contract Blocklist

Admins can flag compromised tokens or malicious contracts:
- `ExecutionBlocklist.blockTarget(type: 'TOKEN' | 'CONTRACT', address, reason)`
- Any execution matching a blocked target is rejected with `EXECUTION_TARGET_BLOCKED`.
