# Safety Checks & Slippage Enforcement

The execution engine enforces multi-layered safety controls to protect user funds from sandwich attacks, frontrunning, slippage spikes, and quote drift.

---

## 1. Server-Side Slippage Enforcement

The frontend cannot override or weaken server-side slippage invariants:

$$minimumReceived = quotedOutput \times (1 - slippage)$$

- **Exact Input Swaps**: $amountOutMin$ is encoded directly in the smart contract / instruction calldata.
- **Maximum Slippage Bounds**: Default platform maximum is $5.0\%$. Requests exceeding this ceiling are rejected with `SLIPPAGE_TOO_HIGH` unless an explicit user override policy exists.

---

## 2. Quote Drift & Price Movement Checks

Before signing and broadcasting, the engine verifies that the underlying liquidity reserves have not shifted significantly between the time the quote was issued and execution:

$$\Delta_{drift} = \left| \frac{P_{current} - P_{quoted}}{P_{quoted}} \right|$$

- If $\Delta_{drift} > \text{MaxAllowedDrift}$ (default: $1.5\%$):
  - Execution is immediately rejected with `QUOTE_MOVED`.
  - The UI is instructed to fetch a fresh authoritative quote.

---

## 3. Native Token Gas Sufficiency

Before dispatching an execution payload for signature:
- For Solana: Verify user's balance contains sufficient SOL for transaction signature fees and ATA rent.
- For EVM: Verify user's balance contains sufficient ETH/native token to pay `gasLimit * maxFeePerGas`.
- If insufficient, the request aborts early with `INSUFFICIENT_GAS_BALANCE`.

---

## 4. Contract Allowlists & Token Blocklists

- **Router Allowlist**: Only pre-verified DEX router contracts can be targeted.
- **Token Blocklist**: Administrators can immediately block blacklisted, compromised, or scam tokens via `ExecutionBlocklist`. Any execution involving a blocklisted asset is halted with `TOKEN_BLOCKED`.
