import 'server-only';

import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount, TokenAccountNotFoundError } from '@solana/spl-token';
import { blockchainProvider } from '@/lib/blockchain/provider';
import { env } from '@/lib/server/env';

/**
 * Real Solana wallet balance lookup (SOL + USDC) for the deposit/withdraw
 * feature — devnet-first, see docs/security/threat-model.md's "Wallet
 * transfers" section.
 *
 * Deliberately a new, dedicated module rather than reusing
 * `lib/chain/solana.ts`'s `SolanaChainAdapter` — that class is shared with
 * `lib/chain/multi-chain.ts`'s generic multi-chain architecture demo, and
 * `lib/chain/__tests__/multi-chain.test.ts` asserts its `getBalance()`
 * returns a fixed mock value (`native === 1.5`) for an intentionally-fake
 * address (`'mock_sol_pubkey'`) — making that method real would break a
 * real, passing, unrelated test. This module has no such conflict.
 */

let connection: Connection | null = null;

function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(blockchainProvider.getRpcUrl(), 'confirmed');
  }
  return connection;
}

export interface WalletBalance {
  address: string;
  network: string;
  sol: number;
  usdc: number;
}

/**
 * Reads real SOL + USDC balances for a wallet address via Solana RPC.
 * Throws if `address` isn't a valid base58-encoded public key — callers
 * should treat that as a client error (400), not a 500.
 */
export async function getWalletBalance(address: string): Promise<WalletBalance> {
  const pubkey = new PublicKey(address);
  const conn = getConnection();

  const lamports = await conn.getBalance(pubkey);

  let usdc = 0;
  try {
    const usdcMint = new PublicKey(env.USDC_MINT_ADDRESS);
    const ata = await getAssociatedTokenAddress(usdcMint, pubkey);
    const account = await getAccount(conn, ata);
    usdc = Number(account.amount) / 1_000_000; // USDC has 6 decimals
  } catch (err) {
    // No associated token account yet is a valid zero-USDC-balance state
    // (e.g. a wallet that's never received USDC), not an error.
    if (!(err instanceof TokenAccountNotFoundError)) throw err;
  }

  return {
    address,
    network: blockchainProvider.getNetwork(),
    sol: lamports / 1_000_000_000, // 1 SOL = 1e9 lamports
    usdc,
  };
}
