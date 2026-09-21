import { PublicKey } from '@solana/web3.js';
import { withApiGateway } from '@/lib/server/api-gateway';
import { jsonResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { serverStore } from '@/lib/server/store';
import { getTradeWalletPosition } from '@/lib/trading/wallet-position';
export const dynamic = 'force-dynamic';
export const GET = withApiGateway(async ({ user }, _request, params) => {
  let wallet: string, mint: string;
  try { wallet = new PublicKey(params.wallet).toBase58(); mint = new PublicKey(params.mint).toBase58(); }
  catch { throw new ApiError('Invalid wallet or mint address', 400); }
  // Solana addresses are case-sensitive. Never authorize merely by address length.
  const linked = await serverStore.getUserWallets(user.userId);
  if (user.primaryWalletAddress !== wallet && !linked.some(entry => entry.address === wallet && entry.status === 'active'))
    throw new ApiError('Wallet is not linked to this account.', 403, 'WALLET_NOT_AUTHORIZED');
  return jsonResponse({ position: await getTradeWalletPosition(wallet, mint) }, 200, { 'Cache-Control': 'private, no-store' });
}, { scopes: ['READ_PORTFOLIO'], allowSessionAuth: true });
