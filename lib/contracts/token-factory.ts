/**
 * `ITokenFactory` — spec §4-8 (Token Factory, creation flow, standardization,
 * immutable-vs-configurable parameters, no hidden minting).
 *
 * A first-party token created through this contract must be observable
 * through the exact same `ContractObservation` shape
 * `lib/intelligence/engines/contract.ts` already produces for third-party
 * tokens (see docs/contracts/10-third-party-token-risk-flagging.md) — there
 * is deliberately no separate "our own tokens" vocabulary.
 */

import type { Address, ChainId, ContractObservation, AuthorityState, TxSignature, BigNumberish, UnixTimestamp } from './types';

export interface TokenCreationParams {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: BigNumberish;
  metadataUri?: string;
  /** Immutable once set (spec §7-8): true means mint authority is revoked at creation, not merely disclosed. */
  mintAuthorityRevoked: boolean;
  /** Immutable once set: true means freeze authority is revoked at creation. */
  freezeAuthorityRevoked: boolean;
  chain: ChainId;
}

export interface TokenCreationResult {
  tokenAddress: Address;
  mintAuthority: AuthorityState;
  freezeAuthority: AuthorityState;
  txSignature: TxSignature;
  createdAt: UnixTimestamp;
}

export interface TokenCreationValidation {
  valid: boolean;
  errors: string[];
}

export interface ITokenFactory {
  createToken(params: TokenCreationParams, creatorWallet: Address): Promise<TokenCreationResult>;

  /** Pure validation — no side effects, safe to call before committing to a real creation call. */
  validateCreationParams(params: TokenCreationParams): TokenCreationValidation;

  /**
   * Returns the same `ContractObservation` shape used for external-token
   * analysis. `null` if `tokenAddress` wasn't created by this factory.
   */
  getTokenContract(tokenAddress: Address): Promise<ContractObservation | null>;

  /** Only callable if `mintAuthorityRevoked` was false at creation and revocation is still possible. */
  revokeMintAuthority(tokenAddress: Address, authority: Address): Promise<TxSignature>;

  /** Only callable if `freezeAuthorityRevoked` was false at creation and revocation is still possible. */
  revokeFreezeAuthority(tokenAddress: Address, authority: Address): Promise<TxSignature>;
}
