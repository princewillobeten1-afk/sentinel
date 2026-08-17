# 02 — Authoritative Quote & Pre-Flight Simulation Engine

## 1. Quote Generation Pipeline

Quotes are authoritatively calculated server-side using fixed-point `Decimal` math. The frontend never determines swap routes or prices independently.

```text
User Input (TokenIn, TokenOut, Amount, Slippage)
   ↓
Validate Parameters (Token existence, non-zero amount, valid slippage)
   ↓
Route Calculation & Pool Depth Analysis
   ↓
Compute Price Impact & Output Amounts
   ↓
Decompose Fees (Network, Platform, DEX Pool)
   ↓
Generate Authoritative Signed Quote with 15-Second Expiration TTL
```

## 2. Mathematical Formulas

### A. Minimum Received
$$minimumReceived = expectedReceived \times (1 - slippage)$$

### B. Price Impact Rating
Price impact measures the percentage difference between the current marginal market price and the effective execution price:
$$\text{PriceImpact} = \left(1 - \frac{\text{EffectivePrice}}{\text{SpotPrice}}\right) \times 100$$

| Price Impact | Classification | UI Treatment |
|---|---|---|
| `< 1.0%` | `LOW` | Normal emerald display |
| `1.0% - 3.0%` | `MEDIUM` | Amber warning badge |
| `3.0% - 5.0%` | `HIGH` | Rose warning + explicit user checkbox acknowledgement |
| `> 5.0%` | `EXTREME` | Critical red warning + confirmation prompt |

## 3. Quote Expiration & Invalidation Triggers

Quotes have an active TTL of **15 seconds**. The frontend automatically requests a refreshed quote whenever:
1. Input amount changes.
2. Input or output token changes.
3. Slippage tolerance changes.
4. Quote expires (`now > expiresAt`).
5. Realtime pool reserves diverge by more than 0.5%.
