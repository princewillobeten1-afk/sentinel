# Creator

Deployer identity, launch history, associated wallets, and reputation. Real
identification (`identifyCreator`) and real reputation scoring
(`calculateReputation`) — the reputation dimension used to be a placeholder
stage before this sprint wired it up (`lib/creator/context-builder.ts`).

**Scope:** `READ_REPUTATION`. **Auth:** `optionalAuth`.

| Endpoint | Returns |
|---|---|
| `GET /api/v1/creator/:chain/:address` | Full creator entity |
| `GET /api/v1/creator/:chain/:address/history` | Launch history |
| `GET /api/v1/creator/:chain/:address/relationships` | Associated wallets |
| `GET /api/v1/creator/:chain/:address/reputation` | Reputation score (8-dimension breakdown) |

`:address` accepts a wallet address, a creator ID, or a known token symbol
— the routes resolve all three the way the underlying data does. A creator
who's never been identified reads back a `null`/`INSUFFICIENT` reputation
rather than a fabricated score.

```bash
curl https://your-host/api/v1/creator/solana/SENT/reputation \
  -H "Authorization: Bearer sk_live_..."
```
