# 06 — Multi-Mode Discovery, Anomalies & Backtesting (Sprint 38 §38-51, §88-91)

## 1. Multi-Mode Discovery Ranking Matrix (§38-40)

To avoid forcing a single "best token" list on traders with differing strategies, Sentinel provides tailored discovery modes:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ MULTI-MODE DISCOVERY RANKING STRATEGIES                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ • TRENDING: Balanced composite momentum, organic volume, and exitability    │
│ • SAFEST: Maximizes creator reputation, liquidity health, and exitability   │
│ • FASTEST_GROWTH: Prioritizes 24h holder acceleration and price trajectory  │
│ • HIGHEST_ORGANIC_VOLUME: Filters out wash-traded and insider-churned tokens│
│ • BEST_EXITABILITY: Surfaces tokens capable of absorbing large market orders │
│ • SMART_MONEY: Tokens currently seeing accumulation by alpha wallets        │
│ • NEW_LAUNCHES: Tokens deployed within the last 60 minutes                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Statistical Anomaly Detection ($z$-Score Baseline) (§43-44)

The engine monitors continuous metrics against rolling historical baselines ($\mu, \sigma$).
When an observed value deviates by $\ge 2.5\sigma$, a statistical anomaly event is generated:

$$z = \frac{X - \mu}{\sigma}$$

| Absolute $z$-Score | Severity Rating | Action |
| :--- | :--- | :--- |
| **$|z| \ge 2.5$** | `WARNING` | Surface warning badge in Token Explorer |
| **$|z| \ge 3.5$** | `HIGH` | Dispatch Smart Alert to subscribed traders |
| **$|z| \ge 4.5$ or Liquidity Drain $z \le -3.0$** | `CRITICAL` | Trigger High-Risk warning & Pre-Trade advisory halt |

---

## 3. Strict No-Look-Ahead Historical Backtesting (§48-51, §88-91)

Researchers and quantitative traders can simulate signal performance over historical token datasets.

### Mandatory Epistemic Rule (§91):
> **Historical models must strictly consume state timestamped $\le T$ at evaluation time. No future information (e.g. 24h peak market cap or subsequent developer sell-offs) may enter the signal computation.**

### Performance Metrics Computed:
- **Precision**: Percentage of triggered signals that yielded positive net returns after friction.
- **Recall**: Percentage of profitable market opportunities captured by the signal.
- **Profit Factor**: Gross gains divided by gross losses.
- **Max Drawdown**: Peak-to-trough decline experienced over the holding horizon.
