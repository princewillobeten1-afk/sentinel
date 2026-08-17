# Portfolio

Cost basis, lot tracking, P&L, risk scoring, exposure and performance
analytics for a wallet (Sprint 9's portfolio engine, wrapped behind the
gateway this sprint).

**Scope:** `READ_PORTFOLIO`. **Auth:** `allowSessionAuth` — no
`optionalAuth`, since these endpoints were never callable without a session
before this sprint and always required the caller to own the wallet.

| Endpoint | Returns |
|---|---|
| `GET /api/v1/portfolio/:wallet` | Full portfolio snapshot |
| `GET /api/v1/portfolio/:wallet/positions?sort=RISK&direction=desc&status=OPEN` | Sortable/filterable position table |
| `GET /api/v1/portfolio/:wallet/pnl` | Realized/unrealized/net P&L by window, plus per-position attribution |
| `GET /api/v1/portfolio/:wallet/risk` | Portfolio risk score, weighted decomposition, named drivers |
| `GET /api/v1/portfolio/:wallet/exposure` | Breakdown by token, chain, risk class, creator |
| `GET /api/v1/portfolio/:wallet/performance` | Trading performance, drawdown, strategy attribution |

## Wallet ownership

Every one of these calls `getPortfolioForWallet` (`lib/portfolio/service.ts`),
which checks `isWalletAuthorized(wallet, userWallets, groups, userId)`
before returning anything. Requesting a wallet you don't own — with a
perfectly valid session or API key — gets `403 WALLET_NOT_AUTHORIZED`. The
gateway only changes *how* the caller is authenticated; this check is
unchanged from before this sprint.

```bash
curl https://your-host/api/v1/portfolio/7xK9.../risk \
  -H "Authorization: Bearer sk_live_..."
```
