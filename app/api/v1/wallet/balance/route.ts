export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { env } from '@/lib/server/env';

/**
 * GET /api/v1/wallet/balance?address=<pubkey>&network=<mainnet|devnet>
 *
 * Fetches the live, real-time on-chain SOL balance for any Solana address.
 * Resilient multi-endpoint fallbacks: Helius -> QuickNode -> Public Solana RPC.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address')?.trim();
    const networkParam = searchParams.get('network')?.trim()?.toLowerCase();

    if (!address) {
      throw new ApiError('Wallet address is required', 400, 'INVALID_ADDRESS');
    }

    let pubkey: PublicKey;
    try {
      pubkey = new PublicKey(address);
    } catch {
      throw new ApiError('Invalid Solana base58 address', 400, 'INVALID_ADDRESS');
    }

    // Determine RPC endpoints with fallback order
    const rpcCandidates: string[] = [];

    if (networkParam === 'devnet') {
      rpcCandidates.push(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        'https://api.devnet.solana.com'
      );
    } else {
      // Default to mainnet RPC endpoints
      if (env.HELIUS_RPC_URL) rpcCandidates.push(env.HELIUS_RPC_URL);
      if (env.QUICKNODE_SOLANA_RPC_URL) rpcCandidates.push(env.QUICKNODE_SOLANA_RPC_URL);
      rpcCandidates.push(
        'https://api.mainnet-beta.solana.com',
        'https://solana-mainnet.rpc.extrnode.com'
      );
    }

    let lastError: Error | null = null;
    let lamports = 0;
    let resolvedRpc = '';

    for (const rpcUrl of rpcCandidates) {
      if (!rpcUrl) continue;
      try {
        const connection = new Connection(rpcUrl, {
          commitment: 'confirmed',
          confirmTransactionInitialTimeout: 10000,
        });
        lamports = await connection.getBalance(pubkey);
        resolvedRpc = rpcUrl;
        lastError = null;
        break;
      } catch (err: any) {
        lastError = err;
        // Continue to next fallback RPC candidate
      }
    }

    if (lastError && !resolvedRpc) {
      throw new ApiError(
        `Failed to query on-chain balance from Solana RPC: ${lastError.message}`,
        502,
        'RPC_UNAVAILABLE'
      );
    }

    const sol = lamports / 1e9;
    const isDevnet = resolvedRpc.includes('devnet') || networkParam === 'devnet';

    return jsonResponse({
      address: pubkey.toBase58(),
      lamports,
      sol,
      network: isDevnet ? 'devnet' : 'mainnet',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new ApiError('Failed to fetch wallet balance', 500)
    );
  }
}
