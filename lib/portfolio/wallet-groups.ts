/**
 * Wallet Grouping & Separation (spec §38, §39, §53)
 *
 * Users group wallets explicitly. Sentinel may *suggest* a relationship when
 * internal-transfer evidence is strong, but it never merges wallets on its own:
 * silently combining a user's cold wallet with someone else's would both
 * corrupt their P&L and leak information across accounts.
 *
 * Groups are private by default (spec §53).
 */

import type { RawLedgerEvent, WalletGroup, PortfolioWallet, WalletLinkSuggestion } from './types';
import { suggestWalletLinks } from './classification';

export interface CreateGroupInput {
  id: string;
  userId: string;
  name: string;
  wallets: Array<{ address: string; chain: string; label?: string; role?: PortfolioWallet['role'] }>;
  createdAt: string;
}

export function createWalletGroup(input: CreateGroupInput): WalletGroup {
  return {
    id: input.id,
    userId: input.userId,
    name: input.name,
    wallets: input.wallets.map((wallet) => ({
      address: wallet.address,
      chain: wallet.chain,
      label: wallet.label ?? defaultLabel(wallet.role ?? 'OTHER'),
      role: wallet.role ?? 'OTHER',
      linkedBy: 'USER',
      linkConfidence: 1,
      addedAt: input.createdAt,
    })),
    visibility: 'PRIVATE',
    createdAt: input.createdAt,
  };
}

/**
 * Returns link suggestions for wallets that are NOT already in the group.
 * Each suggestion requires explicit user confirmation before it changes any
 * portfolio figure.
 */
export function suggestGroupAdditions(
  group: WalletGroup,
  events: RawLedgerEvent[],
): WalletLinkSuggestion[] {
  const grouped = group.wallets.map((wallet) => wallet.address);
  return suggestWalletLinks(events, grouped).map((suggestion) => ({
    walletA: suggestion.walletA,
    walletB: suggestion.walletB,
    confidence: suggestion.confidence,
    transferCount: suggestion.transferCount,
    evidence: suggestion.evidence,
    requiresUserConfirmation: true,
  }));
}

/**
 * Authorization check for portfolio reads (spec §52).
 *
 * A wallet address appearing on-chain does not entitle a session to Sentinel's
 * analytics for it. The caller must own the wallet or the group that contains
 * it.
 */
export function isWalletAuthorized(
  wallet: string,
  userWallets: Array<{ address: string }>,
  groups: WalletGroup[],
  userId: string,
): boolean {
  const target = wallet.trim().toLowerCase();
  if (userWallets.some((entry) => entry.address.trim().toLowerCase() === target)) return true;
  return groups.some(
    (group) =>
      group.userId === userId &&
      group.wallets.some((entry) => entry.address.trim().toLowerCase() === target),
  );
}

/** Combines several groups into one portfolio wallet set (spec §38). */
export function combineGroups(groups: WalletGroup[]): PortfolioWallet[] {
  const seen = new Set<string>();
  const combined: PortfolioWallet[] = [];
  for (const group of groups) {
    for (const wallet of group.wallets) {
      const key = `${wallet.chain}:${wallet.address.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      combined.push(wallet);
    }
  }
  return combined;
}

function defaultLabel(role: PortfolioWallet['role']): string {
  switch (role) {
    case 'TRADING':
      return 'Trading Wallet';
    case 'MAIN':
      return 'Main Wallet';
    case 'BOT':
      return 'Bot Wallet';
    case 'COLD':
      return 'Cold Wallet';
    default:
      return 'Wallet';
  }
}
