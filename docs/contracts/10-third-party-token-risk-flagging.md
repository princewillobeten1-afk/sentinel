# 10 — Third-Party Token Contract Analysis & Risk Flags

Spec §41-45 (contract ↔ intelligence engine, external token analysis, token risk flags, contract risk score, economic safety).

## One vocabulary, first-party and third-party alike

The platform analyzes tokens it did not create — spec §42 is explicit that the intelligence layer cannot assume every token follows this platform's own contract standards. This codebase already has real, live contract-risk detection for exactly that case, and this sprint's first-party contract interfaces are designed to plug into it rather than invent a parallel one:

- `lib/intelligence/engines/contract.ts` — the general `CONTRACT` risk dimension. Its `ContractObservation` output (`mintAuthority`/`freezeAuthority` as `AuthorityState` — `ACTIVE|REVOKED|UNKNOWN` — plus `totalSupply`/`circulatingSupply`/`supplyChangeable`/`metadataUri`/`metadataChangeable`/`programId`/`isUpgradeable`) is the **canonical shape**. `ITokenFactory.getTokenContract()` (`02-token-factory.md`) returns this exact type.
- `lib/intelligence/engines/token-security.ts` — Solana-specific signals actually populated by Birdeye today: `nonTransferable` (CRITICAL — "cannot be sent or sold at all"), `transferFeeEnable` (MEDIUM — a Token-2022 sell-tax equivalent), `isToken2022 && freezeable` (a low signal, no score hit alone). EVM-only fields (`isHoneypot`, etc.) are present for honesty/future-proofing but Birdeye's Solana endpoint doesn't populate them — an absent field is informational (`MissingDataEntry`), never treated as a score penalty.

**No first-party/third-party branch is needed anywhere in this risk-flagging logic.** A token this platform's own `TokenFactory` created is queried through the identical `getTokenContract()` → `ContractObservation` path a token from anywhere else is queried through. If a first-party launch somehow produced a token with an active, unrevoked mint authority, it would score exactly as unfavorably as a third-party token with the same property — there is no "trust our own tokens more" carve-out.

## Token risk flags (spec §43)

Already real, already detected (not new to this sprint): mint authority, freeze authority, non-transferability, transfer-fee/tax mechanisms, upgradeable-program status. Not yet detected on Solana (flagged honestly rather than assumed covered): a general blacklist mechanism separate from freeze authority, and EVM-style `isHoneypot`/tax fields, since Birdeye's Solana endpoint doesn't surface them — see `token-security.ts`'s own header comment.

## Contract risk score is one input, not the whole score (spec §44-45)

`RiskCategory` (`lib/intelligence/types.ts`) already models `CONTRACT` as one of seven categories (`MARKET | LIQUIDITY | OWNERSHIP | CREATOR | ACTIVITY | CONTRACT | EXIT`) — a technically-safe contract (revoked authorities, immutable supply) combined with severe ownership concentration or a known-bad creator still scores poorly overall. This sprint changes nothing about that composition; it's cited here because a smart-contract spec that implied "contract analysis alone determines safety" would misrepresent how the platform's own intelligence engine already works.
