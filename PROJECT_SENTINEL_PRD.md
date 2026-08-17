# PRODUCT REQUIREMENTS AND DEVELOPMENT SPECIFICATION

## Working title: Project Sentinel

### An Intelligent Token Launchpad, Discovery Platform, DEX Trading Terminal, and Market-Integrity Network
**Document status:** Initial comprehensive product specification
**Primary network for first release:** Solana
**Target users:** Memecoin traders, token creators, professional on-chain traders, analysts, communities, and liquidity providers
**Product category:** Launchpad + token scanner + trading terminal + portfolio system + risk-intelligence platform

---

# 1. Executive summary
Project Sentinel will be an all-in-one platform through which users can:

- Discover newly created and existing tokens.
- Launch tokens under transparent, configurable conditions.
- Analyze tokens, creators, holders, liquidity, and trading behavior.
- Buy and sell tokens through existing decentralized liquidity.
- Create automated orders and trading strategies.
- Monitor wallets, insiders, creators, and social accounts.
- Detect coordinated ownership, fake volume, insider activity, and possible exit preparation.
- Measure real profit and loss after every cost.
- Manage several wallets from one interface.
- Trade perpetual futures.
- Earn yield on supported assets.
- Apply personal risk controls that protect traders from impulsive or dangerous trades.
- Receive explainable reports instead of unexplained risk scores.
The platform should include the major capabilities publicly documented by Axiom as a competitive baseline, but it must not reproduce Axiom’s product blindly.

Axiom currently presents itself as an all-in-one on-chain trading application offering one-click trading, token discovery, wallet tracking, social monitoring, spot trading, perpetual trading, yield-related services, portfolio monitoring, multi-wallet functionality, migration tools, limit orders, and trader analytics.

Project Sentinel will build upon that baseline with a defensible intelligence layer focused on:

1. Effective ownership rather than raw holder counts.
2. Organic demand rather than raw volume.
3. Creator history across related wallets and identities.
4. Pre-rug and insider-preparation alerts.
5. Realistic exitability and liquidity analysis.
6. Execution-quality measurement.
7. True net profit and loss.
8. Personal risk rules and account circuit breakers.
9. Explainable token reports.
10. Outcome-aligned token launches.
11. Transparent platform incentives.
12. Historical accountability for creators, wallets, and promoters.
The product’s main promise will be:

> **Discover earlier, understand ownership, verify demand, execute intelligently, and identify dangerous behavior before it becomes an avoidable loss.**

---

# 2. Product vision
Project Sentinel should become the principal operating system for speculative on-chain trading.

The platform should not compete merely by having:

- Faster charts.
- More token tables.
- More colorful dashboards.
- Another copy-trading leaderboard.
- Another basic smart-contract score.
- Another trending list ranked by volume.
- Another one-click token launcher.
Those features are becoming standard.

Project Sentinel should compete by possessing a better understanding of:

- Who controls a token.
- Whether demand is authentic.
- Whether volume is manipulated.
- Whether creators have a dangerous history.
- Whether insiders are preparing to sell.
- Whether displayed liquidity can support the user’s position.
- Whether a profitable-looking wallet can actually be copied.
- Whether a trade remains profitable after all expenses.
- Whether a particular trade violates the user’s own risk policy.
The long-term goal is to establish Project Sentinel as a **market-integrity and decision-intelligence layer** used by traders, wallets, launchpads, DEX interfaces, institutions, and third-party applications.

---

# 3. Product principles

## 3.1 Explain evidence, not just conclusions
The platform must not display an unexplained score such as:

> Safety score: 42/100
Instead, it should provide:

- The conclusion.
- The supporting evidence.
- Confidence in the conclusion.
- Potential financial impact.
- The event that triggered the warning.
- Recommended action.
- Conditions that would cause the conclusion to change.
Example:

> **Elevated coordinated-ownership risk — 87% confidence.**
> Seventeen of the top 40 holder wallets were funded by three connected addresses during the same 22-minute period. These wallets collectively control an estimated 31.4% of circulating supply.

## 3.2 Separate raw information from adjusted information
For manipulable metrics, display both:

- Raw volume and estimated organic volume.
- Raw holders and estimated independent ownership clusters.
- Raw transaction count and estimated independent transactions.
- Displayed liquidity and executable liquidity.
- Gross profit and true net profit.
- Historical wallet return and estimated copyable return.

## 3.3 Optimize for long-term trader outcomes
The platform should not be designed only to maximize trade frequency.

Its internal performance metrics should include:

- Losses avoided.
- Execution savings.
- Risk warnings delivered before major adverse events.
- User profitability after fees.
- User survival after 30, 90, and 180 days.
- Percentage of users following their own risk limits.
- Quality and longevity of tokens launched through the platform.

## 3.4 Progressive disclosure
New traders should receive a simple, understandable interface.

Advanced traders should be able to expand each section and inspect:

- Wallet graphs.
- Transaction evidence.
- Route calculations.
- Liquidity simulations.
- Risk-model outputs.
- Historical classifications.
- Raw on-chain data.
The default screen must not overwhelm users with dozens of equally weighted panels.

## 3.5 Paid promotion must never appear organic
All paid placements, boosts, sponsored tokens, and affiliate content must be clearly labelled.

Paid promotion must not secretly improve:

- Organic-demand rankings.
- Safety ratings.
- Creator reputation.
- Trending integrity.
- Search relevance presented as objective.
- Risk-model outcomes.

---

# 4. Competitive baseline: capabilities to include from Axiom
The features in this section are based on Axiom’s publicly available product documentation as reviewed for this specification. Because trading products change frequently, the development team should conduct a final competitive audit before implementation.

## 4.1 Account creation and onboarding
The platform must support:

- Email registration.
- Google authentication.
- External-wallet authentication.
- One-time verification codes.
- Password or passkey setup.
- Embedded-wallet creation.
- External-wallet connection.
- Secure wallet recovery.
- Recovery-phrase or private-key export where the custody design permits it.
- Initial deposit instructions.
- Guided first-trade onboarding.
- A demonstration mode that does not require depositing funds.
Axiom publicly documents email, Google, and Phantom signup paths, an embedded recovery phrase, direct SOL deposits, and a connected fiat-to-crypto purchase route.

### Additional Project Sentinel requirements

- Passkeys should be preferred over passwords.
- Sensitive actions should support step-up authentication.
- Users should be able to create restricted trading sessions.
- Session keys should have spending, asset, contract, and time limits.
- The platform should never request recovery phrases through support.
- Users should receive warnings when interacting with suspicious sites or contracts.
- Account recovery must not permit the platform to seize user assets.
- The custody and key-management model must be documented and independently audited.

---

## 4.2 Embedded and connected wallets
The platform should provide:

- A built-in Solana wallet.
- Connection to popular external Solana wallets.
- Deposit and withdrawal.
- Token balances.
- Transaction history.
- Address book.
- Network-fee estimates.
- Token conversion.
- Exportable transaction records.
- Wallet naming and categorization.
The product must clearly state whether each wallet is:

- Self-custodial.
- Embedded but user-controlled.
- Externally connected.
- Watch-only.
- Delegated for restricted trading.
- Controlled by a smart account.

---

## 4.3 Fiat and crypto funding
Users should be able to:

- Deposit SOL, stablecoins, and supported assets.
- Purchase supported crypto through integrated providers.
- Convert supported assets into trading assets.
- Withdraw to external wallets.
- View provider fees before confirming.
- View expected delivery time and network.
- Confirm destination addresses before funds are sent.
Axiom documents an integrated purchase flow through Coinbase and an internal conversion flow between supported assets.

Project Sentinel should support multiple compliant providers rather than depending entirely on one provider.

---

## 4.4 Token discovery
The discovery system must include:

- Newly created tokens.
- Tokens approaching bonding-curve completion.
- Recently migrated tokens.
- Newly created DEX pairs.
- Trending tokens.
- Gainers and losers.
- High-volume tokens.
- High-liquidity tokens.
- Recently revived tokens.
- Watchlisted tokens.
- Similar tokens.
- Older or “legacy” tokens.
- Search by name, ticker, mint address, pool address, or creator.
- Custom saved discovery feeds.
- Custom screeners.
- Quick-buy controls.
Axiom’s Pulse interface publicly documents separate views for new creations, tokens in the final stage of a bonding curve, and tokens recently migrated to Raydium. It also supports quick buying from those tables.

Axiom’s Explore functionality includes new pairs, trending tokens, search, watchlists, selectable periods, and filters for metrics such as liquidity, volume, market capitalization, transactions, top-holder concentration, and paid DEX listings.

Its Similar Tokens functionality also describes an “OG Mode” that surfaces older tokens with larger market capitalizations.

### Required standard filters

- Token age.
- Launch source.
- Bonding-curve progress.
- Migration status.
- Market capitalization.
- Fully diluted valuation.
- Liquidity.
- Volume by period.
- Transaction count.
- Buy count.
- Sell count.
- Buy-to-sell ratio.
- Unique buyers.
- Unique sellers.
- Holder count.
- Top-10 holder percentage.
- Developer holding percentage.
- Insider percentage.
- Sniper percentage.
- Bundled supply percentage.
- Pro-trader participation.
- Social presence.
- Paid-listing status.
- Creator verification.
- Creator reputation.
- Contract-risk status.
Axiom’s Pulse documentation currently includes filters for age, top-holder ownership, developer holdings, snipers, insiders, bundled wallets, holders, professional traders, liquidity, volume, market capitalization, transactions, buys, and sells.

### Project Sentinel differentiated filters
The platform must add:

- Estimated independent holder clusters.
- Cluster-adjusted top-10 ownership.
- Likely insider-controlled supply.
- Organic-volume percentage.
- Organic-buyer growth.
- Wallet-funding concentration.
- Creator historical survival rate.
- Creator historical rug or abandonment rate.
- Sell-ready insider supply.
- Estimated executable liquidity.
- Maximum safe position size.
- Wash-trading probability.
- Social-authenticity score.
- Liquidity-quality score.
- Risk-adjusted momentum.
- Pre-dump activity status.
- Historical data confidence.
- Risk change over time.

---

## 4.5 Token watchlists
Users must be able to:

- Add or remove tokens from watchlists.
- Create multiple named watchlists.
- Add notes and trade theses.
- Set watchlist-specific columns.
- Share public or private watchlists.
- Follow a watchlist created by another user.
- Sort by opportunity, risk, activity, or recent changes.
- Receive a summary of changes since the user last opened the list.
Watchlists should support folders such as:

- Researching.
- Waiting for entry.
- Holding.
- High risk.
- Creator watch.
- Possible insider activity.
- Long-term projects.
- Recently migrated.

---

## 4.6 Trading chart and market page
The token trading page should include:

- Real-time candlestick chart.
- Multiple timeframes.
- TradingView or equivalent charting.
- Drawing tools.
- Technical indicators.
- Price and market-cap modes.
- Volume.
- Liquidity.
- Market capitalization.
- Fully diluted valuation.
- Pair age.
- Token age.
- Bonding-curve information.
- Recent trades.
- Buy and sell controls.
- Open orders.
- User position.
- Average entry.
- Realized and unrealized P&L.
- Token information.
- Social links.
- Creator information.
- Holder analysis.
- Liquidity analysis.
- Transaction explorer links.
Axiom documents an integrated TradingView charting experience and market pages that expose token price-related information, liquidity, volume, market capitalization, position information, and trading controls.

---

## 4.7 Market orders and one-click trading
The platform must support:

- Market buys.
- Market sells.
- Preset buy amounts.
- Preset sell percentages.
- One-click trading.
- Quick-buy buttons in discovery tables.
- Quick-sell buttons.
- Keyboard shortcuts.
- Confirmation modes.
- Optional confirmation bypass for experienced users.
- User-configurable slippage.
- Priority-fee controls.
- MEV-protection controls.
- Transaction simulation.
- Clear pre-trade cost estimates.
Axiom’s Instant Trade feature publicly describes a chart-adjacent popup for one-click buying and selling, together with configurable hotkeys.

### Safety requirement
One-click trading must be disabled by default for new accounts until the user:

1. Completes a risk explanation.
2. Sets a maximum one-click order size.
3. Selects a slippage ceiling.
4. Understands that execution is not guaranteed.
5. Activates the feature explicitly.

---

## 4.8 Limit and automated orders
The product must support:

- Limit buy.
- Limit sell.
- Stop-loss.
- Take-profit.
- Multiple take-profit levels.
- Trailing stop.
- Break-even stop.
- Time-based exit.
- Maximum-loss exit.
- Market-cap-triggered order.
- Liquidity-triggered exit.
- Insider-activity-triggered exit.
- Creator-wallet-activity-triggered exit.
- Conditional order combinations.
- Order expiry.
- Partial fills.
- Order editing and cancellation.
- Drag-and-drop order placement on charts.
Axiom publicly documents buy and sell limit orders, including chart-based order placement.

### Project Sentinel differentiation
Project Sentinel must support **risk-event orders**, such as:

- Sell 50% if likely insiders transfer more than 3% of supply into sell-ready wallets.
- Sell if liquidity declines by 15% within five minutes.
- Sell if organic volume falls below 35%.
- Block additional purchases if cluster-adjusted insider ownership exceeds 40%.
- Reduce the position when creator-risk status changes to critical.
Because risk analytics can produce false positives, these rules must let users choose between:

- Alert only.
- Request confirmation.
- Execute automatically.

---

## 4.9 Migration trading and sniper functionality
The platform should support:

- Buy on migration.
- Sell on migration.
- Token migration monitoring.
- Bonding-curve completion alerts.
- Migration transaction detection.
- Automatic migration orders.
- Configurable migration fees.
- Expected execution simulation.
- Scam-token and duplicate-token warnings.
- Migration failure handling.
Axiom publicly documents an internal migration sniper that can buy when a token migrates from Pump.fun to Raydium, as well as migration-related sell functionality.

### Project Sentinel protections
Before a migration order is activated, show:

- Creator history.
- Cluster-adjusted insider ownership.
- Bundled allocation.
- Estimated sniper competition.
- Likely initial price impact.
- Maximum safe position.
- Liquidity expected after migration.
- Expected follower disadvantage.
- Probability that the trade cannot be exited at the displayed valuation.

---

## 4.10 Transaction fees, priority settings, and MEV protection
The execution settings must include:

- Base network fee.
- Priority fee.
- Validator or block-engine tip.
- Platform fee.
- Referral rebate.
- Slippage.
- Route.
- Expected output.
- Minimum output.
- Transaction-expiry policy.
- MEV-protection mode.
- Execution-speed mode.
- Fee presets.
- Automatically recommended settings.
Axiom documents user-configurable priority fees, bribes or tips, slippage, fee presets, automatically recommended settings, and three MEV modes identified as Off, Reduced, and Secure.

### Project Sentinel execution modes
Provide four clearly explained modes:

#### Economy

- Lower fees.
- Longer expected confirmation.
- Appropriate for liquid, non-urgent trades.

#### Balanced

- Dynamic priority fee.
- Standard MEV protection.
- Default mode for most users.

#### Fast

- Higher priority.
- Multiple transaction-delivery routes.
- Intended for time-sensitive execution.

#### Protected

- Private or protected transaction delivery where available.
- Maximum practical sandwich and front-running protection.
- May be slower or more expensive.
Do not claim any mode guarantees complete MEV protection.

---

## 4.11 Wallet tracking
Users must be able to:

- Add watch-only wallet addresses.
- Label wallets.
- Group wallets.
- Assign emojis or colors.
- Monitor buys and sells in real time.
- View wallet positions.
- Receive alerts when tracked wallets trade.
- See tracked-wallet activity directly on token charts.
- Import and export wallet lists.
- Share public wallet lists.
- Set different alert rules for each wallet.
Axiom documents a wallet tracker that displays monitored-wallet trading activity in real time and can surface tracked-wallet purchases within Pulse.

### Project Sentinel wallet intelligence
For every tracked wallet, calculate:

- Realized P&L.
- Unrealized P&L.
- True net P&L.
- Win rate.
- Median return.
- Maximum drawdown.
- Average holding period.
- Position-size distribution.
- Preferred launch sources.
- Entry timing relative to launch.
- Exit timing relative to peak.
- Creator associations.
- Insider associations.
- Funding sources.
- Related wallet clusters.
- Historical token quality.
- Estimated copyable return.
- Follower capacity.
- Probability of manipulated performance.

---

## 4.12 Multi-wallet management
The platform must support:

- Multiple embedded wallets.
- Multiple connected wallets.
- Watch-only wallets.
- Unified balances.
- Unified open orders.
- Unified transaction history.
- Quick wallet switching.
- Wallet naming.
- Wallet grouping.
- Strategy assignment.
- Per-wallet fee settings.
- Per-wallet risk rules.
- Per-wallet permissions.
- Consolidated portfolio reporting.
- Optional simultaneous orders across selected wallets.
Axiom describes a multi-wallet dashboard with unified visibility, quick switching, balances, open orders, transactions, and custom wallet labels.

### Critical restriction
The product must not promote multi-wallet functionality for:

- Manipulating token distributions.
- Evading launch restrictions.
- Faking holder counts.
- Wash trading.
- Evading sanctions or legal obligations.
- Misleading other market participants.
The platform should detect and restrict abusive coordinated behavior conducted through its own interfaces.

---

## 4.13 Social and account monitoring
The platform should provide:

- Real-time monitoring of selected X/Twitter accounts.
- Lists of high-impact accounts.
- User-created monitoring groups.
- Keyword alerts.
- Contract-address detection.
- Token-name detection.
- Deleted-post alerts where legally and technically available.
- Account-renaming history.
- Suspicious account-compromise indicators.
- Social post overlays on price charts.
- Social-event timelines.
- Links between social accounts and previous token projects.
Axiom publicly documents a built-in real-time Twitter/X monitor for selected crypto accounts.

### Project Sentinel social-integrity additions
Calculate:

- Account age.
- Username-change history.
- Follower-growth quality.
- Engagement authenticity.
- Repeated promoter networks.
- Deleted-project history.
- Previously promoted failed tokens.
- Coordinated-posting probability.
- Paid-promotion disclosure status.
- Similarity between current and prior project branding.
- Website, domain, and metadata reuse.
Social analysis must be presented as probabilistic evidence, not proof of misconduct.

---

## 4.14 Trader Scan
The token page should include wallet-level trading information for participants in the market:

- Amount purchased.
- Amount sold.
- Remaining balance.
- Average entry.
- Realized P&L.
- Unrealized P&L.
- Holding duration.
- First purchase time.
- Last purchase time.
- First sale time.
- Last sale time.
- Accumulating, distributing, or inactive classification.
- Wallet tags.
- Cluster membership.
- Creator or insider association.
Axiom’s Trader Scan documents wallet-level bought and sold amounts, current balances, realized P&L, and holding duration.

Project Sentinel should extend this from a list of wallets into a graph of likely economic actors.

---

## 4.15 Bundle detection
The platform must detect:

- Multiple purchases within the same block or slot.
- Repeated bundled behavior.
- Bundled supply percentage.
- Wallets consistently participating in coordinated transactions.
- Potential creator-associated bundles.
- Potential independent searcher bundles.
- Supply moved out of bundle wallets.
- Current bundle-cluster ownership.
Axiom’s public FAQ describes a bundle checker that considers multiple transactions in the same block and attempts to filter wallets that do not maintain a bundling pattern. It also acknowledges that bundle detection can produce false positives and misses.

### Project Sentinel differentiation
Bundle detection should not stop at launch. The platform must:

- Continue tracking bundle wallets.
- Cluster their funding sources.
- Detect supply redistribution.
- Show realized profit.
- Estimate remaining sell pressure.
- Identify whether bundle wallets are still coordinated.
- Distinguish probable creator bundles from independent trader bundles.
- Publish confidence levels and evidence.

---

## 4.16 Spot portfolio
The spot portfolio should display:

- Total portfolio value.
- Available balance.
- Realized P&L.
- Unrealized P&L.
- True net P&L.
- P&L chart.
- Active positions.
- Amount bought.
- Amount sold.
- Remaining token balance.
- Average entry.
- Current value.
- Estimated exit value.
- Profit percentage.
- Transaction history.
- Token age at entry.
- Market capitalization at entry and exit.
- Links to explorers.
- Open orders.
- Risk exposure.
Axiom’s spot portfolio documentation includes portfolio value, available balance, unrealized P&L, performance charts, active positions, bought and sold amounts, remaining balances, profitability groupings, and an activity feed.

---

## 4.17 Perpetual futures
The platform should support perpetual futures through an integrated liquidity venue rather than building a derivatives protocol during the first release.

Functions should include:

- Long and short positions.
- Market and limit orders.
- Leverage selection.
- Margin mode.
- Position size.
- Entry and mark price.
- Liquidation price.
- Funding rate.
- Margin used.
- Take-profit.
- Stop-loss.
- Position reduction.
- Position closure.
- Trade history.
- Derivatives P&L.
- Deposit and withdrawal bridging where required.
Axiom’s public documentation describes perpetual trading through Hyperliquid, including up to 50× leverage, long and short positions, deposits, withdrawals, and separate perpetual-portfolio reporting.

### Project Sentinel derivatives protections

- Leverage limits based on user experience.
- Liquidation-distance warnings.
- Portfolio-wide liquidation simulations.
- Daily leverage-loss limits.
- Cooling-off periods after liquidation.
- Cross-exposure between spot and perpetual positions.
- Funding-cost projections.
- Net P&L after funding and fees.

---

## 4.18 Staking and yield
The platform should eventually support:

- Native SOL staking.
- Liquid staking.
- Integrated lending or yield venues.
- Position and reward tracking.
- Validator information.
- APY and fee disclosure.
- Withdrawal conditions.
- Smart-contract risk.
- Depeg risk.
- Counterparty and protocol risk.
- Historical yield.
- Net yield after fees.
Axiom currently documents direct validator staking and a managed liquid-staking structure with separate fee conditions.

Yield features are not required for the first trading-intelligence release.

---

## 4.19 Points, cashback, rewards, and referrals
The product can support:

- Trading points.
- Referral points.
- Fee rebates.
- Volume tiers.
- Achievement badges.
- Creator-reputation rewards.
- Risk-conscious trading rewards.
- Community contributions.
- Bug-bounty points.
- Data-labeling rewards.
Axiom publicly documents trade-based points, referral points, volume-based cashback tiers, and a multi-level referral structure.

### Project Sentinel incentive policy
Rewards must not depend solely on volume.

Users should also be rewarded for:

- Maintaining risk rules.
- Reporting malicious tokens accurately.
- Producing high-quality research.
- Creating useful public watchlists.
- Identifying related wallets.
- Trading through protected execution.
- Maintaining a responsible referral record.
- Launching tokens that meet longevity and transparency milestones.
The platform must not reward spam reporting or encourage users to make unnecessary trades.

---

# 5. Project Sentinel’s differentiated intelligence layer
This section contains the capabilities that should make the platform meaningfully superior to a standard trading terminal.

---

## 5.1 Token Discovery Intelligence

### Objective
Show users tokens that fit a defined trading intent, rather than merely showing what has the highest raw activity.

### Discovery modes

- Early but credible.
- Organic momentum.
- High-liquidity momentum.
- Recently migrated with healthy distribution.
- Verified creator.
- Low insider concentration.
- Whale accumulation.
- Smart-money confluence.
- Social growth without suspicious promotion.
- Recovering after capitulation.
- High-risk speculative.
- Established token revival.
- Improving risk profile.
- Deteriorating risk profile.
- Community-trending.
- Launchpad-native.
- External-launch opportunities.

### Every discovery result should show

- Reason it was selected.
- Opportunity status.
- Risk status.
- Organic-demand status.
- Effective ownership.
- Exitability.
- Creator reputation.
- Key supporting evidence.
- Key invalidation condition.
Example:

> **Why shown:** Independent buyers increased 142% in 15 minutes, estimated organic volume is 81%, liquidity rose without creator contribution, and no connected top-holder sales have been detected.

---

## 5.2 Effective Ownership Engine

### Objective
Estimate how many independent economic actors control the token supply.

### Required analysis

- Direct token transfers.
- Common funding sources.
- Same-source exchange withdrawals.
- Transaction timing.
- Similar transaction sizes.
- Wallet-creation timing.
- Shared fee-payer relationships.
- Shared delegates.
- Shared authorities.
- Coordinated trading.
- Repeated co-participation.
- Intermediate-wallet transfers.
- Bundle membership.
- Creator connections.
- Historical cluster behavior.
- Common off-chain identifiers where legally available.

### Required outputs

- Raw holder count.
- Estimated independent holder clusters.
- Raw top-10 ownership.
- Cluster-adjusted top-10 ownership.
- Raw creator ownership.
- Estimated creator-cluster ownership.
- Estimated insider-controlled supply.
- Confidence interval.
- Sellable insider supply.
- Locked or vested insider supply.
- Supply already sold.
- Insider cost basis.
- Insider realized profit.
- Maximum potential insider extraction at current liquidity.

### User interface
The graph must allow users to:

- Select a cluster.
- Expand associated wallets.
- See connection evidence.
- Inspect funding sources.
- View current balances.
- View transaction chronology.
- See confidence for each relationship.
- Mark a relationship as disputed.
- Submit additional evidence.

---

## 5.3 Creator History and Reputation Passport

### Objective
Remember creators across new wallets, token names, websites, and social identities.

### Creator profile

- Verified name or pseudonym.
- Privacy-preserving identity verification status.
- Wallets with confirmed association.
- Wallets with likely association.
- Number of launches.
- Number of graduated launches.
- Median token lifetime.
- Median maximum drawdown.
- Thirty-day and ninety-day survival rates.
- Holder-retention history.
- Liquidity-removal history.
- Insider-sale history.
- Treasury behavior.
- Social-account continuity.
- Deleted websites or accounts.
- Previous project names.
- Community disputes.
- Confirmed incidents.
- Unconfirmed risk signals.
- Disclosure accuracy.
- Average creator reward.
- Average holder outcome.
- Creator response to incidents.

### Reputation principles

- Separate confirmed facts from probabilistic links.
- Allow creators to dispute associations.
- Maintain an auditable change log.
- Do not publish private identity details without authorization or lawful grounds.
- Never label someone a scammer based only on model inference.
- Display confidence and supporting evidence.
- Provide an appeal and correction mechanism.

---

## 5.4 Organic-Volume and Demand Analysis

### Objective
Separate authentic market demand from potentially manipulated activity.

### Detection signals

- Repetitive trade sizes.
- Repeating timing intervals.
- Circular token and funding flows.
- Rapid alternating buys and sells.
- Self-funded counterparties.
- Cluster-internal trading.
- Volume without meaningful ownership changes.
- Abnormal volume-to-liquidity ratios.
- Large transaction count with low unique-wallet count.
- Microtransaction spam.
- Incentive or reward farming.
- Paid boosts.
- Referral-driven volume.
- Newly created social accounts.
- Coordinated social posting.
- Wallets with repeated wash-trading patterns.

### Required metrics

- Raw volume.
- Estimated organic volume.
- Organic-volume percentage.
- Raw buyers.
- Estimated independent buyers.
- Raw sellers.
- Estimated independent sellers.
- Raw transactions.
- Adjusted independent transactions.
- Raw holder growth.
- Cluster-adjusted holder growth.
- Wash-trading probability.
- Demand-source breakdown.
- Confidence level.
- Historical model accuracy for similar cases.

### Rankings
Provide separate rankings for:

- Raw trending.
- Organic trending.
- Risk-adjusted trending.
- Verified-community trending.
- Paid promotions.

---

## 5.5 Insider and Pre-Rug Alert System

### Objective
Detect dangerous preparation before major selling, liquidity withdrawal, or project abandonment.

### Events to monitor

- Creator-wallet transfers.
- Insider-wallet consolidation.
- Supply splitting.
- Transfers into fresh wallets.
- Gas funding of dormant wallets.
- Associated-token-account creation.
- Delegate approvals.
- Token unlocks.
- Vesting changes.
- Treasury movements.
- Liquidity-position transfers.
- Liquidity unlock preparation.
- Small test sells.
- Transfers to routing wallets.
- Transfers toward exchange-associated addresses.
- Coordinated sells.
- Authority changes.
- Metadata changes.
- Website or social deletion.
- Social-account compromise indicators.
- Contract upgrade preparation.
- Fee changes.
- Tax changes.
- Trading restrictions.
- Freeze activity.

### Alert structure
Every alert must contain:

- Severity.
- Time.
- Affected token.
- Actor or cluster.
- Description.
- Evidence.
- Confidence.
- Estimated supply affected.
- Estimated financial impact.
- Current exitability.
- Suggested response.
- Link to transactions.
- Whether automatic rules were triggered.

### Severity levels

- Informational.
- Watch.
- Elevated.
- High.
- Critical.

---

## 5.6 Exitability Engine

### Objective
Estimate what the user can realistically receive when selling a position.

### Calculations

- Available liquidity by venue.
- Price impact by position size.
- Expected slippage.
- Route fees.
- Priority fees.
- Platform fees.
- Token transfer fees or taxes.
- Pool concentration.
- Liquidity withdrawal risk.
- Competing sell pressure.
- Insider sell-ready supply.
- Historical liquidity volatility.
- Route failure probability.

### Required outputs

- Displayed position value.
- Estimated immediate exit value.
- Estimated protected exit value.
- Estimated exit value at different speeds.
- Price impact.
- Slippage range.
- Time-to-exit estimate.
- Maximum position sellable below selected impact.
- Liquidity confidence.
- Exitability classification.

### Classification

- Excellent.
- Good.
- Limited.
- Dangerous.
- Effectively trapped.
The classification must be accompanied by numerical evidence.

---

## 5.7 Execution Through Existing Liquidity

### Initial integrations
For the Solana-first release, the routing layer should access supported liquidity from:

- Bonding-curve launch venues.
- Raydium pools.
- Orca pools.
- Meteora pools.
- Other supported Solana liquidity sources.
- Aggregated routing providers.
- Protected transaction-delivery providers.
The system should not require tokens to launch on Project Sentinel before users can trade them.

### Execution engine requirements

- Route discovery.
- Route comparison.
- Split routing.
- Quote freshness.
- Transaction simulation.
- Dynamic priority fees.
- Protected transaction submission.
- Revert protection where available.
- Retry logic.
- Duplicate-transaction protection.
- Confirmation monitoring.
- Failed-order classification.
- Post-trade execution analysis.
- Idempotent order handling.
- Venue health monitoring.
- RPC redundancy.
- Block-engine redundancy.

### Pre-trade execution panel
Display:

- Quoted output.
- Minimum output.
- Price impact.
- Slippage setting.
- Network fee.
- Priority fee.
- Protection fee or tip.
- Platform fee.
- Token fee.
- Route.
- Quote age.
- Estimated landing probability.
- Estimated confirmation time.
- Break-even price movement.
- Exitability after purchase.

### Post-trade receipt
Display:

- Requested amount.
- Executed amount.
- Quoted price.
- Executed price.
- Effective slippage.
- Price impact.
- All fees.
- Confirmation latency.
- Route used.
- Protection used.
- Any retries.
- Savings relative to alternative routes.
- Transaction explorer link.

---

## 5.8 True Net P&L

### Objective
Show actual economic performance rather than a misleading price-based estimate.

### Costs to include

- Purchase cost.
- Sale proceeds.
- Platform fees.
- Network fees.
- Priority fees.
- Validator or block-engine tips.
- Slippage.
- Price impact.
- Token taxes.
- Failed-transaction fees.
- Bridging fees.
- Funding payments.
- Borrowing costs.
- Withdrawal costs.
- Referral rebates.
- Cashback.
- Airdrops and transfers, classified separately.

### Required views

- Gross realized P&L.
- Net realized P&L.
- Gross unrealized P&L.
- Estimated net unrealized P&L.
- Total trading expenses.
- Expenses by category.
- Break-even price.
- Return relative to SOL.
- Return relative to a stablecoin.
- Maximum drawdown.
- Profit factor.
- Risk-adjusted return.
- Daily, weekly, monthly, and all-time performance.
- Performance by strategy.
- Performance by wallet.
- Performance by token category.
- Performance by creator-risk class.
- Performance by discovery source.
Transferred tokens, creator allocations, and airdrops must not be mistakenly treated as trading profit.

---

## 5.9 Personal Risk Rules

### Objective
Allow users to establish rules before emotion and market pressure influence a trade.

### Configurable limits

- Maximum order size.
- Maximum position size.
- Maximum daily loss.
- Maximum weekly loss.
- Maximum portfolio drawdown.
- Maximum exposure to newly launched tokens.
- Maximum exposure to one creator.
- Maximum exposure to one wallet cluster.
- Maximum slippage.
- Minimum liquidity.
- Minimum organic-volume percentage.
- Maximum insider ownership.
- Maximum creator-risk level.
- Maximum bundle percentage.
- Minimum exitability.
- Maximum leverage.
- Maximum number of trades per period.
- Cooldown after consecutive losses.
- Cooldown after liquidation.
- No-trade hours.
- Profit-lock rules.
- Mandatory stop-loss rules.
- Restricted token authorities.
- Restricted launch sources.

### Enforcement modes

- Informational warning.
- Strong warning requiring acknowledgment.
- Delayed confirmation.
- Additional authentication.
- Hard block.
- Guardian approval.
- Temporary account-level circuit breaker.

### Behavioral alerts
The system should identify patterns such as:

- Rapidly shortening holding periods.
- Increasing trade size after losses.
- Repeatedly widening slippage.
- Trading after consecutive losses.
- Excessive leverage.
- Entering tokens after extreme price expansion.
- Overexposure to one creator or narrative.
- High fees relative to gross profit.
These warnings must be factual and nonjudgmental.

---

## 5.10 Explainable Token Reports
Every token should have a continuously updated report.

### Top-level five-second decision panel

- Opportunity: Strong, Mixed, or Weak.
- Risk: Low, Elevated, High, or Critical.
- Demand: Organic, Mixed, or Manipulated.
- Ownership: Distributed, Concentrated, or Clustered.
- Exitability: Good, Limited, Dangerous, or Trapped.

### Report sections

1. Executive summary.
2. Market activity.
3. Organic-demand analysis.
4. Holder and cluster analysis.
5. Creator history.
6. Insider activity.
7. Contract and authority analysis.
8. Liquidity and exitability.
9. Social authenticity.
10. Execution conditions.
11. Timeline of important changes.
12. Risk scenarios.
13. Supporting transactions.
14. Data confidence.
15. Conditions that would change the report.

### “What can hurt me?” panel
Show the three most financially relevant risks.

Example:

1. Connected wallets control an estimated 41% of sellable supply.
2. Only 37% of the last hour’s volume appears organic.
3. Liquidity can absorb only approximately $18,000 before estimated 15% price impact.

### “What changed?” timeline
Show changes since the user’s last visit:

- Risk increased.
- Organic demand improved.
- Liquidity declined.
- Creator transferred tokens.
- Insider cluster sold.
- New whale entered.
- Social account changed.
- Authority changed.
- Creator reputation changed.
- Exitability improved or deteriorated.

---

# 6. Native token launchpad
Project Sentinel should eventually permit token creation and launching, but the launchpad should be built only after the intelligence terminal has reliable data and abuse-detection capabilities.

## 6.1 Token creation
Creators should configure:

- Token name.
- Symbol.
- Description.
- Image.
- Website.
- Social links.
- Total supply.
- Decimal precision.
- Launch model.
- Initial price.
- Bonding curve.
- Migration threshold.
- Target DEX.
- Creator allocation.
- Community allocation.
- Treasury allocation.
- Liquidity allocation.
- Vesting schedule.
- Creator rewards.
- Trading fees.
- Metadata mutability.
- Token authority settings.
- Launch date.
- Geographic restrictions where required.

## 6.2 Launch models
Support:

- Standard bonding curve.
- Fixed-price fair launch.
- Batch auction.
- Liquidity bootstrapping.
- Community allowlist.
- Reputation-gated launch.
- Capped per-wallet launch.
- Capped per-cluster launch.
- Milestone-based launch.
- Transparent presale where legally supportable.

## 6.3 Fair-launch protections

- Per-wallet purchase limits.
- Per-cluster purchase limits.
- Anti-Sybil scoring.
- Transaction randomization or batching where appropriate.
- Transparent allocation.
- Bot and bundle monitoring.
- Public creator wallets.
- Public insider wallets.
- Creator vesting.
- Treasury timelocks.
- Liquidity commitments.
- Maximum creator allocation.
- Restricted authority configuration.
- Launch simulation.
- Duplicate-brand detection.
- Social ownership verification.
- Website-domain verification.
- Clear paid-promoter disclosure.
No anti-bot or fair-launch system should be marketed as perfect.

## 6.4 Creator commitment system
Creators can commit to:

- A minimum liquidity period.
- A maximum insider allocation.
- Public treasury accounting.
- Vesting.
- No undisclosed paid promotion.
- No wash trading.
- No hidden related wallets.
- Periodic project updates.
- Continued control of verified social accounts.
- Published use of treasury funds.
Violations should be recorded in the creator’s reputation profile.

## 6.5 Outcome-aligned creator rewards
Creator rewards should vest according to configurable milestones such as:

- Seven-day survival.
- Thirty-day survival.
- Ninety-day survival.
- Holder retention.
- Liquidity retention.
- Organic trading activity.
- Treasury transparency.
- Distribution quality.
- Absence of manipulation.
- Community-participation milestones.
Raw volume alone must not determine creator rewards.

## 6.6 Launch security review
Before launch, the platform should run:

- Authority analysis.
- Supply simulation.
- Allocation analysis.
- Wallet-cluster analysis.
- Liquidity simulation.
- Creator-history analysis.
- Duplicate-project detection.
- Social-account verification.
- Domain-security checks.
- Transfer and sell simulation.
- Worst-case extraction analysis.
The creator must review and approve the published disclosure report.

---

# 7. Information architecture and primary navigation

## Main navigation

1. Home.
2. Discover.
3. Pulse.
4. Launches.
5. Trade.
6. Watchlists.
7. Wallet Tracker.
8. Social Monitor.
9. Portfolio.
10. Perpetuals.
11. Yield.
12. Alerts.
13. Reports.
14. Launch Token.
15. Creator Dashboard.
16. Settings.

## Home dashboard
The home dashboard should contain:

- Portfolio summary.
- Risk exposure.
- Active alerts.
- Watchlist changes.
- Tracked-wallet activity.
- Open positions.
- Open orders.
- New credible launches.
- Organic trending.
- Creator-risk changes.
- Daily net P&L.
- Daily fee total.
- Personal-risk-rule status.

## Token page layout

### Header

- Token name and symbol.
- Mint address.
- Verification state.
- Price.
- Market capitalization.
- Liquidity.
- Age.
- Favorite control.
- Share control.
- Trade controls.

### Decision strip

- Opportunity.
- Risk.
- Demand.
- Ownership.
- Exitability.

### Main workspace

- Chart.
- Trade ticket.
- Recent trades.
- User position.
- Open orders.
- Timeline annotations.

### Analysis tabs

- Overview.
- Market.
- Holders.
- Clusters.
- Creator.
- Insiders.
- Liquidity.
- Social.
- Contract.
- Traders.
- Reports.
- Timeline.

---

# 8. Key user journeys

## 8.1 Discover and purchase a token

1. User opens Organic Trending.
2. User filters by token age, liquidity, creator history, and insider concentration.
3. Platform displays qualified candidates.
4. User opens a token.
5. Decision strip summarizes opportunity, risk, demand, ownership, and exitability.
6. User expands supporting evidence.
7. User selects a purchase size.
8. Exitability Engine estimates the value of an immediate resale.
9. Personal Risk Engine checks the trade.
10. Execution Engine compares routes.
11. User confirms.
12. Transaction is submitted.
13. User receives an execution receipt.
14. Position and risk monitoring begin automatically.

## 8.2 Respond to an insider alert

1. Insider wallet receives gas.
2. Insider moves supply to sell-ready accounts.
3. Risk model generates an elevated or critical alert.
4. User receives web, mobile, Telegram, Discord, email, or webhook notification.
5. Token report explains the evidence.
6. Exitability Engine recalculates expected proceeds.
7. User sells manually or a previously configured risk-event order executes.
8. Alert outcome is recorded for model-performance analysis.

## 8.3 Launch a token

1. Creator starts launch wizard.
2. Creator enters project and allocation information.
3. Creator verifies socials and optionally verifies identity.
4. Platform analyzes creator and connected wallets.
5. Creator selects launch model.
6. Creator sets vesting, treasury, and liquidity commitments.
7. Platform simulates launch conditions.
8. Public disclosure report is generated.
9. Creator resolves critical issues.
10. Launch is scheduled.
11. Traders receive transparent pre-launch information.
12. Token launches.
13. Creator rewards vest only as specified milestones are achieved.

## 8.4 Configure personal protection

1. User completes a risk questionnaire.
2. Platform proposes default limits.
3. User configures maximum position size, daily loss, insider concentration, slippage, and minimum liquidity.
4. User selects enforcement modes.
5. Rules apply across all supported wallets.
6. Dashboard shows remaining daily risk budget.
7. Attempts to violate rules trigger the selected response.

---

# 9. Functional system modules

## 9.1 Identity and access service
Responsibilities:

- Authentication.
- Passkeys.
- OAuth.
- Session management.
- Device management.
- Step-up authentication.
- Role-based access.
- Organization accounts.
- API keys.
- Security logs.

## 9.2 Wallet service
Responsibilities:

- Embedded wallet provisioning.
- External wallet connections.
- Transaction signing.
- Session keys.
- Watch-only wallets.
- Wallet labels.
- Balance retrieval.
- Token accounts.
- Address book.
- Withdrawal controls.

## 9.3 Blockchain ingestion service
Responsibilities:

- Solana RPC ingestion.
- WebSocket subscriptions.
- Block and slot processing.
- Transaction decoding.
- Token-account changes.
- DEX-event decoding.
- Launchpad-event decoding.
- Program authority tracking.
- Historical backfills.
- Reorganization or skipped-slot handling.
- Data-quality checks.

## 9.4 Market data service
Responsibilities:

- Token prices.
- Pool reserves.
- Candles.
- Volume.
- Market capitalization.
- Liquidity.
- Pair metadata.
- Quote generation.
- DEX routing data.
- Bonding-curve status.

## 9.5 Entity graph service
Responsibilities:

- Wallet nodes.
- Creator nodes.
- Token nodes.
- Pool nodes.
- Social-account nodes.
- Domain nodes.
- Funding relationships.
- Ownership relationships.
- Behavioral relationships.
- Confidence scoring.
- Historical graph snapshots.

## 9.6 Risk engine
Responsibilities:

- Rule-based detection.
- Statistical models.
- Graph-based models.
- Contract-risk analysis.
- Creator-risk analysis.
- Ownership analysis.
- Insider alerts.
- Manipulation analysis.
- Risk-version management.
- Explanations.
- Model-performance tracking.

## 9.7 Organic-demand engine
Responsibilities:

- Wash-trading detection.
- Independent-actor estimation.
- Volume adjustment.
- Buyer-quality analysis.
- Social-demand analysis.
- Organic rankings.
- Confidence intervals.

## 9.8 Execution service
Responsibilities:

- Quotes.
- Routing.
- Transaction construction.
- Simulation.
- Fee optimization.
- Protected delivery.
- Confirmation.
- Retry policy.
- Order status.
- Execution receipts.
- Post-trade analysis.

## 9.9 Order-management system
Responsibilities:

- Market orders.
- Limit orders.
- Stops.
- Take-profits.
- Trailing stops.
- Migration orders.
- Risk-event orders.
- Order expiry.
- Partial fills.
- Cancellation.
- Idempotency.
- Audit logs.

## 9.10 Portfolio and accounting service
Responsibilities:

- Cost basis.
- Position calculations.
- Realized and unrealized P&L.
- Fee attribution.
- Transfer classification.
- Wallet aggregation.
- Performance statistics.
- Tax-compatible exports.
- Historical snapshots.

## 9.11 Alert service
Responsibilities:

- Real-time event processing.
- Alert deduplication.
- Severity calculation.
- Delivery preferences.
- Web and mobile notifications.
- Email.
- Telegram.
- Discord.
- Webhooks.
- Delivery history.
- Escalation rules.

## 9.12 Launchpad service
Responsibilities:

- Token configuration.
- Token deployment.
- Launch model.
- Bonding curve.
- Allocations.
- Vesting.
- Treasury.
- Migration.
- Creator rewards.
- Disclosure reports.
- Launch monitoring.
- Abuse prevention.

---

# 10. Core data entities
The minimum data model should include:

- User.
- UserDevice.
- AuthenticationSession.
- Wallet.
- WalletCluster.
- WalletRelationship.
- CreatorProfile.
- CreatorCommitment.
- Token.
- TokenAuthority.
- TokenLaunch.
- TokenAllocation.
- VestingSchedule.
- Pool.
- LiquidityPosition.
- MarketPair.
- Trade.
- Transaction.
- Order.
- Quote.
- ExecutionReceipt.
- Position.
- PortfolioSnapshot.
- FeeRecord.
- HolderSnapshot.
- OwnershipClusterSnapshot.
- RiskFinding.
- RiskReport.
- RiskModelVersion.
- Alert.
- Watchlist.
- SocialAccount.
- SocialEvent.
- PromotionDisclosure.
- ReputationEvent.
- Dispute.
- EvidenceItem.
- LaunchMilestone.
- CreatorReward.
Every risk finding should retain:

- Finding type.
- Entity affected.
- Severity.
- Confidence.
- Evidence.
- Model or rule version.
- First observed time.
- Last observed time.
- Resolution state.
- User-visible explanation.

---

# 11. Suggested technical architecture

## Frontend

- React or Next.js.
- TypeScript.
- Real-time WebSocket updates.
- Server-side rendering for public token pages where useful.
- Virtualized high-volume tables.
- Component-based design system.
- Responsive desktop and mobile web.
- Native mobile application after the web product stabilizes.

## Backend
A modular service architecture is preferable, but the first release should avoid unnecessary microservice complexity.

Suggested initial services:

- API gateway.
- Authentication service.
- Wallet service.
- Solana ingestion workers.
- Market data service.
- Risk and entity-graph service.
- Execution service.
- Order-management service.
- Portfolio service.
- Alert service.
- Launchpad service.

## Data infrastructure

- PostgreSQL for transactional application data.
- Time-series database for candles and market metrics.
- Graph database or graph-capable data layer for entity relationships.
- Redis for caching, rate limits, queues, and real-time state.
- Object storage for historical exports and model artifacts.
- Event stream such as Kafka or an equivalent managed service.
- Data warehouse for analytics and model training.

## Blockchain infrastructure

- Multiple Solana RPC providers.
- Dedicated or high-performance nodes for critical functions.
- WebSocket redundancy.
- Historical indexer.
- DEX and launchpad program decoders.
- Protected transaction pathways.
- Block-engine integrations where appropriate.
- Continuous provider health scoring.

## Observability

- Structured logs.
- Distributed tracing.
- Metrics.
- Order-latency dashboards.
- RPC health.
- Quote health.
- Model-drift monitoring.
- Alert-delivery monitoring.
- Incident management.
- Security-event monitoring.

---

# 12. Security requirements
The platform will handle high-value and time-sensitive activity. Security cannot be deferred.

## Required controls

- Independent smart-contract audits.
- Wallet and key-management review.
- Hardware security modules or secure enclave technology where applicable.
- Encryption in transit and at rest.
- Strict separation of production and development systems.
- Least-privilege service access.
- Signed deployment artifacts.
- Dependency scanning.
- Secret scanning.
- Penetration testing.
- Bug bounty.
- Rate limiting.
- DDoS protection.
- Withdrawal anomaly detection.
- Device and session monitoring.
- Step-up authentication.
- Phishing-resistant authentication.
- Transaction simulation.
- Address-poisoning warnings.
- Malicious-domain detection.
- Immutable security audit logs.
- Incident-response plans.
- Disaster recovery.
- Backup verification.

## Transaction safety
Before a user signs, the interface should clearly state:

- Asset being spent.
- Asset being received.
- Maximum amount spent.
- Minimum amount received.
- Program being called.
- Token authority risks.
- Delegations or approvals being granted.
- Whether the transaction creates continuing permissions.

---

# 13. Compliance and governance requirements
Legal review is required before launch in every supported jurisdiction.

The development team should plan for:

- Terms of service.
- Privacy policy.
- Risk disclosures.
- Restricted jurisdictions.
- Sanctions screening where legally required.
- Market-manipulation policies.
- Creator disclosures.
- Promotion disclosures.
- Referral disclosures.
- Data retention.
- User-data deletion.
- Law-enforcement request handling.
- Consumer-protection requirements.
- Derivatives-access restrictions.
- Fiat-provider requirements.
- Tax-reporting compatibility.
The interface must not state that:

- Any token is guaranteed safe.
- Any trade is guaranteed profitable.
- MEV protection is perfect.
- A risk model proves criminal intent.
- Creator verification guarantees good behavior.
- Locked liquidity eliminates all rug risk.

---

# 14. Nonfunctional requirements

## Performance
Initial targets:

- Market-data screen update: under 500 milliseconds under normal conditions.
- Critical wallet-event ingestion: under two seconds where infrastructure permits.
- Quote response: under 500 milliseconds.
- Risk-report initial load: under two seconds when cached.
- Order submission after signature: under 250 milliseconds to the selected delivery path.
- Platform availability target: 99.9% for initial production.
- No loss of accepted order state during service restarts.

## Scalability
The system should support:

- Millions of token and wallet entities.
- Thousands of market events per second.
- Large watchlists.
- Real-time wallet tracking.
- Historical graph analysis.
- Burst traffic during major launches.

## Reliability

- Idempotent order submission.
- Duplicate-order detection.
- Provider failover.
- Quote-expiry enforcement.
- Accurate status after partial infrastructure failures.
- Recovery from missed blockchain events.
- Reconciliation against on-chain truth.

## Accessibility

- Keyboard navigation.
- Screen-reader labels.
- High-contrast mode.
- Color-independent risk indicators.
- Adjustable density.
- Reduced-motion mode.
- Clear typography.
- Mobile responsiveness.

---

# 15. Recommended delivery roadmap

## Phase 0: Foundations and validation
Build:

- Product design system.
- Solana indexer.
- Token and pool data model.
- Wallet and account model.
- Basic graph infrastructure.
- Security architecture.
- User research program.
- Historical risk dataset.
- Model-evaluation framework.
Do not begin with the native launchpad.

---

## Phase 1: Intelligence terminal
This is the recommended first public product.

### Include

- Authentication.
- Embedded and connected wallets.
- Token search.
- New-pair feed.
- New-launch feed.
- Trending.
- Watchlists.
- TradingView-style chart.
- Token market page.
- Effective Ownership beta.
- Creator History beta.
- Organic Volume beta.
- Insider alerts.
- Exitability estimates.
- Explainable token reports.
- Wallet tracking.
- Basic portfolio.
- True net P&L.
- Personal risk rules.
- Market buy and sell through existing liquidity.
- Pre-trade simulation.
- Post-trade execution receipts.

### Exclude initially

- Native token deployment.
- Perpetuals.
- Yield.
- Complex copy trading.
- Multi-chain support.
- Social feed.
- Public creator rewards.

---

## Phase 2: Professional execution
Add:

- Limit orders.
- Stop-loss.
- Take-profit.
- Trailing stops.
- Risk-event orders.
- Migration buys and sells.
- Dynamic fee recommendations.
- Protected execution.
- Split routing.
- Hotkeys.
- Multi-wallet management.
- Advanced portfolio analytics.
- Mobile alerts.
- Telegram, Discord, and webhook alerts.

---

## Phase 3: Social and strategy intelligence
Add:

- Social monitor.
- Social-authenticity analysis.
- Trader Scan.
- Wallet leaderboards.
- Copyability Score.
- Simulated follower returns.
- Strategy tracking.
- Shared watchlists.
- Community research.
- Dispute and correction workflows.

---

## Phase 4: Integrity Launchpad
Add:

- Token creation.
- Launch models.
- Creator verification.
- Creator commitments.
- Allocation controls.
- Vesting.
- Treasury timelocks.
- Anti-bundle monitoring.
- Cluster-aware launch limits.
- Public disclosure reports.
- Milestone-based creator rewards.
- Automated migration.
- Creator dashboard.

---

## Phase 5: Perpetuals, yield, and multi-chain expansion
Add:

- Integrated perpetual futures.
- Leverage-risk controls.
- Native and liquid staking.
- Yield integrations.
- Additional supported chains.
- Cross-chain portfolio.
- Cross-chain creator and wallet reputation.

---

## Phase 6: Market-integrity infrastructure
Expose commercial APIs for:

- Token risk.
- Effective ownership.
- Creator reputation.
- Wallet clusters.
- Organic volume.
- Insider alerts.
- Exitability.
- Execution quality.
- Launch compliance.
- Social authenticity.
This phase allows wallets, DEX interfaces, institutions, and other launchpads to use Project Sentinel’s intelligence.

---

# 16. Minimum viable product acceptance criteria
The MVP should not be considered ready until users can:

1. Create or connect a wallet securely.
2. Search for any indexed Solana token.
3. Discover new and trending tokens.
4. Open a complete token page.
5. View charts and recent transactions.
6. See raw and cluster-adjusted ownership.
7. View creator-history evidence where available.
8. Compare raw and estimated organic volume.
9. Receive insider and liquidity alerts.
10. Estimate the proceeds of selling a position.
11. Simulate a purchase before signing.
12. Buy and sell through existing liquidity.
13. Receive a detailed execution receipt.
14. View net P&L after all known costs.
15. Set and enforce personal risk limits.
16. Inspect the evidence behind every major risk warning.
17. Add tokens and wallets to watchlists.
18. Export transaction and performance history.
19. Dispute or report inaccurate risk information.
20. Understand that every intelligence output has a confidence level.

---

# 17. Product success metrics

## Primary north-star metric
**Risk-adjusted user wealth retained or created through the platform.**

## Supporting metrics

- Monthly active funded traders.
- Thirty-day and ninety-day trader retention.
- Net profitable-user percentage.
- Median user P&L after fees.
- Median loss avoided after critical alerts.
- Percentage of dangerous events detected before the largest decline.
- Median warning lead time.
- Risk-model precision.
- Risk-model recall.
- False-positive rate.
- Creator-cluster linking accuracy.
- Organic-volume estimation accuracy.
- Median execution improvement.
- Failed-transaction rate.
- Quote-to-execution difference.
- Personal-rule adherence.
- Support-ticket resolution.
- Security incidents.
- Thirty-day and ninety-day survival of native launches.
- Holder retention of native launches.
- Liquidity retention of native launches.
- Percentage of native launches with disclosed insider wallets.
- Creator repeat-quality rate.
Trading volume should remain a business metric, but it must not be the sole product-success metric.

---

# 18. Business model
Recommended revenue sources:

- Transparent execution fee.
- Professional analytics subscription.
- Advanced alert subscription.
- API access.
- Institutional intelligence plans.
- Creator launch fees.
- Milestone-based creator fees.
- Premium automation.
- White-label market-integrity infrastructure.
- Clearly labelled sponsorships.
- Optional revenue share from measurable execution savings.
Avoid:

- Hidden spreads.
- Undisclosed payment for rankings.
- Safety ratings influenced by payment.
- Incentives based exclusively on trading frequency.
- Creator rewards based exclusively on volume.
- Referral structures that encourage reckless trading.
- Selling access to user order flow without clear disclosure and legal review.

---

# 19. Critical product risks

## Risk-model errors
Incorrectly linking wallets or creators can damage users and project teams.

Mitigation:

- Confidence scores.
- Evidence.
- Appeals.
- Human review for severe labels.
- Model versioning.
- Conservative language.
- Correction history.

## Excessive interface complexity
Combining a launchpad, scanner, DEX terminal, portfolio, social monitor, and risk platform can overwhelm users.

Mitigation:

- Beginner and professional modes.
- Progressive disclosure.
- Custom layouts.
- Clear decision strip.
- Saved workspaces.
- Context-sensitive explanations.

## Latency
Extensive analysis can slow trading decisions.

Mitigation:

- Precomputed graph features.
- Streaming updates.
- Cached reports.
- Separate fast-path execution from analytical processing.
- Show data freshness.

## False confidence
Users may treat intelligence outputs as guarantees.

Mitigation:

- Confidence ranges.
- Explicit uncertainty.
- Supporting evidence.
- Historical model performance.
- No absolute “safe token” labels.

## Adversarial adaptation
Manipulators will modify behavior to evade detection.

Mitigation:

- Multiple independent signals.
- Continuous model updates.
- Red-team testing.
- Historical backtesting.
- Adversarial simulations.
- Community reporting.
- Cross-token actor memory.

---

# 20. Final product definition
Project Sentinel is not merely a token launcher, charting site, or swap interface.

It is:

> **A Solana-first launch, discovery, analysis, execution, and portfolio platform that uses behavioral intelligence and entity relationships to help traders understand effective ownership, authenticate demand, evaluate creators, detect insider preparation, measure realistic exit value, improve execution, and enforce personal risk policies.**
The product should include the core functionality traders expect from platforms such as Axiom:

- Fast token discovery.
- Pulse-style launch monitoring.
- New pairs and trending feeds.
- Market charts.
- Market and limit orders.
- One-click trading.
- Hotkeys.
- Migration orders.
- Wallet tracking.
- Multi-wallet support.
- Social monitoring.
- Trader-level analysis.
- Bundle detection.
- Spot portfolios.
- Perpetuals.
- Staking and yield.
- Points, rebates, and referrals.
However, its competitive advantage will come from the systems competitors cannot reproduce by merely copying the interface:

- Effective Ownership Graph.
- Creator Reputation Passport.
- Organic Demand Engine.
- Pre-Rug Intelligence.
- Insider Preparation Alerts.
- Exitability Engine.
- Execution Quality Engine.
- True Net P&L.
- Personal Risk Firewall.
- Explainable Token Reports.
- Cluster-aware fair launches.
- Outcome-aligned creator economics.
- A continuously improving market-integrity data network.
The recommended first product is the **Solana Intelligence Terminal**, followed by professional execution and only then the native launchpad.
This phase allows wallets, DEX interfaces, institutions, and other launchpads to use Project Sentinel’s intelligence.

---

# 16. Minimum viable product acceptance criteria
The MVP should not be considered ready until users can:

1. Create or connect a wallet securely.
2. Search for any indexed Solana token.
3. Discover new and trending tokens.
4. Open a complete token page.
5. View charts and recent transactions.
6. See raw and cluster-adjusted ownership.
7. View creator-history evidence where available.
8. Compare raw and estimated organic volume.
9. Receive insider and liquidity alerts.
10. Estimate the proceeds of selling a position.
11. Simulate a purchase before signing.
12. Buy and sell through existing liquidity.
13. Receive a detailed execution receipt.
14. View net P&L after all known costs.
15. Set and enforce personal risk limits.
16. Inspect the evidence behind every major risk warning.
17. Add tokens and wallets to watchlists.
18. Export transaction and performance history.
19. Dispute or report inaccurate risk information.
20. Understand that every intelligence output has a confidence level.

---

# 17. Product success metrics

## Primary north-star metric
**Risk-adjusted user wealth retained or created through the platform.**

## Supporting metrics

- Monthly active funded traders.
- Thirty-day and ninety-day trader retention.
- Net profitable-user percentage.
- Median user P&L after fees.
- Median loss avoided after critical alerts.
- Percentage of dangerous events detected before the largest decline.
- Median warning lead time.
- Risk-model precision.
- Risk-model recall.
- False-positive rate.
- Creator-cluster linking accuracy.
- Organic-volume estimation accuracy.
- Median execution improvement.
- Failed-transaction rate.
- Quote-to-execution difference.
- Personal-rule adherence.
- Support-ticket resolution.
- Security incidents.
- Thirty-day and ninety-day survival of native launches.
- Holder retention of native launches.
- Liquidity retention of native launches.
- Percentage of native launches with disclosed insider wallets.
- Creator repeat-quality rate.
Trading volume should remain a business metric, but it must not be the sole product-success metric.

---

# 18. Business model
Recommended revenue sources:

- Transparent execution fee.
- Professional analytics subscription.
- Advanced alert subscription.
- API access.
- Institutional intelligence plans.
- Creator launch fees.
- Milestone-based creator fees.
- Premium automation.
- White-label market-integrity infrastructure.
- Clearly labelled sponsorships.
- Optional revenue share from measurable execution savings.
Avoid:

- Hidden spreads.
- Undisclosed payment for rankings.
- Safety ratings influenced by payment.
- Incentives based exclusively on trading frequency.
- Creator rewards based exclusively on volume.
- Referral structures that encourage reckless trading.
- Selling access to user order flow without clear disclosure and legal review.

---

# 19. Critical product risks

## Risk-model errors
Incorrectly linking wallets or creators can damage users and project teams.

Mitigation:

- Confidence scores.
- Evidence.
- Appeals.
- Human review for severe labels.
- Model versioning.
- Conservative language.
- Correction history.

## Excessive interface complexity
Combining a launchpad, scanner, DEX terminal, portfolio, social monitor, and risk platform can overwhelm users.

Mitigation:

- Beginner and professional modes.
- Progressive disclosure.
- Custom layouts.
- Clear decision strip.
- Saved workspaces.
- Context-sensitive explanations.

## Latency
Extensive analysis can slow trading decisions.

Mitigation:

- Precomputed graph features.
- Streaming updates.
- Cached reports.
- Separate fast-path execution from analytical processing.
- Show data freshness.

## False confidence
Users may treat intelligence outputs as guarantees.

Mitigation:

- Confidence ranges.
- Explicit uncertainty.
- Supporting evidence.
- Historical model performance.
- No absolute “safe token” labels.

## Adversarial adaptation
Manipulators will modify behavior to evade detection.

Mitigation:

- Multiple independent signals.
- Continuous model updates.
- Red-team testing.
- Historical backtesting.
- Adversarial simulations.
- Community reporting.
- Cross-token actor memory.

---

# 20. Final product definition
Project Sentinel is not merely a token launcher, charting site, or swap interface.

It is:

> **A Solana-first launch, discovery, analysis, execution, and portfolio platform that uses behavioral intelligence and entity relationships to help traders understand effective ownership, authenticate demand, evaluate creators, detect insider preparation, measure realistic exit value, improve execution, and enforce personal risk policies.**
The product should include the core functionality traders expect from platforms such as Axiom:

- Fast token discovery.
- Pulse-style launch monitoring.
- New pairs and trending feeds.
- Market charts.
- Market and limit orders.
- One-click trading.
- Hotkeys.
- Migration orders.
- Wallet tracking.
- Multi-wallet support.
- Social monitoring.
- Trader-level analysis.
- Bundle detection.
- Spot portfolios.
- Perpetuals.
- Staking and yield.
- Points, rebates, and referrals.
However, its competitive advantage will come from the systems competitors cannot reproduce by merely copying the interface:

- Effective Ownership Graph.
- Creator Reputation Passport.
- Organic Demand Engine.
- Pre-Rug Intelligence.
- Insider Preparation Alerts.
- Exitability Engine.
- Execution Quality Engine.
- True Net P&L.
- Personal Risk Firewall.
- Explainable Token Reports.
- Cluster-aware fair launches.
- Outcome-aligned creator economics.
- A continuously improving market-integrity data network.
The recommended first product is the **Solana Intelligence Terminal**, followed by professional execution and only then the native launchpad.

That order matters.

The intelligence terminal can serve every Solana token immediately, including tokens launched elsewhere. It produces the wallet, creator, liquidity, behavioral, and execution data required to make the future launchpad safer and more credible. Starting with the launchpad would create token supply before Project Sentinel had developed the intelligence necessary to distinguish quality launches from manipulation.

The platform should ultimately win not because it creates the most trades or launches the most tokens, but because traders believe:

> **Project Sentinel shows me what other terminals miss, explains why it matters, helps me execute better, and gives me a realistic chance to protect my capital.**

---

# Sprint 33 — Final Non-Functional Requirements & Production Quality Matrix

Sprint 33 closes and consolidates the NFR section of the PRD.

This is the **engineering quality gate** for the entire platform. Every feature built in previous and future sprints must comply with these requirements before it can be considered production-ready.

---

# 1. Purpose

The platform is not just a trading application.

It is simultaneously:

* A real-time market-data platform
* A token discovery engine
* A token intelligence system
* A trading terminal
* A wallet application
* A portfolio system
* A launchpad
* An alerting platform
* An analytics platform
* An API platform
* An AI-powered risk-analysis system

Therefore, the quality requirements must apply across **every subsystem**.

---

# 2. Quality Pillars

Every production feature must satisfy:

```text
SECURITY
   +
CORRECTNESS
   +
PERFORMANCE
   +
RELIABILITY
   +
OBSERVABILITY
   +
SCALABILITY
   +
MAINTAINABILITY
   +
ACCESSIBILITY
   +
RECOVERABILITY
   +
USER EXPERIENCE
```

---

# 3. Criticality Classification

Every service must be assigned a criticality level.

### P0 — Financially Critical

```text
Trading
Order Management
Wallet
Balances
Transaction Signing
Transaction State
```

Failure can directly affect user funds.

---

### P1 — Trading Critical

```text
Market Data
Quotes
Liquidity
Position Data
Portfolio
Risk Checks
```

Failure significantly impacts trading decisions.

---

### P2 — Intelligence Critical

```text
Token Intelligence
Ownership Analysis
Creator Reputation
Insider Detection
Organic Volume
Exitability
```

Failure reduces product intelligence but should not necessarily stop trading.

---

### P3 — Product

```text
Discovery
Search
Alerts
Analytics
Social features
```

---

### P4 — Non-Critical

```text
Advanced analytics
Historical reports
Admin analytics
Experimental AI features
```

---

# 4. Availability Matrix

| System             | Target |
| ------------------ | -----: |
| Trading            | 99.99% |
| Wallet             | 99.99% |
| Authentication     | 99.99% |
| Order Management   | 99.99% |
| Market Data        | 99.99% |
| Portfolio          | 99.95% |
| Risk Engine        | 99.95% |
| Token Intelligence |  99.9% |
| Discovery          |  99.9% |
| Alerts             |  99.9% |
| Analytics          |  99.5% |
| Admin              |  99.5% |

External blockchain outages are tracked separately from platform availability.

---

# 5. Latency Classes

### L0 — Ultra-Critical

```text
Trade submission
Risk validation
Transaction preparation
```

Target:

```text
<500ms platform-side
```

excluding blockchain confirmation.

---

### L1 — Real-Time

```text
Price
Liquidity
Trades
Order status
Wallet activity
```

Target:

```text
<250ms event propagation
```

under normal conditions.

---

### L2 — Interactive

```text
Search
Token page
Portfolio
Discovery
```

Target:

```text
<500ms
```

for normal API requests.

---

### L3 — Background

```text
Deep intelligence
Historical analytics
AI reports
Backfills
```

Latency may be seconds/minutes depending on computation.

---

# 6. Consistency Matrix

Not everything requires the same consistency model.

### Strong Consistency

Required for:

```text
Balances
Orders
Trade state
Wallet permissions
Transaction state
User account state
```

---

### Eventual Consistency

Acceptable for:

```text
Trending rankings
Analytics
Historical intelligence
Social statistics
Some discovery metrics
```

---

# 7. Data Freshness Classes

### Real-Time

```text
Price
Liquidity
Trades
Open orders
Transaction status
```

---

### Near Real-Time

```text
Portfolio
Risk score
Ownership score
Insider detection
Volume analysis
```

---

### Periodic

```text
Creator reputation
Historical analytics
Long-term wallet statistics
```

---

# 8. Freshness Visibility

The UI must never imply that stale data is live.

Example:

```text
● Live
Updated 0.7s ago
```

or:

```text
⚠ Data delayed
Updated 38s ago
```

---

# 9. Security Classes

Every endpoint and service should be classified.

### Public

```text
Token discovery
Public market data
Public token metadata
```

### Authenticated

```text
Portfolio
Alerts
Personal settings
```

### Financial

```text
Orders
Trading
Wallet operations
```

### Administrative

```text
User management
System configuration
Risk controls
```

Each class receives appropriate authentication, authorization, logging, and rate limits.

---

# 10. Authentication Requirements

Authentication must support:

```text
Secure sessions
Session expiration
Session revocation
Device/session management
Multi-factor authentication where appropriate
```

---

# 11. Authorization

Use least privilege.

A user should only access:

```text
their own account
their own portfolio
their own orders
their own settings
```

unless explicitly authorized.

---

# 12. Admin Authorization

Administrative actions require stronger controls.

Examples:

```text
User suspension
Risk configuration
Contract configuration
Fee configuration
System controls
```

must be permission-controlled and audited.

---

# 13. Audit Requirements

Audit logs must exist for:

```text
Authentication
Security changes
Trading operations
Admin operations
Permission changes
Configuration changes
Critical system events
```

---

# 14. Audit Log Integrity

Audit logs must be:

```text
Append-oriented
Tamper-resistant
Timestamped
Traceable
```

---

# 15. Disaster Recovery Classes

### Tier A — Critical Financial Data

```text
Wallet state
Orders
Transactions
Balances
```

Very aggressive recovery requirements.

---

### Tier B

```text
Portfolio
Market data
Risk state
```

---

### Tier C

```text
Analytics
Historical intelligence
```

Can tolerate longer recovery windows.

---

# 16. Recovery Point Objective

Define maximum acceptable data loss per system.

For critical financial state:

```text
RPO → as close to zero as technically achievable
```

---

# 17. Recovery Time Objective

Critical trading services should have:

```text
RTO → minutes, not hours
```

The exact target should be validated through disaster-recovery testing.

---

# 18. Backup Requirements

Backups must be:

```text
Encrypted
Automated
Versioned
Monitored
Tested
```

---

# 19. Backup Testing

A backup is not considered valid until restoration has been successfully tested.

---

# 20. Dependency Matrix

Every service must document:

```text
Service
↓
Dependencies
↓
Failure impact
↓
Fallback
↓
Recovery procedure
```

---

# 21. Dependency Example

```text
Trading API
 ├── Database
 ├── Risk Engine
 ├── Quote Engine
 ├── RPC
 └── Transaction Service
```

If the AI intelligence service fails:

```text
Trading should continue
```

if AI is not required for the deterministic safety checks.

---

# 22. External Provider Independence

Avoid architectural dependence on a single:

```text
RPC provider
Data provider
Cloud service
AI provider
Notification provider
```

where practical.

---

# 23. RPC Failover

Blockchain infrastructure should support multiple RPC endpoints/providers where feasible.

```text
RPC A
 ↓ failure
RPC B
 ↓ failure
RPC C
```

---

# 24. Provider Health Scoring

Providers should be evaluated based on:

```text
Latency
Error rate
Availability
Block freshness
Response quality
```

---

# 25. Data Quality Requirements

Every important data source should have quality checks.

Detect:

```text
Missing data
Duplicate events
Out-of-order events
Impossible values
Stale values
Conflicting values
```

---

# 26. Blockchain Data Validation

Indexer pipelines should validate:

```text
Block continuity
Transaction relationships
Token decimals
Transfer amounts
Event ordering
```

---

# 27. Duplicate Event Protection

Blockchain events must be deduplicated using appropriate canonical identifiers.

---

# 28. Reorg Handling

Where the supported chain can reorganize state, the indexer must handle:

```text
Reorganization
Rollback
Event replacement
State reconciliation
```

---

# 29. Intelligence Reliability

AI-generated information must be distinguishable from deterministic blockchain facts.

For example:

```text
Verified fact:
Creator wallet sold 42% of supply.

AI interpretation:
This behavior is historically associated with elevated risk.
```

These must never be presented as equivalent.

---

# 30. Explainability

Risk scores must expose their major contributing factors.

Example:

```text
Risk Score: 82/100

Main factors:
⚠ Creator controls 31%
⚠ Liquidity concentration
⚠ Insider cluster detected
✓ Liquidity locked
✓ Contract verified
```

---

# 31. AI Failure Handling

If an AI model is unavailable:

```text
AI analysis unavailable
```

must be shown.

Never fabricate an AI result.

---

# 32. AI Confidence

Where appropriate, AI outputs should expose:

```text
Confidence
Evidence
Data freshness
Model version
```

---

# 33. Model Versioning

Every production AI decision should be traceable to:

```text
Model version
Prompt/configuration version where applicable
Input data snapshot
Timestamp
```

---

# 34. Explainability Audit Trail

For important AI risk outputs, store enough metadata to reproduce or investigate the result.

---

# 35. Accessibility Quality Gate

Before release:

* [ ] Keyboard navigation works.
* [ ] Focus states work.
* [ ] Screen-reader labels exist.
* [ ] Forms are accessible.
* [ ] Error messages are accessible.
* [ ] Motion can be reduced.
* [ ] Color is not the only signal.
* [ ] Contrast is acceptable.

---

# 36. Responsive Quality Gate

Test:

```text
Desktop
Laptop
Tablet
Mobile
```

and different viewport sizes.

---

# 37. Browser Quality Gate

Test supported versions of:

```text
Chrome
Safari
Firefox
Edge
```

---

# 38. Mobile Quality Gate

Test:

```text
Fast network
Slow network
Disconnected network
Background → foreground
Low-memory conditions
Long sessions
```

---

# 39. API Quality Gate

Every API should have:

```text
Authentication
Authorization
Validation
Rate limiting
Timeout
Error handling
Logging
Metrics
Documentation
```

---

# 40. API Error Standard

Use consistent errors.

Example:

```json
{
  "code": "INSUFFICIENT_LIQUIDITY",
  "message": "There is not enough liquidity to safely execute this trade.",
  "request_id": "req_123"
}
```

---

# 41. Event Quality Gate

Every important event requires:

```text
event_id
timestamp
source
version
payload
```

and appropriate ordering/retry semantics.

---

# 42. Database Quality Gate

Production databases must have:

```text
Indexes
Backups
Monitoring
Connection pooling
Migration strategy
Replication where necessary
Recovery plan
```

---

# 43. Migration Safety

Database migrations must be:

```text
Version controlled
Tested
Backward-compatible where required
Rollback-aware
```

---

# 44. Zero-Downtime Migration

Large production migrations should avoid blocking critical services.

---

# 45. Deployment Quality Gate

Before production:

```text
Tests pass
Security checks pass
Migration validated
Performance validated
Monitoring configured
Rollback available
```

---

# 46. Production Readiness Checklist

A feature cannot be marked:

> **READY FOR PRODUCTION**

until:

### Product

* [ ] Requirements implemented
* [ ] UX reviewed
* [ ] Edge cases handled

### Engineering

* [ ] Tests pass
* [ ] Performance acceptable
* [ ] Errors handled
* [ ] Documentation exists

### Security

* [ ] Authentication verified
* [ ] Authorization verified
* [ ] Secrets protected
* [ ] Security testing completed

### Operations

* [ ] Metrics exist
* [ ] Logs exist
* [ ] Alerts exist
* [ ] Runbook exists

### Recovery

* [ ] Failure modes tested
* [ ] Rollback tested
* [ ] Recovery path documented

---

# 47. Release Gates

Production release should pass:

```text
        CODE
          ↓
       TESTS
          ↓
      SECURITY
          ↓
    PERFORMANCE
          ↓
     STAGING
          ↓
     CANARY
          ↓
     MONITOR
          ↓
     RELEASE
```

---

# 48. Quality Score

Internally, each major subsystem can receive a readiness score:

```text
Security       20%
Reliability    20%
Performance    15%
Correctness    20%
Observability  10%
Maintainability 5%
UX              5%
Recovery        5%
```

A system below the defined release threshold should not ship.

---

# 49. Engineering Rule

The team must never use:

> "It works on my machine."

as a production-readiness criterion.

The actual standard is:

> **It works reliably under realistic production conditions.**

---

# 50. Final NFR Matrix

The completed platform must satisfy:

| Category        | Requirement                             |
| --------------- | --------------------------------------- |
| Availability    | High availability for critical services |
| Reliability     | Fault tolerance                         |
| Performance     | Defined latency budgets                 |
| Scalability     | Horizontal scaling                      |
| Consistency     | Explicit consistency model              |
| Data Quality    | Validation + reconciliation             |
| Security        | Defense in depth                        |
| Privacy         | Data minimization + protection          |
| Accessibility   | Accessible interface                    |
| Compatibility   | Modern browser/device support           |
| Observability   | Logs + metrics + traces                 |
| Recovery        | Backup + DR                             |
| Maintainability | Modular/testable code                   |
| Testability     | Automated testing                       |
| Deployment      | Safe releases + rollback                |
| AI              | Explainable + versioned                 |
| Blockchain      | Reorg + indexing resilience             |
| API             | Stable + documented                     |
| Events          | Versioned + reliable                    |
| Operations      | Runbooks + incident response            |

---

# Definition of Done

Sprint 33 is complete when the engineering team has a **single production quality standard** that applies to every feature and service.

The final rule is:

> **No feature ships because it works. It ships because it works correctly, securely, quickly, reliably, observably, and recoverably under production conditions.**

This closes the duplicate NFR sections.
