import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { resolveWalletId, resolveTokenId, ResolutionError } from '../resolve-ids';

/** Builds the `{ success, data }` envelope every /api/v1 route responds with. */
function ok(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fail(status: number, message = 'nope'): Response {
  return new Response(JSON.stringify({ success: false, error: { message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveWalletId', () => {
  const wallets = [
    { id: 'wal_1', address: 'SoLanaAddress111', isPrimary: true },
    { id: 'wal_2', address: '0xAbCdEf0123456789', isPrimary: false },
  ];

  it('finds the wallet row id for an address', async () => {
    fetchMock.mockResolvedValue(ok({ wallets }));
    expect(await resolveWalletId('SoLanaAddress111')).toBe('wal_1');
  });

  it('unwraps the response envelope', async () => {
    // Reading `body.wallets` instead of `body.data.wallets` yields undefined and
    // reports every wallet as unlinked.
    fetchMock.mockResolvedValue(ok({ wallets }));
    await expect(resolveWalletId('SoLanaAddress111')).resolves.toBe('wal_1');
  });

  it('matches an address case-insensitively', async () => {
    fetchMock.mockResolvedValue(ok({ wallets }));
    expect(await resolveWalletId('0xabcdef0123456789')).toBe('wal_2');
  });

  it('tolerates surrounding whitespace', async () => {
    fetchMock.mockResolvedValue(ok({ wallets }));
    expect(await resolveWalletId('  SoLanaAddress111  ')).toBe('wal_1');
  });

  it('reports an unlinked wallet distinctly', async () => {
    fetchMock.mockResolvedValue(ok({ wallets }));
    await expect(resolveWalletId('NotMine999')).rejects.toMatchObject({
      code: 'WALLET_NOT_FOUND',
    });
  });

  it('reports 401 as unauthenticated, not as a missing wallet', async () => {
    // These lead to different UI copy: "sign in" vs "connect this wallet".
    fetchMock.mockResolvedValue(fail(401));
    await expect(resolveWalletId('anything')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('does not match a wallet belonging to nobody in an empty list', async () => {
    fetchMock.mockResolvedValue(ok({ wallets: [] }));
    await expect(resolveWalletId('SoLanaAddress111')).rejects.toBeInstanceOf(ResolutionError);
  });
});

describe('resolveTokenId', () => {
  const solana = { id: 'tok_sol', address: 'So1111', symbol: 'SOL', chainId: 'chain_solana' };
  const ethereum = { id: 'tok_eth', address: '0xEeee', symbol: 'ETH', chainId: 'chain_ethereum' };

  it('resolves a symbol to a registry id', async () => {
    fetchMock.mockResolvedValue(ok({ data: [solana] }));
    expect(await resolveTokenId('SOL')).toBe('tok_sol');
  });

  it('accepts the chain id spelled with or without its prefix', async () => {
    // The registry stores `chain_solana`; callers naturally say 'solana'.
    // Sending 'solana' as a `chain=` filter matched nothing and reported a
    // token that plainly exists as unregistered.
    fetchMock.mockResolvedValue(ok({ data: [solana] }));
    expect(await resolveTokenId('SOL', 'solana')).toBe('tok_sol');

    fetchMock.mockResolvedValue(ok({ data: [solana] }));
    expect(await resolveTokenId('SOL', 'chain_solana')).toBe('tok_sol');
  });

  it('never sends a chain query param', async () => {
    fetchMock.mockResolvedValue(ok({ data: [solana] }));
    await resolveTokenId('SOL', 'solana');
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).not.toContain('chain=');
    expect(url).toContain('search=SOL');
  });

  it('excludes tokens from a different chain', async () => {
    fetchMock.mockResolvedValue(ok({ data: [ethereum] }));
    await expect(resolveTokenId('ETH', 'solana')).rejects.toMatchObject({
      code: 'TOKEN_NOT_FOUND',
    });
  });

  it('prefers an exact address match over a symbol match', async () => {
    const impostor = { id: 'tok_fake', address: 'So1111', symbol: 'NOTSOL', chainId: 'chain_solana' };
    fetchMock.mockResolvedValue(ok({ data: [solana, impostor] }));
    expect(await resolveTokenId('So1111')).toBe('tok_sol');
  });

  it('refuses to guess when no result matches exactly', async () => {
    // Symbols are not unique in a permissionless registry; taking the search
    // engine's top hit is how you buy the wrong asset.
    const similar = { id: 'tok_x', address: 'Xxxx', symbol: 'SOLANA', chainId: 'chain_solana' };
    fetchMock.mockResolvedValue(ok({ data: [similar] }));
    await expect(resolveTokenId('SOL')).rejects.toMatchObject({ code: 'TOKEN_NOT_FOUND' });
  });

  it('rejects an empty token without calling the API', async () => {
    await expect(resolveTokenId('   ')).rejects.toMatchObject({ code: 'TOKEN_NOT_FOUND' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports an empty registry result clearly', async () => {
    fetchMock.mockResolvedValue(ok({ data: [] }));
    await expect(resolveTokenId('GHOST')).rejects.toThrow(/not in the token registry/);
  });
});
