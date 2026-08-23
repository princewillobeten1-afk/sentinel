'use client';

/**
 * Official wallet brand marks.
 *
 * The connect modal rendered emoji stand-ins — 👻 for Phantom, 🔥 for Solflare.
 * They read as placeholders, because they are: a ghost emoji is not the Phantom
 * logo.
 *
 * Icons here come from the wallets themselves, never from a drawing of ours:
 *
 *  1. **Wallet Standard** (`@wallet-standard/app`) — every modern Solana wallet
 *     registers itself with a `name` and an `icon` data URI. This covers any
 *     installed wallet, and the asset is the wallet's own current logo.
 *  2. **Adapter packages** — `@solana/wallet-adapter-phantom` and
 *     `-solflare` each expose an official `icon`, used when the wallet is not
 *     installed so the "Get a wallet" list still shows a real mark.
 *
 * A wallet with no discoverable icon gets a lettermark, not an invented logo.
 */

import { getWallets } from '@wallet-standard/app';
import type { WalletProviderId } from './types';

/** Maps a Wallet Standard display name onto our adapter ids. */
const NAME_TO_ID: Record<string, WalletProviderId> = {
  phantom: 'phantom',
  solflare: 'solflare',
};

/**
 * Icons for wallets installed in this browser, keyed by our adapter id.
 *
 * Reads the Wallet Standard registry, which is how wallets announce
 * themselves — so the logo is whatever the wallet currently ships, and it
 * stays correct when a brand refreshes without us shipping an update.
 */
export function getInstalledWalletIcons(): Partial<Record<WalletProviderId, string>> {
  if (typeof window === 'undefined') return {};

  try {
    const out: Partial<Record<WalletProviderId, string>> = {};
    for (const wallet of getWallets().get()) {
      const id = NAME_TO_ID[wallet.name?.trim().toLowerCase() ?? ''];
      // Only data URIs — a remote URL would be blocked by the CSP and render
      // as a broken image, which looks worse than a lettermark.
      if (id && typeof wallet.icon === 'string' && wallet.icon.startsWith('data:')) {
        out[id] = wallet.icon;
      }
    }
    return out;
  } catch {
    // Registry unavailable in this browser — fall back to the bundled marks.
    return {};
  }
}

/**
 * Bundled official marks for wallets we ship an adapter for.
 *
 * Loaded lazily and only in the browser: the adapter modules touch `window`
 * on construction, so importing them at module scope breaks SSR.
 */
export function getBundledWalletIcons(): Partial<Record<WalletProviderId, string>> {
  if (typeof window === 'undefined') return {};

  const out: Partial<Record<WalletProviderId, string>> = {};
  try {
    const { PhantomWalletAdapter } = require('@solana/wallet-adapter-phantom');
    const icon = new PhantomWalletAdapter().icon;
    if (typeof icon === 'string' && icon.startsWith('data:')) out.phantom = icon;
  } catch {
    // Adapter unavailable; the lettermark covers it.
  }
  try {
    const { SolflareWalletAdapter } = require('@solana/wallet-adapter-solflare');
    const icon = new SolflareWalletAdapter().icon;
    if (typeof icon === 'string' && icon.startsWith('data:')) out.solflare = icon;
  } catch {
    // Adapter unavailable; the lettermark covers it.
  }
  return out;
}

/** Installed icons win — they are the wallet's current asset. */
export function getWalletIcons(): Partial<Record<WalletProviderId, string>> {
  return { ...getBundledWalletIcons(), ...getInstalledWalletIcons() };
}
