# 04 — Creator Outcomes & Holder Growth Quality (Sprint 38 §21-26)

## 1. Multi-Horizon Creator Outcome Tracking (§21-23)

The engine archives empirical post-launch outcomes across 5 standard horizons:
- **1 Hour Post-Launch**: Initial price discovery velocity and early holder count.
- **6 Hours Post-Launch**: Median price retention, initial drawdown, and volume persistence.
- **24 Hours Post-Launch**: First daily cycle survival, creator wallet net disposal.
- **7 Days Post-Launch**: Liquidity stability and organic community distribution.
- **30 Days Post-Launch**: Long-term graduation rate and operational token longevity.

---

## 2. Creator Reputation Scoring Model (§23)

The Creator Reputation Score ($0 - 100$) balances historical graduation success against malicious drain events:

$$\text{Success Ratio} = \frac{\text{Successful / Graduated Launches}}{\text{Total Launches}}$$

$$\text{Drain Penalty} = \left(\frac{\text{Liquidity Removal Incidents}}{\text{Total Launches}}\right) \times 60$$

$$\text{Reputation Score} = \min\left(100, \max\left(0, \text{round}(\text{Success Ratio} \times 60 + 30 - \text{Drain Penalty})\right)\right)$$

### Status Tiers:
- **`TRUSTED`**: Score $\ge 75$, 0 liquidity drain incidents.
- **`MODERATE_RISK`**: Score $40 - 74$.
- **`HIGH_RISK`**: Score $< 40$.
- **`KNOWN_BAD_ACTOR`**: $\ge 2$ historical liquidity drain incidents.

---

## 3. Holder Growth Quality vs. Sybil Spikes (§24-26)

A raw increase of $+5,000$ holders is audited before generating positive sentiment:
- **Cohort Retention**: What percentage of holders retain their balance for $> 24$ hours?
- **Distribution Entropy**: Are tokens dispersed evenly, or do top clusters own effective control?
- **Effective Ownership**: Combines linked cluster balances into estimated true control percentage.
