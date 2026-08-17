# Discovery

Ranked token feeds by category, backed by `lib/discovery/ranking-cache.ts`
and real scoring math over a small, pre-existing mock data layer (the
scoring is real; the underlying token set is not a live firehose).

**Scope:** `READ_MARKET_DATA`. **Auth:** `optionalAuth` for every list
endpoint — matching the public discovery feed's existing unauthenticated
usage — **except** `watchlist`, which is personalized to the caller and
requires a real session or API key (`allowSessionAuth`).

| Endpoint | Returns |
|---|---|
| `GET /api/v1/discovery` | The combined discovery feed |
| `GET /api/v1/discovery/trending` | Trending category |
| `GET /api/v1/discovery/momentum` | Momentum category |
| `GET /api/v1/discovery/volume` | Volume-surge category |
| `GET /api/v1/discovery/liquidity` | Liquidity-change category |
| `GET /api/v1/discovery/movers` | Market movers |
| `GET /api/v1/discovery/new` | Newly listed tokens |
| `GET /api/v1/discovery/:token/signals` | Anomaly + trending-score detail for one token |
| `POST /api/v1/discovery/screen` | Filter/sort/paginate by arbitrary criteria |
| `GET /api/v1/discovery/watchlist` | Personalized ranking for the caller's watchlist |

All list endpoints accept `chain`, `timeWindow`, `limit`, `offset` query
params. `POST /screen` additionally accepts a `sort` key
(`trending`/`volume`/`liquidity`/`age`/`price_change`/`market_cap`/`score`)
in its body and is separately rate-limited at the app level (30 req/min)
regardless of your API-key tier.

```bash
curl "https://your-host/api/v1/discovery/trending?timeWindow=1h&limit=20" \
  -H "Authorization: Bearer sk_live_..."
```
