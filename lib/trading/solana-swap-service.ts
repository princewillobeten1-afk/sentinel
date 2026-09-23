import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { ApiError } from '@/lib/server/errors';
import { serverStore } from '@/lib/server/store';
import { killSwitch } from '@/lib/server/kill-switch';
import { getSwapQuote, getSwapTransaction, SOL_MINT } from './jupiter-quote';
import { broadcastSignedTransaction, checkTradingRpc, tradingRpc } from './solana-rpc';
import { validatePreparedSwap, validateSignedSwap } from './signed-swap';
import { swapRepository, type PreparedSwap } from './swap-repository';

export interface PrepareSwapInput {
  quoteId: string; inputToken: string; outputToken: string; amount: string; slippage: number;
  walletAddress: string; minimumOutputRaw: string; idempotencyKey: string;
}
function assertEnabled() {
  if (killSwitch.isPaused('TRADING')) throw new ApiError('Trading is paused platform-wide.', 503, 'TRADING_PAUSED');
}
async function assertWallet(userId: string, wallet: string) {
  const wallets = await serverStore.getUserWallets(userId);
  if (!wallets.some(w => w.address === wallet && w.status === 'active' && w.network.startsWith('solana')))
    throw new ApiError('Connect and authenticate this Solana wallet before trading.', 403, 'WALLET_NOT_OWNED');
}
export async function prepareSolanaSwap(userId: string, input: PrepareSwapInput): Promise<PreparedSwap> {
  assertEnabled();
  await assertWallet(userId, input.walletAddress);
  const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const previous = await swapRepository.byRequest(userId, input.idempotencyKey);
  if (previous) {
    if (previous.fingerprint !== fingerprint) throw new ApiError('This request key belongs to a different trade.', 409, 'IDEMPOTENCY_CONFLICT');
    return previous;
  }
  // All currently supported manual swaps are SOL-funded buys or token-to-SOL sells.
  if (input.inputToken !== SOL_MINT && input.outputToken !== SOL_MINT)
    throw new ApiError('This swap path supports SOL/token pairs only.', 400, 'UNSUPPORTED_PAIR');
  await checkTradingRpc();
  const quote = await getSwapQuote({ inputMint: input.inputToken, outputMint: input.outputToken,
    amount: input.amount, slippageBps: Math.round(input.slippage * 100) });
  if (quote.priceImpactPct === null || quote.priceImpactPct > 5)
    throw new ApiError('Price impact is unavailable or exceeds the 5% execution limit.', 422, 'PRICE_IMPACT_LIMIT');
  if (BigInt(quote.providerQuote.otherAmountThreshold) < BigInt(input.minimumOutputRaw))
    throw new ApiError('The refreshed minimum output is lower than the reviewed quote. Refresh and review again.', 409, 'REQUOTE_REQUIRED');
  const prepared = await getSwapTransaction({ quoteResponse: quote.providerQuote, userPublicKey: input.walletAddress });
  if (prepared.prioritizationFeeLamports == null || !Number.isSafeInteger(prepared.prioritizationFeeLamports)
    || prepared.prioritizationFeeLamports < 0 || prepared.prioritizationFeeLamports > 50_000)
    throw new ApiError('The provider did not confirm a priority fee within the 0.00005 SOL limit.', 422, 'PRIORITY_FEE_LIMIT');
  validatePreparedSwap(prepared.swapTransaction, input.walletAddress);
  const [simulation, fee] = await Promise.all([
    tradingRpc<{ value: { err: unknown; unitsConsumed?: number } }>('simulateTransaction', [prepared.swapTransaction,
      { encoding: 'base64', commitment: 'confirmed', sigVerify: false, replaceRecentBlockhash: false }]),
    tradingRpc<{ value: number | null }>('getFeeForMessage', [Buffer.from(validatePreparedSwap(prepared.swapTransaction, input.walletAddress).message.serialize()).toString('base64'), { commitment: 'confirmed' }]),
  ]);
  if (!simulation?.value || simulation.value.err !== null)
    throw new ApiError('Swap preflight failed. Check funds, account setup, liquidity and slippage. Nothing was signed or broadcast.', 422, 'SIMULATION_FAILED');
  if (!Number.isSafeInteger(fee?.value) || (fee.value as number) < 0)
    throw new ApiError('The provider could not estimate the transaction fee. Refresh the quote.', 503, 'FEE_UNAVAILABLE');
  return swapRepository.create({ id: randomUUID(), user_id: userId, request_key: input.idempotencyKey, fingerprint,
    wallet: input.walletAddress, network: 'solana:mainnet', unsigned_tx: prepared.swapTransaction,
    last_valid_block_height: prepared.lastValidBlockHeight, expires_at: new Date(Date.now() + 60_000).toISOString(),
    quote, fee_lamports: fee.value, status: 'prepared', signature: null, reason: null });
}

export function swapReceipt(swap: PreparedSwap) {
  return { preparedId: swap.id, status: swap.status, txSignature: swap.signature, network: swap.network,
    explorerUrl: swap.signature ? `https://solscan.io/tx/${swap.signature}` : null, reason: swap.reason,
    inputAmount: swap.quote.inputAmount, outputAmountEstimate: swap.quote.outputAmount, minimumReceived: swap.quote.minimumReceived };
}
async function ownedSwap(userId: string, id: string) {
  const swap = await swapRepository.find(userId, id);
  if (!swap) throw new ApiError('Prepared swap not found for this account.', 404, 'PREPARED_SWAP_NOT_FOUND');
  return swap;
}
/** Read-only status recovery: no broadcasting and no generated confirmation. */
export async function getSolanaSwapStatus(userId: string, id: string): Promise<PreparedSwap> {
  const swap = await ownedSwap(userId, id);
  if (!swap.signature || ['confirmed', 'failed'].includes(swap.status)) return swap;
  try {
    const result = await tradingRpc<{ value: Array<{ err: unknown; confirmationStatus?: string } | null> }>(
      'getSignatureStatuses', [[swap.signature], { searchTransactionHistory: true }]);
    if (!Array.isArray(result?.value) || result.value.length !== 1) throw new Error('Invalid status');
    const status = result.value[0];
    if (status?.err) { swap.status = 'failed'; swap.reason = 'The network reported that this transaction failed.'; }
    else if (status && ['confirmed', 'finalized'].includes(status.confirmationStatus ?? '')) { swap.status = 'confirmed'; swap.reason = null; }
    else if (!status) {
      const height = await tradingRpc<number>('getBlockHeight', [{ commitment: 'confirmed' }]);
      if (Number.isSafeInteger(height) && height > swap.last_valid_block_height) {
        swap.status = 'expired'; swap.reason = 'The transaction blockhash expired without a recorded confirmation. Check the signature before placing another trade.';
      }
    }
    await swapRepository.update(userId, id, swap.status, swap.reason);
    return (await swapRepository.find(userId, id)) ?? swap;
  } catch {
    return { ...swap, reason: 'Confirmation is temporarily unavailable. Track this signature; do not place a replacement trade yet.' };
  }
}

export async function submitSolanaSwap(userId: string, input: { preparedId: string; signedTransaction: string; idempotencyKey: string }) {
  assertEnabled();
  let swap = await ownedSwap(userId, input.preparedId);
  await assertWallet(userId, swap.wallet);
  if (input.idempotencyKey !== swap.request_key) throw new ApiError('Submission key does not match the prepared trade.', 409, 'IDEMPOTENCY_CONFLICT');
  const signature = validateSignedSwap(input.signedTransaction, swap.unsigned_tx, swap.wallet);
  if (swap.signature && swap.signature !== signature) throw new ApiError('This trade already has a different signature.', 409, 'SUBMISSION_CONFLICT');
  if (swap.signature) {
    swap = await getSolanaSwapStatus(userId, swap.id);
    if (['confirmed', 'failed', 'expired'].includes(swap.status)) return swap;
  } else if (Date.parse(swap.expires_at) <= Date.now()) {
    throw new ApiError('Prepared swap expired before submission. Refresh and review a new quote.', 409, 'PREPARED_SWAP_EXPIRED');
  }
  const height = await tradingRpc<number>('getBlockHeight', [{ commitment: 'confirmed' }]);
  if (!Number.isSafeInteger(height)) throw new ApiError('Provider block height is unavailable.', 503, 'RPC_UNAVAILABLE');
  if (height > swap.last_valid_block_height) throw new ApiError('Transaction blockhash expired. Check its status before retrying.', 409, 'BLOCKHASH_EXPIRED');
  swap = await swapRepository.claim(userId, swap.id, signature);
  // No persistence => no broadcast. Above must commit before entering this block.
  try {
    const sent = await broadcastSignedTransaction(input.signedTransaction, signature);
    swap.reason = sent.reason ?? null;
    await swapRepository.update(userId, swap.id, 'pending', swap.reason);
  } catch (error) {
    // Only chain status can finalize failure: a concurrent/retried request may already have landed.
    swap.reason = 'Submission outcome is uncertain. Track the saved signature; do not create another trade.';
  }
  return getSolanaSwapStatus(userId, swap.id);
}
