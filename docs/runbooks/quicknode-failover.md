# QuickNode mainnet fallback

Sentinel keeps Birdeye for market analytics and Helius for enriched data and the primary Solana log stream. QuickNode supplies a second, server-only Solana RPC endpoint and an optional standby WebSocket endpoint. It does not provide derived prices, OHLCV, holder classifications, or Helius parsing.

Configure `QUICKNODE_SOLANA_RPC_URL` with the HTTPS URL and `QUICKNODE_SOLANA_WSS_URL` with the corresponding WSS URL from the **same Solana mainnet** QuickNode endpoint. Do not prefix either name with `NEXT_PUBLIC_`, and do not point the browser wallet's devnet RPC at QuickNode mainnet. The server verifies the QuickNode RPC's genesis hash before it performs a fallback read or moves the log subscription. An invalid, non-HTTPS/non-WSS, or wrong-network endpoint is not used. The WSS host must match the verified HTTPS host.

The market-live status route (`GET /api/v1/market/live/status`) reports `quickNode` configuration/health and `chainLogProvider`; it never returns endpoint URLs. Helius remains the primary source for chain reads. QuickNode is attempted after a failed RPC read for mint authorities, creator history, bonding curves, ownership, wallet/dev balances, and the status slot. The transaction enricher retries its existing bounded `getTransaction` request on QuickNode after a Helius timeout, HTTP 429, or 5xx. The single Solana `logsSubscribe` socket moves to QuickNode after repeated connection failures or subscription refusals; no parallel duplicate stream is opened. Birdeye subscriptions and chart data are unchanged.

If `SOLANA_TRADING_ENABLED=true`, the existing signed-transaction broadcaster can also use QuickNode as its fallback when `SOLANA_TRADING_FALLBACK_RPC_URL` is unset. It checks the mainnet genesis hash and resends the **identical signed bytes** after an uncertain primary response. Configuring QuickNode does not enable trading.

Deployment check:

1. Set the two QuickNode variables in the server secret store (or local gitignored `.env`) and restart the server. Do not commit the URLs.
2. Read market-live status: `quickNode.configured` and `quickNode.websocketConfigured` should be true. `rpcState` becomes `verified` after the first fallback/transport check. `chainLogProvider` normally remains `helius`.
3. To test failover in a non-production environment, interrupt only the Helius endpoint and confirm `chainLogProvider` changes to `quicknode`, subscriptions rebuild, and `quickNode.lastSuccessAt` advances on fallback reads. Restore Helius and restart the stream to make it primary again.
4. If QuickNode is paused or unverified, check endpoint network, paired WSS hostname, quota, and credentials in the provider dashboard. Never paste full URLs into logs or bug reports.

No live QuickNode smoke test can pass without real endpoint credentials; unit tests simulate mainnet verification and failover without sending transactions.
