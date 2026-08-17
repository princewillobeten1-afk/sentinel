/**
 * Resolves the database identifiers the order API requires.
 *
 * `POST /api/v1/orders` takes a `walletId` and a `tokenId` — real primary keys,
 * foreign-keyed to `wallets` and `tokens`. The trading UI works in the terms a
 * trader uses: a wallet *address* and a token *symbol*.
 *
 * The legacy `/api/orders` route papered over that gap by accepting whatever it
 * was given (its in-memory store had no foreign keys), so the UI sent a wallet
 * address as `walletId` and the symbol strings 'SOL'/'SENT' as tokens. Against a
 * real schema those are rejected — correctly. This module does the lookup
 * instead of pretending the identifiers are interchangeable.
 */

import { endpoints, apiUrl } from '@/lib/api/endpoints';

export class ResolutionError extends Error {
  constructor(message: string, readonly code: 'WALLET_NOT_FOUND' | 'TOKEN_NOT_FOUND' | 'UNAUTHENTICATED') {
    super(message);
    this.name = 'ResolutionError';
  }
}

interface WalletDto {
  id: string;
  address: string;
  isPrimary?: boolean;
}

interface TokenDto {
  id: string;
  address: string;
  symbol: string;
  chainId: string;
}

/**
 * Finds the caller's wallet row id for a given address.
 *
 * Address comparison is case-insensitive because chains differ: EVM addresses
 * are routinely displayed checksummed while stored lowercase. Solana base58 is
 * case-sensitive in principle, but two distinct valid Solana addresses cannot
 * differ only by case in practice, so the looser comparison is safe here and
 * avoids a class of "wallet not found" bugs on other chains.
 */
export async function resolveWalletId(address: string): Promise<string> {
  const res = await fetch(apiUrl(endpoints.wallets.list), { credentials: 'include' });

  if (res.status === 401) {
    throw new ResolutionError('Sign in to place an order.', 'UNAUTHENTICATED');
  }
  if (!res.ok) {
    throw new ResolutionError('Could not load your wallets.', 'WALLET_NOT_FOUND');
  }

  const body = await res.json().catch(() => null);
  // Routes answer through the `{ success, data }` envelope.
  const wallets: WalletDto[] = body?.data?.wallets ?? body?.wallets ?? [];
  const target = address.trim().toLowerCase();

  const match = wallets.find((w) => w.address?.toLowerCase() === target);
  if (!match) {
    throw new ResolutionError(
      'That wallet is not linked to your account. Connect it before trading.',
      'WALLET_NOT_FOUND',
    );
  }
  return match.id;
}

/**
 * Finds a token's registry id from a symbol or mint address.
 *
 * Prefers an exact address match, then an exact symbol match, before falling
 * back to the first result: symbols are not unique across a token registry
 * (anyone can deploy a token called "SOL"), so taking the search engine's top
 * hit without checking would be a way to buy the wrong asset.
 */
export async function resolveTokenId(symbolOrAddress: string, chain = 'solana'): Promise<string> {
  const needle = symbolOrAddress.trim();
  if (!needle) throw new ResolutionError('No token specified.', 'TOKEN_NOT_FOUND');

  // Deliberately *not* sent as a `chain=` query param. The registry's
  // `tokens.chain_id` is a foreign key to `chains.id`, whose values look like
  // `chain_solana` — so filtering on the human name 'solana' matches nothing
  // and a token that plainly exists is reported as unregistered. Chain is
  // matched below against both spellings instead of guessing the key format.
  const res = await fetch(
    apiUrl(endpoints.tokens.registry, { search: needle, limit: 25 }),
    { credentials: 'include' },
  );
  if (!res.ok) {
    throw new ResolutionError(`Could not look up ${needle}.`, 'TOKEN_NOT_FOUND');
  }

  const body = await res.json().catch(() => null);
  // `{ success, data: { data: [...] } }` — the registry's own payload key is
  // also `data`, so this unwraps the envelope then the page.
  const all: TokenDto[] = body?.data?.data ?? body?.data ?? [];

  const wanted = chain.trim().toLowerCase();
  const tokens = wanted
    ? all.filter((t) => {
        const id = (t.chainId ?? '').toLowerCase();
        return id === wanted || id === `chain_${wanted}` || id.replace(/^chain_/, '') === wanted;
      })
    : all;

  if (tokens.length === 0) {
    throw new ResolutionError(`${needle} is not in the token registry.`, 'TOKEN_NOT_FOUND');
  }

  const lowered = needle.toLowerCase();
  const byAddress = tokens.find((t) => t.address?.toLowerCase() === lowered);
  if (byAddress) return byAddress.id;

  const bySymbol = tokens.find((t) => t.symbol?.toLowerCase() === lowered);
  if (bySymbol) return bySymbol.id;

  throw new ResolutionError(
    `No exact match for ${needle}. Search returned ${tokens.length} similar token(s).`,
    'TOKEN_NOT_FOUND',
  );
}
