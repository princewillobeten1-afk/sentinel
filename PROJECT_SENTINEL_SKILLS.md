# Project Sentinel Skills Requirements

## Solana Launchpad, DEX Trading Terminal, Token Intelligence Platform, and Market-Integrity Network

## 1. Executive summary
Building this product requires much more than ordinary web-development ability.

The system combines:

- A high-performance trading interface.
- A decentralized exchange aggregator.
- A token launchpad.
- Solana smart contracts.
- Blockchain indexing.
- Real-time market data.
- Automated trading orders.
- Wallet infrastructure.
- Graph-based wallet analysis.
- Fraud and market-manipulation detection.
- Machine learning.
- Portfolio accounting.
- Security engineering.
- DevOps and production infrastructure.
- Financial-product design.
- Legal and compliance awareness.
A single developer may be able to build an early prototype, but one developer is unlikely to build, secure, operate, and scale the complete production platform alone.

The complete product will eventually require a multidisciplinary team.

The most critical skill groups are:

1. Product architecture.
2. Frontend engineering.
3. Backend engineering.
4. Solana blockchain engineering.
5. Smart-contract development.
6. DEX and market-microstructure knowledge.
7. Real-time data engineering.
8. Graph analytics.
9. Machine learning and fraud detection.
10. Trading and execution engineering.
11. Wallet and key-management security.
12. DevOps, infrastructure, and reliability.
13. Cybersecurity.
14. UI and UX design.
15. Quality assurance.
16. Financial accounting and portfolio analytics.
17. Compliance and legal coordination.
18. Technical documentation.
19. AI-agent orchestration and evaluation.

---

# 2. Foundational software-engineering skills
Every senior developer working on the platform should understand the following fundamentals.

## 2.1 Programming fundamentals
Required knowledge:

- Variables, functions, loops, conditions, and data structures.
- Object-oriented programming.
- Functional programming concepts.
- Modular software design.
- Error handling.
- Asynchronous programming.
- Concurrency.
- Memory management.
- Type systems.
- Generics.
- Serialization and deserialization.
- Dependency management.
- Package management.
- File and network input and output.
- Date, time, and timezone handling.
- Numerical precision.
- Secure random-number generation.
The developer must understand when ordinary floating-point numbers are unsafe for financial calculations.

Token amounts, fees, prices, and portfolio values should use:

- Integer base units.
- Fixed-point arithmetic.
- Decimal libraries.
- Explicit rounding policies.

## 2.2 Algorithms and data structures
Required topics:

- Arrays.
- Hash maps.
- Sets.
- Queues.
- Priority queues.
- Trees.
- Graphs.
- Directed and undirected graphs.
- Weighted graphs.
- Heaps.
- Bloom filters.
- Tries.
- Caches.
- Time-series structures.
- Searching.
- Sorting.
- Graph traversal.
- Shortest-path algorithms.
- Connected-component analysis.
- Union-find structures.
- Sliding-window algorithms.
- Streaming algorithms.
- Approximate counting.
- Rate-limiting algorithms.
Graph knowledge is particularly important because effective ownership, creator relationships, wallet funding, and insider detection depend on graph analysis.

## 2.3 Software-design principles
Required knowledge:

- Separation of concerns.
- Dependency inversion.
- Interface design.
- Domain-driven design.
- Event-driven architecture.
- Clean architecture.
- Idempotency.
- Immutability.
- State machines.
- Retry strategies.
- Circuit breakers.
- Backpressure.
- Eventual consistency.
- Transaction boundaries.
- Auditability.
- Versioning.
- Schema evolution.
- Feature flags.
- Graceful degradation.

---

# 3. Programming languages
The team does not need to use every language below, but it must collectively cover these capabilities.

## 3.1 TypeScript and JavaScript
TypeScript should be treated as a primary language for:

- Web frontend development.
- Node.js backend services.
- Solana client integrations.
- Wallet connections.
- API development.
- Real-time WebSocket clients.
- Shared frontend and backend types.
- Trading-interface logic.
Required TypeScript skills:

- Strict type checking.
- Advanced types.
- Interfaces.
- Generics.
- Type guards.
- Discriminated unions.
- Runtime validation.
- Asynchronous programming.
- Worker threads.
- Package publishing.
- Monorepo management.
- Testing.

## 3.2 Rust
Rust is essential for serious Solana smart-contract development.

It may also be used for:

- High-performance blockchain indexers.
- Transaction decoders.
- Risk-processing services.
- Low-latency execution services.
- Data pipelines.
- Cryptographic components.
Required Rust skills:

- Ownership and borrowing.
- Lifetimes.
- Traits.
- Enums and pattern matching.
- Error handling.
- Async Rust.
- Serialization.
- Testing.
- Unsafe-code awareness.
- Performance profiling.
- Memory safety.
- Concurrent programming.

## 3.3 Python
Python is recommended for:

- Data science.
- Fraud detection.
- Machine learning.
- Model experimentation.
- Blockchain-data analysis.
- Historical backtesting.
- Research notebooks.
- Feature generation.
- Statistical analysis.
- Internal tooling.
- Data-quality checks.
Required Python skills:

- Pandas or equivalent data tooling.
- NumPy.
- Data validation.
- Async processing.
- API development.
- Machine-learning libraries.
- Graph-analysis libraries.
- Testing.
- Packaging.
- Virtual environments.
- Performance optimization.

## 3.4 SQL
Strong SQL knowledge is mandatory.

Required topics:

- Joins.
- Aggregations.
- Window functions.
- Common table expressions.
- Recursive queries.
- Transactions.
- Locking.
- Indexes.
- Query planning.
- Partitioning.
- Materialized views.
- Time-series queries.
- Upserts.
- Data migrations.
- Data integrity.
- Database normalization.
- Denormalization.
- Performance tuning.

## 3.5 Shell scripting
The team should be comfortable with:

- Bash.
- Linux commands.
- Environment variables.
- Process management.
- Log inspection.
- Deployment scripts.
- File permissions.
- Network troubleshooting.
- Automated maintenance tasks.

---

# 4. Frontend engineering skills
The frontend is not a normal marketing website. It is a real-time financial workstation.

## 4.1 React and application architecture
Required knowledge:

- React.
- Next.js or an equivalent framework.
- Server-side rendering.
- Client-side rendering.
- Streaming.
- React state management.
- Query caching.
- Component composition.
- Custom hooks.
- Error boundaries.
- Suspense.
- Code splitting.
- Lazy loading.
- Route protection.
- Optimistic updates.
- Form management.
- Runtime data validation.

## 4.2 Real-time interface development
The developer must know how to build interfaces that update continuously without becoming unstable or slow.

Required capabilities:

- WebSockets.
- Server-sent events.
- Streaming data.
- Reconnection logic.
- Heartbeats.
- Message ordering.
- Duplicate-event handling.
- Stale-data detection.
- Throttling.
- Debouncing.
- Incremental updates.
- Efficient state normalization.
- Rendering-performance optimization.
- Background-tab behavior.
- Local caching.

## 4.3 High-performance tables
The discovery interface may display thousands of tokens and update them continuously.

Required skills:

- Table virtualization.
- Column customization.
- Sorting.
- Filtering.
- Grouping.
- Pinning.
- Keyboard control.
- Row expansion.
- Infinite scrolling.
- Server-side pagination.
- Streaming row updates.
- Memoization.
- Preventing unnecessary rerenders.

## 4.4 Financial charting
Required knowledge:

- Candlestick charts.
- OHLCV data.
- Multiple timeframes.
- Chart annotations.
- Technical indicators.
- Volume profiles.
- Price and market-cap modes.
- Order markers.
- Position markers.
- Wallet activity markers.
- Social event markers.
- Risk-event markers.
- Drawing tools.
- Chart synchronization.
- Historical data loading.
- Live-candle construction.

## 4.5 Trading-ticket development
The trading interface must handle:

- Buy and sell forms.
- Market orders.
- Limit orders.
- Stop orders.
- Slippage settings.
- Priority fees.
- Route selection.
- Quote expiry.
- Fee breakdowns.
- Token decimals.
- Balance validation.
- Maximum-order calculation.
- Signing states.
- Confirmation states.
- Failed transactions.
- Partial fills.
- Retry options.
- Risk warnings.
- Hardware-wallet delays.

## 4.6 Frontend security
Required knowledge:

- Cross-site scripting prevention.
- Cross-site request-forgery protection.
- Content Security Policy.
- Secure browser storage.
- Avoiding private-key storage in local storage.
- Safe clipboard behavior.
- Phishing protection.
- Malicious-link warnings.
- Dependency security.
- Secure wallet-provider interaction.
- Domain verification.
- Transaction-intent presentation.

## 4.7 Accessibility
Required skills:

- Keyboard navigation.
- Screen-reader compatibility.
- Semantic HTML.
- Focus management.
- High-contrast design.
- Color-independent risk communication.
- Reduced-motion support.
- Accessible charts and tables.
- Responsive text sizing.

## 4.8 Responsive design
The developer should understand:

- Desktop trading layouts.
- Tablet layouts.
- Mobile layouts.
- Collapsible panels.
- Touch targets.
- Mobile confirmation flows.
- Mobile charts.
- Bottom navigation.
- Responsive tables.
- Reduced-data mobile modes.

---

# 5. UI and UX design skills
A visually impressive interface is not enough. The product must help users make safer decisions under time pressure.

## 5.1 Trading-product UX
Required understanding:

- How traders scan markets.
- How users compare tokens.
- How urgency affects decision-making.
- How traders interpret profit and loss.
- How order confirmations should work.
- How to prevent accidental trades.
- How to display risk without creating panic.
- How to communicate uncertainty.
- How to distinguish warnings from information.
- How to design for beginners and professionals.

## 5.2 Information architecture
The designer must know how to organize:

- Discovery.
- Trading.
- Risk analysis.
- Wallet tracking.
- Social monitoring.
- Portfolio management.
- Alerts.
- Creator information.
- Launchpad functions.
- Settings.

## 5.3 Progressive disclosure
The designer must create:

- A simple five-second token summary.
- Expandable evidence.
- Advanced graph views.
- Customizable professional layouts.
- Beginner explanations.
- Tooltips.
- Contextual warnings.
- Dedicated research panels.

## 5.4 Design systems
Required capabilities:

- Component libraries.
- Typography systems.
- Spacing systems.
- Icon systems.
- Risk-state components.
- Chart themes.
- Form patterns.
- Modal and drawer patterns.
- Toast and notification systems.
- Empty states.
- Loading states.
- Error states.
- Responsive rules.
- Design tokens.

## 5.5 User research
The product team should be able to:

- Interview traders.
- Observe trading workflows.
- Conduct usability testing.
- Test prototypes.
- Analyze support complaints.
- Measure task completion.
- Identify confusing terminology.
- Test risk-warning comprehension.
- Compare beginner and professional behavior.
- Detect dark-pattern risks.

---

# 6. Backend engineering skills

## 6.1 API design
Required knowledge:

- REST.
- GraphQL where appropriate.
- WebSocket APIs.
- Streaming APIs.
- API versioning.
- Pagination.
- Filtering.
- Sorting.
- Authentication.
- Authorization.
- Rate limiting.
- Request validation.
- Error contracts.
- Idempotency keys.
- API documentation.
- Client SDK generation.

## 6.2 Service architecture
Required understanding:

- Modular monoliths.
- Microservices.
- Event-driven services.
- Message queues.
- Request-response communication.
- Publish-subscribe systems.
- Service discovery.
- Distributed tracing.
- Configuration management.
- Horizontal scaling.
- Stateful versus stateless services.
The developer should know not to create dozens of microservices before the product requires them.

## 6.3 Transactional backend development
Required capabilities:

- User accounts.
- Wallet records.
- Watchlists.
- Alerts.
- Orders.
- Portfolio snapshots.
- Fee records.
- Referral records.
- Creator profiles.
- Dispute records.
- Audit logs.
- Preferences.
- Permissions.

## 6.4 Financial correctness
The backend developer must understand:

- Fixed-point arithmetic.
- Token decimal conversions.
- Quote expiry.
- Cost basis.
- Realized P&L.
- Unrealized P&L.
- Partial sales.
- Transfers.
- Airdrops.
- Fees.
- Rebates.
- Rounding.
- Historical corrections.
- Reconciliation with blockchain state.

## 6.5 Distributed-system reliability
Required concepts:

- At-least-once delivery.
- At-most-once delivery.
- Exactly-once illusions.
- Duplicate processing.
- Idempotency.
- Ordering.
- Event replay.
- Dead-letter queues.
- Poison messages.
- Retry backoff.
- Timeout handling.
- Circuit breakers.
- Data reconciliation.
- Leader election.
- Clock drift.
- Partial failure.

---

# 7. Solana blockchain engineering skills
This is one of the most important competency groups.

## 7.1 Solana fundamentals
Required knowledge:

- Accounts.
- Programs.
- Instructions.
- Transactions.
- Signatures.
- Slots.
- Blocks.
- Recent blockhashes.
- Compute units.
- Rent.
- Program-derived addresses.
- Associated token accounts.
- Native SOL.
- Wrapped SOL.
- Token programs.
- Transaction confirmation.
- Commitment levels.
- Address lookup tables.
- Versioned transactions.

## 7.2 Solana token standards
Required knowledge:

- SPL Token.
- Token-2022.
- Mint accounts.
- Token accounts.
- Mint authority.
- Freeze authority.
- Transfer fees.
- Transfer hooks.
- Permanent delegates.
- Metadata.
- Extensions.
- Token decimals.
- Supply management.
- Authority revocation.
- Account freezing.
- Confidential or advanced extensions where relevant.
The risk engine must understand how token extensions affect transferability and trader safety.

## 7.3 Solana RPC and WebSockets
Required capabilities:

- Querying accounts.
- Querying transactions.
- Signature history.
- Program subscriptions.
- Account subscriptions.
- Log subscriptions.
- Slot subscriptions.
- Block retrieval.
- Transaction parsing.
- Rate-limit handling.
- Provider failover.
- Commitment-level selection.
- Historical backfilling.
- Detecting missing data.

## 7.4 Transaction construction
Required knowledge:

- Instruction composition.
- Compute-budget instructions.
- Priority fees.
- Address lookup tables.
- Versioned messages.
- Transaction simulation.
- Blockhash expiry.
- Durable nonces where appropriate.
- Signing.
- Multi-signature flows.
- Partial signing.
- Hardware-wallet compatibility.
- Transaction-size limits.

## 7.5 Solana program decoding
The developer must decode activity from:

- Token programs.
- DEX programs.
- Automated market makers.
- Bonding-curve launchpads.
- Liquidity programs.
- Staking programs.
- Vesting contracts.
- Metadata programs.
- Associated token accounts.
- Routing programs.

## 7.6 Solana performance
Required understanding:

- RPC latency.
- WebSocket instability.
- Slot timing.
- Transaction propagation.
- Validator prioritization.
- Fee markets.
- Compute-unit estimation.
- Block-engine delivery.
- Transaction simulation latency.
- Redundant submission.
- Confirmation monitoring.

---

# 8. Smart-contract and on-chain program skills
The native launchpad will require experienced Solana program developers.

## 8.1 Rust smart-contract development
Required skills:

- Solana program development in Rust.
- Anchor or equivalent development frameworks.
- Account validation.
- Signer validation.
- Ownership checks.
- Program-derived addresses.
- Cross-program invocations.
- Serialization.
- Account-size calculations.
- Rent handling.
- Compute optimization.
- Error codes.
- Events.
- Upgrade authority management.

## 8.2 Token launch mechanics
Required knowledge:

- Mint creation.
- Token distribution.
- Bonding curves.
- Fixed-price launches.
- Auctions.
- Liquidity bootstrapping.
- Treasury creation.
- Vesting.
- Timelocks.
- Creator rewards.
- Fee collection.
- Migration to external pools.
- Liquidity provisioning.
- Supply caps.
- Purchase limits.
- Claiming mechanisms.
- Refund handling.

## 8.3 Bonding-curve mathematics
Required abilities:

- Pricing formulas.
- Integral-based cost calculations.
- Buy and sell calculations.
- Rounding.
- Precision.
- Curve initialization.
- Reserve management.
- Migration thresholds.
- Fee extraction.
- Invariant testing.
- Economic simulation.
- Manipulation analysis.

## 8.4 On-chain security
Required knowledge:

- Missing signer checks.
- Missing ownership checks.
- Arbitrary cross-program invocation.
- Account substitution.
- Integer overflow and underflow.
- Precision loss.
- Reinitialization.
- Duplicate mutable accounts.
- Improper authority transfer.
- Unsafe upgradeability.
- Denial of service.
- Compute exhaustion.
- Oracle manipulation.
- Front-running.
- Reentrancy-like cross-program behavior.
- Flash-loan or atomic manipulation.
- Incorrect PDA seeds.
- Closing-account attacks.

## 8.5 Smart-contract testing
Required tests:

- Unit tests.
- Integration tests.
- Property-based tests.
- Fuzz tests.
- Invariant tests.
- Economic simulations.
- Adversarial tests.
- Upgrade tests.
- Migration tests.
- Failure-recovery tests.
- Mainnet-fork or realistic-environment tests where possible.

---

# 9. DEX, AMM, and liquidity knowledge

## 9.1 Automated market makers
The developer must understand:

- Constant-product pools.
- Concentrated liquidity.
- Stable-swap curves.
- Dynamic liquidity.
- Bonding curves.
- Pool reserves.
- Price impact.
- Slippage.
- Impermanent loss.
- Liquidity-provider fees.
- Pool initialization.
- Liquidity ranges.
- Tick spacing.
- Route fragmentation.

## 9.2 DEX integrations
Required capabilities:

- Pool discovery.
- Quote retrieval.
- Direct pool swaps.
- Aggregated routes.
- Split routes.
- Token-account preparation.
- Wrapped SOL handling.
- Route simulation.
- Pool-state validation.
- Token-transfer-fee handling.
- Failed-route fallback.
- Venue-health checks.

## 9.3 Liquidity analysis
Required knowledge:

- Effective liquidity.
- Depth.
- Price impact by order size.
- Concentration around current price.
- Liquidity-provider concentration.
- Locked versus unlocked liquidity.
- Liquidity ownership.
- Liquidity migration.
- Liquidity withdrawal.
- Pool imbalance.
- Exit capacity.
- Toxic order flow.

## 9.4 Market microstructure
The team should understand:

- Bid and ask concepts.
- Spread.
- Adverse selection.
- Market impact.
- Slippage.
- Order flow.
- Latency.
- Price discovery.
- Momentum.
- Mean reversion.
- Liquidity shocks.
- Volatility.
- Toxic flow.
- Arbitrage.
- Front-running.
- Sandwich attacks.
- Back-running.

---

# 10. Trading-execution engineering skills

## 10.1 Quote engine
Required abilities:

- Request quotes from multiple venues.
- Normalize quotes.
- Validate quote freshness.
- Calculate fees.
- Calculate minimum output.
- Estimate price impact.
- Estimate execution probability.
- Reject invalid routes.
- Rank routes by user preferences.
- Cache safely.
- Invalidate expired quotes.

## 10.2 Routing engine
Required knowledge:

- Single-venue routing.
- Multi-hop routing.
- Split routing.
- Route optimization.
- Fee-aware routing.
- Latency-aware routing.
- Risk-aware routing.
- Liquidity-aware routing.
- Protected-delivery compatibility.
- Fallback routing.

## 10.3 Order-management system
Required knowledge:

- Market orders.
- Limit orders.
- Stop-loss.
- Take-profit.
- Trailing stops.
- Time-based orders.
- Conditional orders.
- Risk-event orders.
- Partial fills.
- Order cancellation.
- Expiry.
- State machines.
- Idempotency.
- Recovery after restart.
- On-chain status reconciliation.

## 10.4 MEV awareness
Required understanding:

- Front-running.
- Sandwich attacks.
- Back-running.
- Arbitrage.
- Private transaction delivery.
- Bundles.
- Validator tips.
- Block-engine infrastructure.
- Transaction leakage.
- Revert protection.
- Priority auctions.
- Limits of MEV protection.

## 10.5 Execution-quality analysis
The engineer must calculate:

- Quote-to-fill difference.
- Effective slippage.
- Market impact.
- Fees.
- Confirmation latency.
- Route performance.
- Failed-transaction cost.
- Savings against alternatives.
- Execution-quality trends.
- Provider performance.

---

# 11. Blockchain indexing and data-engineering skills

## 11.1 Indexer development
Required knowledge:

- Consuming blocks and transactions.
- Decoding instructions.
- Tracking inner instructions.
- Handling versioned transactions.
- Tracking token balances.
- Detecting account creation.
- Detecting authority changes.
- Building historical state.
- Reprocessing failed events.
- Deduplicating events.
- Reconciliation.

## 11.2 Streaming data pipelines
Required skills:

- Kafka or equivalent event streams.
- Producers.
- Consumers.
- Consumer groups.
- Partitioning.
- Message keys.
- Ordering.
- Schema registries.
- Backpressure.
- Replays.
- Dead-letter queues.
- Delivery guarantees.
- Lag monitoring.

## 11.3 Time-series data
Required knowledge:

- Candlestick generation.
- OHLCV aggregation.
- Time buckets.
- Late-arriving events.
- Corrections.
- Downsampling.
- Retention.
- Compression.
- Rolling windows.
- Real-time versus historical queries.

## 11.4 Data quality
The platform must detect:

- Missing blocks.
- Missing transactions.
- Duplicate events.
- Incorrect decimals.
- Incorrect token metadata.
- Stale quotes.
- Conflicting providers.
- Outlier prices.
- Broken timestamps.
- Partial backfills.
- Incorrect wallet balances.

## 11.5 Data lineage
Every important metric should record:

- Source.
- Processing time.
- Processing version.
- Model version.
- Confidence.
- Last updated time.
- Whether it is raw, estimated, or inferred.

---

# 12. Database skills

## 12.1 PostgreSQL
Required knowledge:

- Schema design.
- Transactions.
- Indexes.
- Partitioning.
- Replication.
- Connection pooling.
- Query optimization.
- Row-level locking.
- JSON columns.
- Materialized views.
- Migrations.
- Backup and recovery.

## 12.2 Time-series databases
Required knowledge:

- High-write ingestion.
- Time partitioning.
- Retention policies.
- Continuous aggregates.
- Compression.
- Historical analytics.
- High-cardinality dimensions.

## 12.3 Graph databases
Useful for:

- Wallet relationships.
- Creator relationships.
- Funding graphs.
- Token-transfer graphs.
- Social relationships.
- Domain reuse.
- Cluster membership.
- Historical actor behavior.
Required knowledge:

- Nodes.
- Edges.
- Direction.
- Weights.
- Properties.
- Traversals.
- Connected components.
- Community detection.
- Path queries.
- Graph snapshots.
- Confidence-weighted relationships.

## 12.4 Redis and caching
Required knowledge:

- Key-value caching.
- Expiration.
- Pub-sub.
- Streams.
- Distributed locks.
- Rate limiting.
- Session storage.
- Cache invalidation.
- Hot-market caching.
- Leaderboards.

## 12.5 Data warehouses
Required for:

- Historical research.
- Product analytics.
- Fraud-model training.
- Execution analysis.
- User-outcome analysis.
- Launch quality reporting.
- Cohort analysis.

---

# 13. Graph analytics and wallet-clustering skills
This is essential for Effective Ownership.

## 13.1 Graph construction
The team must know how to construct relationships based on:

- Shared funders.
- Token transfers.
- Fee-payer relationships.
- Similar timing.
- Similar order size.
- Shared delegates.
- Shared authorities.
- Repeated co-trading.
- Bundle participation.
- Common creator associations.
- Common social or domain infrastructure.

## 13.2 Clustering methods
Required knowledge:

- Connected components.
- Community detection.
- Label propagation.
- Louvain-style clustering.
- Hierarchical clustering.
- Density-based clustering.
- Graph embeddings.
- Similarity scoring.
- Temporal graph clustering.
- Probabilistic entity resolution.

## 13.3 Cluster confidence
The system should not treat every relationship as equally certain.

The engineer must implement:

- Evidence weights.
- Positive signals.
- Negative signals.
- Confidence intervals.
- Contradictory evidence.
- Time decay.
- Relationship versioning.
- Manual-review overrides.
- Appeals and corrections.

## 13.4 Sybil detection
Required understanding:

- Wallet splitting.
- Funding funnels.
- Fresh-wallet farms.
- Exchange-withdrawal ambiguity.
- Shared gas funding.
- Sequential wallet creation.
- Coordinated transaction timing.
- False-positive risk.
- Privacy implications.

---

# 14. Data science and machine-learning skills

## 14.1 Statistical foundations
Required knowledge:

- Probability.
- Distributions.
- Hypothesis testing.
- Confidence intervals.
- Correlation versus causation.
- Sampling bias.
- Class imbalance.
- Calibration.
- Precision.
- Recall.
- F1 score.
- ROC curves.
- False-positive and false-negative costs.
- Time-series leakage.
- Concept drift.

## 14.2 Feature engineering
Required capabilities:

- Wallet behavior features.
- Token lifecycle features.
- Liquidity features.
- Holder-concentration features.
- Creator-history features.
- Trading-timing features.
- Funding-graph features.
- Social features.
- Volume-authenticity features.
- Execution features.
- Temporal windows.
- Normalization.
- Missing-data handling.

## 14.3 Fraud and anomaly detection
Required techniques:

- Rule-based detection.
- Supervised classification.
- Unsupervised anomaly detection.
- Isolation methods.
- Clustering.
- Sequence analysis.
- Change-point detection.
- Graph anomaly detection.
- Ensemble models.
- Risk scoring.
- Temporal models.

## 14.4 Model evaluation
The team must understand:

- Historical backtesting.
- Time-based train-test splits.
- Avoiding look-ahead bias.
- Ground-truth uncertainty.
- Label quality.
- Adversarial evaluation.
- Threshold selection.
- Model calibration.
- Per-token-age evaluation.
- Per-market-regime evaluation.
- Model-drift monitoring.

## 14.5 Explainable AI
Required capabilities:

- Feature attribution.
- Rule explanations.
- Confidence communication.
- Evidence links.
- Human-readable summaries.
- Counterfactual explanations.
- Model limitations.
- Separating fact from inference.

## 14.6 Machine-learning operations
Required knowledge:

- Dataset versioning.
- Feature stores.
- Model registries.
- Training pipelines.
- Deployment.
- Rollbacks.
- Shadow testing.
- Canary releases.
- Online inference.
- Batch inference.
- Monitoring.
- Drift detection.
- Performance dashboards.

---

# 15. Organic-volume and manipulation-analysis skills
The developer or data scientist must understand:

- Wash trading.
- Self-trading.
- Circular trading.
- Matched transactions.
- Bot-generated microtransactions.
- Repetitive trade sizing.
- Repetitive intervals.
- Wallet-cluster internal trading.
- Volume without beneficial-ownership change.
- Paid boosts.
- Incentive farming.
- Referral manipulation.
- Fake social engagement.
- Pump-and-dump behavior.
Required analytical methods:

- Unique-economic-actor estimation.
- Cluster-adjusted volume.
- Ownership-change measurement.
- Trade-sequence analysis.
- Funding-source analysis.
- Circular-flow detection.
- Volume-to-liquidity anomaly detection.
- Buyer-quality scoring.
- Behavioral baselines.
- Confidence scoring.

---

# 16. Risk-engineering skills

## 16.1 Smart-contract risk
The system must inspect:

- Mint authority.
- Freeze authority.
- Token extensions.
- Transfer fees.
- Transfer restrictions.
- Upgrade authority.
- Metadata mutability.
- Delegates.
- Treasury controls.
- Liquidity controls.
- Vesting contracts.
- Sell behavior.
- Transfer simulation.

## 16.2 Economic risk
Required understanding:

- Insider concentration.
- Clustered ownership.
- Creator cost basis.
- Sellable supply.
- Liquidity concentration.
- Exit capacity.
- Creator incentives.
- Reward extraction.
- Treasury risk.
- Market-maker dependency.
- Unlock schedules.

## 16.3 Behavioral risk
Required knowledge:

- Insider preparation.
- Wallet consolidation.
- Fresh-wallet creation.
- Gas funding.
- Test sells.
- Supply splitting.
- Coordinated selling.
- Social deletion.
- Sudden authority changes.
- Repeated creator patterns.

## 16.4 Risk communication
Every risk finding should include:

- Severity.
- Confidence.
- Evidence.
- Possible financial impact.
- Time sensitivity.
- Suggested action.
- Limitations.

---

# 17. Portfolio and financial-accounting skills

## 17.1 Position accounting
Required knowledge:

- Average cost.
- FIFO.
- LIFO.
- Specific-lot accounting.
- Partial disposals.
- Transfers.
- Airdrops.
- Creator allocations.
- Staking rewards.
- Rebases where applicable.
- Token redenominations.
- Wrapped assets.

## 17.2 Profit and loss
Required calculations:

- Gross realized P&L.
- Net realized P&L.
- Gross unrealized P&L.
- Estimated net unrealized P&L.
- Fee attribution.
- Slippage attribution.
- Price-impact attribution.
- Funding payments.
- Rebates.
- Failed-transaction costs.
- Break-even price.

## 17.3 Performance analytics
Required metrics:

- Return.
- Drawdown.
- Win rate.
- Profit factor.
- Average winner.
- Average loser.
- Holding period.
- Sharpe-like measures where appropriate.
- Exposure.
- Concentration.
- Turnover.
- Fees as a percentage of gross profit.
- Performance by strategy.
- Performance by wallet.
- Performance by source.

## 17.4 Reconciliation
The accounting system must reconcile:

- Application records.
- Signed transactions.
- Confirmed blockchain transactions.
- Token-account balances.
- Open orders.
- Venue positions.
- Deposits.
- Withdrawals.
- Fees.
- Rebates.

---

# 18. Wallet and custody security skills

## 18.1 Wallet architecture
Required knowledge:

- Self-custody.
- Embedded wallets.
- Externally connected wallets.
- Smart accounts.
- Multisignature wallets.
- Session keys.
- Delegated authority.
- Watch-only wallets.
- Hardware wallets.
- Recovery mechanisms.

## 18.2 Key management
Required knowledge:

- Secure key generation.
- Entropy.
- Encryption.
- Key derivation.
- Hardware security modules.
- Secure enclaves.
- Key rotation.
- Backup.
- Recovery.
- Export.
- Zeroization.
- Access control.
- Audit logs.

## 18.3 Transaction authorization
Required controls:

- Spending limits.
- Token allowlists.
- Program allowlists.
- Time limits.
- Device approval.
- Step-up authentication.
- Withdrawal delays.
- Destination allowlists.
- Guardian approval.
- Session revocation.

## 18.4 Phishing and wallet-drain protection
Required capabilities:

- Malicious-domain detection.
- Homograph detection.
- Suspicious approval warnings.
- Transaction simulation.
- Human-readable transaction summaries.
- Address-poisoning warnings.
- Clipboard monitoring within appropriate privacy limits.
- Known-drainer detection.
- Risky-program warnings.

---

# 19. Cybersecurity skills

## 19.1 Application security
Required knowledge:

- Secure coding.
- Threat modeling.
- Authentication attacks.
- Authorization flaws.
- Injection.
- Cross-site scripting.
- Cross-site request forgery.
- Server-side request forgery.
- Insecure deserialization.
- Path traversal.
- File-upload attacks.
- Business-logic abuse.
- API abuse.
- Rate limiting.

## 19.2 Infrastructure security
Required knowledge:

- Network segmentation.
- Firewalls.
- Identity and access management.
- Secret management.
- Container security.
- Kubernetes security if used.
- Cloud security.
- Logging.
- Detection and response.
- Patch management.

## 19.3 Supply-chain security
Required controls:

- Dependency scanning.
- Lockfiles.
- Signed builds.
- Reproducible builds where possible.
- Secret scanning.
- Package verification.
- Software bills of materials.
- CI/CD access controls.
- Third-party SDK review.

## 19.4 Threat modeling
The security team must model threats from:

- External attackers.
- Malicious token creators.
- Malicious traders.
- Insider employees.
- Compromised infrastructure providers.
- Compromised RPC providers.
- Malicious browser extensions.
- Phishing.
- Wallet drainers.
- Frontend supply-chain attacks.
- Smart-contract exploits.
- Data-poisoning attacks.
- Model-evasion attacks.

## 19.5 Incident response
Required capabilities:

- Alert triage.
- Key compromise response.
- Smart-contract pause procedures where designed.
- Frontend shutdown procedures.
- Malicious-domain response.
- User notification.
- Evidence preservation.
- Recovery.
- Post-incident review.
- Public status communication.

---

# 20. DevOps, cloud, and infrastructure skills

## 20.1 Linux administration
Required knowledge:

- Processes.
- Services.
- Filesystems.
- Permissions.
- Networking.
- Resource monitoring.
- Log management.
- Package management.
- Security hardening.

## 20.2 Containers
Required knowledge:

- Docker.
- Image optimization.
- Multi-stage builds.
- Container registries.
- Secrets.
- Health checks.
- Resource limits.
- Container security.

## 20.3 Orchestration
Where required:

- Kubernetes.
- Deployments.
- Services.
- Ingress.
- Autoscaling.
- ConfigMaps.
- Secrets.
- Stateful workloads.
- Rolling deployments.
- Pod-disruption budgets.
- Network policies.

## 20.4 Infrastructure as code
Required knowledge:

- Terraform or equivalent.
- Repeatable environments.
- State management.
- Secret separation.
- Module design.
- Change review.
- Disaster recovery.

## 20.5 CI/CD
Required capabilities:

- Automated tests.
- Linting.
- Type checking.
- Security scans.
- Build artifacts.
- Staging deployments.
- Canary releases.
- Rollbacks.
- Database migrations.
- Smart-contract deployment controls.
- Approval gates.

## 20.6 Observability
Required knowledge:

- Logs.
- Metrics.
- Traces.
- Dashboards.
- Alerting.
- Service-level indicators.
- Service-level objectives.
- Error budgets.
- RPC monitoring.
- Quote monitoring.
- Order monitoring.
- Data-pipeline lag.
- Model-performance monitoring.

---

# 21. Site reliability engineering skills
The platform must remain dependable during extreme traffic and market volatility.

Required abilities:

- Capacity planning.
- Load testing.
- Stress testing.
- Chaos testing.
- Failover.
- Redundancy.
- Graceful degradation.
- Incident management.
- On-call operations.
- Postmortems.
- Recovery-point objectives.
- Recovery-time objectives.
- Backup testing.
- Provider diversification.
- Dependency-health checks.
Critical reliability scenarios include:

- RPC provider failure.
- WebSocket disconnect.
- Quote-provider failure.
- Database overload.
- Sudden launch traffic.
- Block-engine outage.
- Delayed blockchain data.
- Duplicate transaction submission.
- Incorrect market-data feed.
- Risk-engine outage.
- Alert-delivery outage.

---

# 22. Testing and quality-assurance skills

## 22.1 Unit testing
Required for:

- Pricing.
- Fee calculations.
- Token decimals.
- Order-state transitions.
- Risk rules.
- P&L.
- Wallet clustering.
- Alert conditions.

## 22.2 Integration testing
Required for:

- Wallet connections.
- RPC providers.
- DEX routing.
- Transaction simulation.
- Order submission.
- Portfolio updates.
- Alert delivery.
- Database writes.
- Smart-contract interaction.

## 22.3 End-to-end testing
Required journeys:

- Create account.
- Connect wallet.
- Deposit.
- Search token.
- Analyze token.
- Buy.
- Sell.
- Set limit order.
- Receive alert.
- Apply risk rule.
- Export history.
- Launch token.

## 22.4 Performance testing
Required tests:

- Thousands of market updates.
- Large discovery tables.
- Burst orders.
- High alert volume.
- Token-launch spikes.
- Large wallet graphs.
- Historical report generation.
- Database failover.

## 22.5 Security testing
Required tests:

- Penetration testing.
- Smart-contract audits.
- Fuzz testing.
- Authorization testing.
- Session testing.
- API abuse testing.
- Wallet-signing testing.
- Dependency testing.
- Phishing simulations.

## 22.6 Financial and blockchain reconciliation testing
Tests should verify that:

- Portfolio balances match the chain.
- Fees are correctly attributed.
- Failed transactions are recorded.
- Partial fills are processed correctly.
- Transfers are not treated as profit.
- Quotes expire correctly.
- Orders do not duplicate.

---

# 23. AI engineering skills
An AI developer working on this product needs more than prompt-writing ability.

## 23.1 AI-assisted software development
Required capabilities:

- Breaking specifications into tasks.
- Generating code with clear constraints.
- Reviewing generated code.
- Running tests.
- Debugging.
- Refactoring.
- Maintaining architectural consistency.
- Avoiding duplicated modules.
- Managing context across a large codebase.
- Producing migrations.
- Producing documentation.
- Verifying security assumptions.

## 23.2 Large-language-model integration
Possible platform uses include:

- Token-report summaries.
- Risk explanation.
- Natural-language search.
- Trader research assistant.
- Support automation.
- Alert summarization.
- Creator disclosure assistance.
- Querying wallet and token data.
Required skills:

- Structured outputs.
- Tool calling.
- Retrieval-augmented generation.
- Prompt injection defense.
- Data grounding.
- Citation generation.
- Output validation.
- Model routing.
- Cost control.
- Latency optimization.
- Evaluation.
- Hallucination reduction.

## 23.3 AI-agent architecture
Required knowledge:

- Tool permissions.
- Sandboxed execution.
- Read versus write tools.
- Approval gates.
- Transaction confirmation.
- Memory boundaries.
- Task planning.
- Retry limits.
- Audit logs.
- Deterministic validation.
- Human review.
No AI agent should be able to transfer assets merely because a natural-language instruction was interpreted incorrectly.

## 23.4 AI evaluation
Required capabilities:

- Building test sets.
- Measuring factual accuracy.
- Measuring explanation quality.
- Testing prompt injection.
- Testing adversarial token metadata.
- Evaluating false accusations.
- Monitoring model drift.
- Comparing model versions.
- Recording source evidence.
- Blocking unsupported claims.

## 23.5 AI safety for financial actions
The system should enforce:

- Explicit approval for trades.
- Maximum permitted order size.
- Restricted tools.
- User-defined risk policies.
- No private-key exposure.
- No unsupported safety guarantees.
- No autonomous withdrawal.
- Clear uncertainty.
- Full action logs.

---

# 24. Product-management skills
The product manager or technical founder must understand:

- User research.
- Competitor analysis.
- Product strategy.
- Prioritization.
- Roadmapping.
- User stories.
- Acceptance criteria.
- Metrics.
- Release planning.
- Risk management.
- Stakeholder communication.
- Scope control.
- Beta programs.
- Feedback analysis.
- Pricing.
- Growth loops.
- Compliance dependencies.
The product manager must resist trying to release every feature simultaneously.

---

# 25. Technical-writing skills
Required documents include:

- Product requirements.
- System architecture.
- API documentation.
- Database documentation.
- Smart-contract specifications.
- Threat models.
- Runbooks.
- Incident procedures.
- Risk-model documentation.
- Model cards.
- User guides.
- Creator guides.
- Wallet-security guides.
- Legal disclosures.
- Release notes.
- Change logs.
Good documentation must be:

- Versioned.
- Searchable.
- Technically accurate.
- Updated with releases.
- Written for the intended audience.

---

# 26. Legal and compliance awareness
The developer is not a substitute for legal counsel, but the team must understand that these areas affect system design.

Required awareness:

- Financial-product regulation.
- Token-launch regulation.
- Derivatives restrictions.
- Consumer protection.
- Market manipulation.
- Sanctions.
- Restricted jurisdictions.
- Know-your-customer obligations where applicable.
- Anti-money-laundering obligations where applicable.
- Privacy laws.
- Data retention.
- User deletion requests.
- Promotions and referral disclosures.
- Tax exports.
- Security-breach notification.
- Liability created by risk labels.
The system must support configurable regional restrictions rather than hard-coding one global policy.

---

# 27. Communication and collaboration skills
Senior contributors must be able to:

- Explain technical tradeoffs.
- Review code.
- Write design documents.
- Participate in incident response.
- Work with product designers.
- Work with data scientists.
- Work with security engineers.
- Work with legal counsel.
- Challenge unsafe decisions.
- Communicate uncertainty.
- Document assumptions.
- Give and receive feedback.
- Mentor junior contributors.

---

# 28. Recommended team roles
A production-grade version should eventually include the following roles.

## 28.1 Technical founder or principal architect
Responsible for:

- System architecture.
- Technical strategy.
- Build-versus-buy decisions.
- Security priorities.
- Service boundaries.
- Technical hiring.
- Code-quality standards.
- Cross-team decisions.

## 28.2 Senior frontend engineers
Responsible for:

- Trading terminal.
- Discovery tables.
- Charts.
- Wallet connection.
- Portfolio screens.
- Risk reports.
- Responsive layouts.
- Performance.
Recommended initial number: two or three.

## 28.3 Senior backend engineers
Responsible for:

- APIs.
- User systems.
- Orders.
- Portfolio.
- Alerts.
- Integrations.
- Business logic.
Recommended initial number: two or three.

## 28.4 Solana engineers
Responsible for:

- Transaction construction.
- Program decoding.
- DEX integration.
- RPC infrastructure.
- Smart-contract development.
- Launchpad programs.
Recommended initial number: two or more.

## 28.5 Data engineer or blockchain-indexer engineer
Responsible for:

- Solana ingestion.
- Historical backfills.
- Event streams.
- Market data.
- Data quality.
- Warehousing.
Recommended initial number: one or two.

## 28.6 Machine-learning and graph engineer
Responsible for:

- Wallet clustering.
- Creator linking.
- Organic-volume analysis.
- Insider detection.
- Risk scoring.
- Model evaluation.
Recommended initial number: two specialists or one strong specialist supported by a data engineer.

## 28.7 Security engineer
Responsible for:

- Threat modeling.
- Application security.
- Wallet security.
- Cloud security.
- Incident response.
- Audit coordination.
At least one dedicated senior security engineer is strongly recommended before public custody or trading functionality.

## 28.8 DevOps or site-reliability engineer
Responsible for:

- Cloud infrastructure.
- Deployment.
- Monitoring.
- Scaling.
- Failover.
- Backups.
- Incident operations.
Recommended initial number: one senior engineer.

## 28.9 Product designer
Responsible for:

- UX.
- Research.
- Prototypes.
- Design system.
- Trading workflows.
- Risk communication.
- Mobile behavior.
Recommended initial number: one senior designer.

## 28.10 Quality-assurance or automation engineer
Responsible for:

- Test plans.
- End-to-end automation.
- Regression testing.
- Load testing.
- Release qualification.
Recommended initial number: one.

## 28.11 Product manager
Responsible for:

- Product requirements.
- User research.
- Priorities.
- Acceptance criteria.
- Metrics.
- Release planning.

## 28.12 Compliance and legal specialists
These may initially be external advisers, but they must be involved before:

- Token launches.
- Fiat integration.
- Referral programs.
- Perpetual futures.
- Custodial functionality.
- Regional expansion.

---

# 29. Minimum team for an early MVP
A serious MVP can be attempted with approximately six to nine experienced contributors:

1. Principal architect or technical founder.
2. Senior frontend engineer.
3. Senior backend engineer.
4. Solana and execution engineer.
5. Blockchain data engineer.
6. Machine-learning and graph engineer.
7. Product designer.
8. Security or DevOps engineer.
9. Product manager or highly technical founder.
Some people may cover two areas during the earliest stage, but security, Solana execution, and financial accounting should not be assigned to inexperienced generalists.

---

# 30. Skills required for a solo prototype developer
A single strong developer building a prototype should ideally possess:

- Advanced TypeScript.
- React and Next.js.
- Node.js backend development.
- PostgreSQL.
- Redis.
- Solana Web3 client development.
- Wallet-adapter integration.
- Transaction construction and simulation.
- DEX quote and swap integration.
- WebSockets.
- Basic blockchain indexing.
- Basic chart integration.
- Token and wallet data modeling.
- Docker.
- Cloud deployment.
- Unit and integration testing.
- Basic cybersecurity.
- Financial arithmetic.
- Basic graph analytics.
- Basic machine-learning literacy.
- Strong AI-assisted coding ability.
A solo developer should use existing providers for:

- RPC infrastructure.
- Historical blockchain data.
- DEX aggregation.
- Authentication.
- Embedded wallets.
- Notifications.
- Monitoring.
- Cloud databases.
The solo developer should not initially attempt:

- A custom validator client.
- A fully independent data index of the entire chain.
- Production-grade custody.
- A derivatives protocol.
- A complex cross-chain bridge.
- A native launchpad with unaudited contracts.
- Fully autonomous AI trading.
- Highly confident fraud accusations without review.

---

# 31. Skills an AI coding agent must be given
An AI developer cannot possess operational skill merely because it can generate code. It must have the correct tools, context, restrictions, and evaluation process.

The AI agent should have controlled access to:

- Repository search.
- Code editing.
- Type checking.
- Test execution.
- Linting.
- Local Solana validator.
- Database migrations.
- Development RPC endpoints.
- API documentation.
- Architecture documents.
- Issue tracker.
- CI results.
- Security scanners.
- Deployment previews.
- Log inspection.
The AI agent should not receive unrestricted access to:

- Production private keys.
- Production withdrawal systems.
- Production database deletion.
- Mainnet contract upgrades.
- Unreviewed dependency installation.
- User recovery phrases.
- Treasury signing.
- Autonomous production deployments.
Every AI-generated change affecting the following should require human review:

- Wallet signing.
- Key management.
- Withdrawals.
- Order submission.
- Smart contracts.
- Fee calculation.
- Portfolio accounting.
- Risk labels.
- Authentication.
- Authorization.
- Infrastructure access.
- Database deletion.
- Production deployment.

---

# 32. Recommended hiring evaluation

## Frontend candidate test
Ask the candidate to build:

- A virtualized, real-time token table.
- A token detail screen.
- A mock buy ticket.
- A WebSocket update stream.
- A responsive layout.
- Clear loading and error states.
Evaluate:

- Performance.
- Type safety.
- Architecture.
- Accessibility.
- Financial precision.
- Error handling.
- UX quality.

## Backend candidate test
Ask the candidate to design:

- An order state machine.
- An idempotent transaction-submission API.
- A token-alert system.
- A portfolio ledger.
- A provider-failover strategy.
Evaluate:

- Reliability.
- Data modeling.
- Concurrency.
- Failure recovery.
- Security.
- Testing.

## Solana candidate test
Ask the candidate to:

- Decode a swap transaction.
- Build and simulate a transaction.
- Explain priority fees.
- Explain account ownership.
- Identify token-authority risks.
- Design a simple vesting program.
- Discuss common Solana program vulnerabilities.

## Data and machine-learning candidate test
Ask the candidate to:

- Design wallet-clustering features.
- Detect suspicious volume.
- Explain label leakage.
- Create a time-based validation plan.
- Explain false-positive risks.
- Produce an explainable risk output.

## Security candidate test
Ask the candidate to threat-model:

- An embedded wallet.
- A one-click trading terminal.
- A token launchpad.
- A transaction-signing flow.
- An AI trading assistant.

---

# 33. Mandatory skills versus later-stage skills

## Mandatory for the first intelligence-terminal MVP

- TypeScript.
- React or Next.js.
- Backend API development.
- PostgreSQL.
- Redis.
- Solana client development.
- RPC and WebSocket integration.
- DEX swap integration.
- Market data.
- Basic indexing.
- Wallet connection.
- Transaction simulation.
- Portfolio accounting.
- Graph fundamentals.
- Fraud-analysis fundamentals.
- Docker and cloud deployment.
- Application security.
- Automated testing.
- UI and UX design.
- Product management.

## Mandatory before native launchpad release

- Rust.
- Solana program development.
- Bonding-curve mathematics.
- Vesting and treasury design.
- Smart-contract security.
- Economic simulations.
- Independent audits.
- Launch abuse prevention.
- Creator-reputation workflows.
- Legal review.

## Mandatory before perpetual futures

- Derivatives knowledge.
- Margin calculations.
- Liquidation mechanics.
- Funding rates.
- Leverage-risk controls.
- Regional restrictions.
- Venue-integration reliability.

## Mandatory before institutional APIs

- Strong API governance.
- Service-level agreements.
- Enterprise authentication.
- Usage metering.
- Data licensing.
- High availability.
- Customer isolation.
- Compliance review.

---

# 34. Skills priority order
The team should build competency in this order:

## Priority 1: Safety and correctness

- Wallet security.
- Transaction construction.
- Financial calculations.
- Authentication.
- Authorization.
- Smart-contract security.
- Data accuracy.

## Priority 2: Core trading infrastructure

- Market data.
- Quotes.
- Routing.
- Orders.
- Execution.
- Portfolio reconciliation.
- Real-time interfaces.

## Priority 3: Intelligence moat

- Wallet clustering.
- Effective ownership.
- Creator history.
- Organic-volume analysis.
- Insider alerts.
- Exitability.
- Explainable risk.

## Priority 4: User experience

- Discovery.
- Token reports.
- Personal risk rules.
- Alerts.
- Custom workspaces.
- Mobile experience.

## Priority 5: Platform expansion

- Native launchpad.
- Perpetuals.
- Yield.
- Multi-chain.
- Institutional APIs.

---

# 35. Final competency definition
The ideal lead developer for this project is not merely a website developer or a blockchain developer.

The lead must be able to understand and coordinate:

- Real-time financial systems.
- Solana transactions and programs.
- DEX execution.
- Secure wallet architecture.
- Large-scale blockchain indexing.
- Graph-based identity resolution.
- Manipulation and fraud detection.
- Financial accounting.
- Cloud reliability.
- Product design.
- Security.
- AI-assisted engineering.
The broader team must collectively be capable of:

1. Building a responsive, professional trading terminal.
2. Integrating and safely executing Solana transactions.
3. Indexing and interpreting blockchain activity.
4. Identifying related wallets and effective ownership.
5. Separating organic demand from manipulated volume.
6. Detecting insider and creator behavior.
7. Estimating realistic exit value.
8. Calculating true net profitability.
9. Enforcing personal risk rules.
10. Creating secure token-launch smart contracts.
11. Operating the platform reliably during extreme market activity.
12. Explaining every important risk conclusion with evidence.
13. Protecting user assets, data, and trust.
The strongest hiring principle is:

> Do not hire only for the ability to create features. Hire for the ability to create financially correct, adversarially resilient, observable, testable, and secure systems.
For the first version, prioritize excellent Solana execution, accurate data, wallet security, portfolio correctness, and the intelligence layer. Additional features will not compensate for failures in those foundations.
