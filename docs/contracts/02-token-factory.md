# 02 — Token Factory

Spec §4-8 (Token Factory, creation flow, standardization, immutable-vs-configurable parameters, no hidden minting).

## `ITokenFactory`

```ts
interface ITokenFactory {
  createToken(params: TokenCreationParams, creatorWallet: Address): Promise<TokenCreationResult>;
  validateCreationParams(params: TokenCreationParams): TokenCreationValidation;
  getTokenContract(tokenAddress: Address): Promise<ContractObservation | null>;
  revokeMintAuthority(tokenAddress: Address, authority: Address): Promise<TxSignature>;
  revokeFreezeAuthority(tokenAddress: Address, authority: Address): Promise<TxSignature>;
}
```

Full definition: `lib/contracts/token-factory.ts`.

## Creation flow (spec §5)

```text
Creator
 ↓
Launch configuration (LaunchConfig — lib/launchpad/types.ts)
 ↓
validateCreationParams()  — pure, no side effects, callable before committing
 ↓
createToken()             — TokenCreationResult { tokenAddress, mintAuthority, freezeAuthority, txSignature, createdAt }
 ↓
Launch registration        — see 03-launchpad-and-launch-controller.md
 ↓
Liquidity mechanism        — see 04-bonding-curve.md / 05-liquidity-manager.md
 ↓
Trading enabled
```

## Standardization (spec §6)

Every token created through `createToken` is known to the platform by exactly the fields `TokenCreationParams`/`TokenCreationResult` declare: `name`, `symbol`, `decimals`, `totalSupply`, `metadataUri`, `mintAuthorityRevoked`, `freezeAuthorityRevoked`, `chain`, plus the resulting `tokenAddress`, `mintAuthority`/`freezeAuthority` state, `txSignature`, and `createdAt`. No field is inferred after the fact from an unrelated transaction.

## Immutable vs. configurable (spec §7)

| Field | Classification |
|---|---|
| `totalSupply` | **Immutable** at creation |
| `tokenAddress` | **Immutable** (a deployed address, by construction) |
| `mintAuthorityRevoked` / `freezeAuthorityRevoked` | **Configurable only in the revoking direction** — `revokeMintAuthority`/`revokeFreezeAuthority` exist; there is no `grantMintAuthority`/`grantFreezeAuthority`. Once revoked, revocation is final. |
| `metadataUri` | Configurable (spec §7 explicitly allows metadata/social-link updates) |

No hidden administrative power exists in this interface beyond the two named revoke calls — there is no generic `adminUpdate(tokenAddress, fields)` escape hatch.

## No hidden minting (spec §8)

`getTokenContract()` returns the **same `ContractObservation` shape** (`lib/intelligence/types.ts`) that `lib/intelligence/engines/contract.ts` already produces for tokens this platform did *not* create — see `10-third-party-token-risk-flagging.md`. A first-party token's `mintAuthority`/`freezeAuthority` fields are `AuthorityState` values (`ACTIVE`/`REVOKED`/`UNKNOWN`), verifiable through the identical vocabulary and scoring logic already applied to every external token. There is no separate, more trusting code path for tokens this platform created itself.
