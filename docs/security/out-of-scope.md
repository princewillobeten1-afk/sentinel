# Explicitly Out of Scope

Per the source spec's 98 sections, these require external engagement or
infrastructure this codebase doesn't have — building fake versions of them
would be decorative, not real. Listed here so the gap is visible, not
silently absent.

| Item | Why it's out of scope this sprint |
|---|---|
| **External penetration testing** | Requires an independent third-party security team — not something a codebase can do to itself. Worth commissioning once real funds/custody are at stake. |
| **Smart-contract audits** | No real on-chain program exists anywhere in this repo (confirmed via a repo-wide search for `.rs` files/an `anchor` directory — none found). Launch deployment is entirely simulated server-side (`lib/launchpad/engine.ts`). A written specification and typed interfaces exist as of Sprint 36 (`docs/contracts/`), but no deployed on-chain program exists yet — commissioning a real audit is only meaningful once real Anchor/Rust code is written and deployed, not against a specification. |
| **Bug bounty program** | Requires a mature, publicly-reachable production deployment and a triage process — premature for a development-stage app with simulated execution. |
| **SIEM integration** | Requires a real SIEM product/vendor relationship. The structured audit log (`lib/server/audit.ts`) is designed to be a reasonable future data source for one, but no integration exists. |
| **HSM procurement** | Only meaningful once real custodial key material exists to protect — this platform is non-custodial (see [`key-management-policy.md`](./key-management-policy.md)). |
| **Multi-region infrastructure** | Runs as a single Node process today (`node server.js`), no cloud deployment target exists to make multi-region meaningful. |
| **RPC redundancy / failover** | `env.SOLANA_RPC_URL` is a single configured endpoint with no fallback provider or health-check/failover logic. A real gap for production reliability, not built this sprint — flagged here rather than silently present. |
| **Real employee org / RBAC beyond the app's own role model** | `lib/server/rbac.ts`'s `user`/`admin`/`analyst` roles are the only role model that exists — there's no real organization with Support/Compliance/Security/Finance/Operations/Engineering distinctions to model, because there's no real employee headcount yet. |
| **Dual control on role changes** | `POST /api/v1/admin/users/:id/role` is single-admin (audited, but not dual-controlled) — only kill-switch actions got dual control this sprint. A real gap if role changes are judged as sensitive as trading pauses; flagged rather than silently scoped the same. |
| **Admin-initiated revocation of another user's session** | Only self-service session revocation exists (`DELETE /api/v1/auth/sessions/:id`, ownership-checked). An admin responding to an incident today would need direct store access, not a route — see [`incident-response.md`](./incident-response.md). |
| **"Impossible travel" account-takeover detection** | No geolocation/IP-to-geo data source exists anywhere in this codebase. Building one from scratch to support a single heuristic would be disproportionate and likely decorative (a naive implementation is easy to get wrong). New-device/new-IP detection (real, built this sprint) is the honest substitute. |
| **Real database / persistence** | Everything remains in-memory, `globalThis`-guarded, matching every prior sprint's persistence decision. See [`disaster-recovery.md`](./disaster-recovery.md). |
| **Retrofitting the ~120 pre-existing non-gateway routes onto the API gateway/scopes/RBAC** | Sprint 28's explicit scope boundary, unchanged this sprint — only the routes this sprint's tiers actually touch got the new controls. |
| **Real AI/LLM security controls beyond the policy chokepoint** | No real AI exists in this codebase. See [`ai-policy.md`](./ai-policy.md). |
| **Fraud/market-manipulation detection (wash trading, spoofing, sybil clustering)** | Real detection would need real trading volume and real wallet behavior to detect patterns in — execution is simulated, so there's no real market to police yet. The launchpad risk engine's creator/ownership checks (real this sprint) are the closest existing analog. |
| **Blockchain reorg handling / confirmation-policy tiers** | Trade execution remains fully simulated (see above). Real on-chain confirmation now exists for the self-custodial wallet transfer feature, but it uses `'confirmed'` commitment (not `'finalized'`) for responsiveness — a deliberate, stated tradeoff (see [`threat-model.md`](./threat-model.md)'s "Wallet transfers" section), not a full reorg-handling policy. |
| **Mainnet wallet transfers** | Deposit/withdraw (see [`threat-model.md`](./threat-model.md)'s "Wallet transfers" section) targets Solana devnet only — real financial risk is why. The env wiring technically allows a `solana:mainnet` override, but nothing about copy, UX, or QA has validated real-value behavior; treat mainnet as unsupported until a dedicated follow-up explicitly re-scopes it. |
| **Multi-signature / extra-confirmation step for large wallet transfers** | Every self-custodial transfer, regardless of size, goes through the same single-signature flow. A "type the amount to confirm" or cooling-off step for large sends is a real, reasonable future hardening measure, not built this pass. |
| **Wallet address book / whitelist** | The send flow's "you've never sent here before" warning is a plain query against the user's own transaction history — not a maintained, editable, named address-book feature. |

## A note on scope discipline

Every item above was deliberately left out, not overlooked. Where a
cheaper, honest partial version was buildable (new-device detection instead
of impossible-travel, a single concrete circuit-breaker trigger instead of
a generic framework, dual control on the one action-class judged highest-
stakes), it was built. Where nothing honest could be built without either
external engagement or infrastructure that doesn't exist, it's listed here
instead of faked.
