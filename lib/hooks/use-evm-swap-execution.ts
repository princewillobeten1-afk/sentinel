'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ROBINHOOD_CHAIN_ID, ROBINHOOD_PERMIT2 } from '@/lib/chains/chain-config';
import {
  MAX_UINT160,
  MAX_UINT256,
  encodeErc20Approve,
  encodePermit2Approve,
} from '@/lib/chains/evm-abi';
import type { Quote } from '@/lib/quote/types';
import type { TransactionExecutionState } from '@/lib/trading/types';
import {
  getInjectedEvmProvider,
  parseEvmChainId,
} from '@/lib/wallet/evm-wallet-adapter';

interface EvmReceipt {
  preparedId: string;
  status: 'prepared' | 'pending' | 'confirmed' | 'failed' | 'expired';
  txSignature: string | null;
  reason?: string | null;
}

interface AllowanceResponse {
  erc20Allowance: string;
  permit2Amount: string;
  permit2Expiration: number;
}

interface ReceiptStatusResponse {
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  gasUsed?: string;
}

async function fetchJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
    cache: 'no-store',
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error?.message || `EVM request failed (${response.status}).`);
  }
  return result.data as T;
}

function isWalletRejection(err: unknown): boolean {
  const code = typeof err === 'object' && err !== null && 'code' in err ? (err as { code?: unknown }).code : undefined;
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return code === 4001 || /reject|denied|cancel/i.test(msg);
}

async function waitForEvmReceipt(
  txHash: string,
  shouldAbort: () => boolean,
  maxWaitMs = 90_000,
): Promise<'confirmed' | 'failed'> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    if (shouldAbort()) return 'confirmed';
    const status = await fetchJson<ReceiptStatusResponse>(
      `/api/v1/trading/evm-allowance?txHash=${encodeURIComponent(txHash)}`,
    );
    if (status.status === 'confirmed' || status.status === 'failed') {
      return status.status;
    }
    await new Promise((r) => setTimeout(r, 1_500));
  }
  throw new Error('Transaction is still confirming on Robinhood Chain. Check explorer for status.');
}

export function useEvmSwapExecution(
  wallet: string | null,
  tokenAddress: string,
  options?: {
    switchToRobinhoodChain?: () => Promise<boolean>;
    refreshEvmBalance?: () => Promise<unknown>;
  },
) {
  const [state, setState] = useState<TransactionExecutionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<EvmReceipt | null>(null);
  const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);
  const storageKey = wallet ? `sentinel.evmSwap.pending.v1:${wallet.toLowerCase()}:${tokenAddress.toLowerCase()}` : null;
  const current = useRef({ wallet, tokenAddress });
  current.current = { wallet, tokenAddress };

  const remember = useCallback(
    (hash: string | null) => {
      setPendingTxHash(hash);
      try {
        if (storageKey) {
          if (hash) sessionStorage.setItem(storageKey, hash);
          else sessionStorage.removeItem(storageKey);
        }
      } catch {
        // Non-fatal storage access error
      }
    },
    [storageKey],
  );

  useEffect(() => {
    const gen = generation;
    gen.current++;
    busy.current = false;
    setState('idle');
    setError(null);
    setReceipt(null);
    let savedHash: string | null = null;
    try {
      savedHash = storageKey ? sessionStorage.getItem(storageKey) : null;
    } catch {
      savedHash = null;
    }
    setPendingTxHash(savedHash);
    if (savedHash) {
      setReceipt({ preparedId: savedHash, status: 'pending', txSignature: savedHash });
      setState('confirming');
    }
    return () => {
      gen.current++;
    };
  }, [storageKey]);

  const checkStatus = useCallback(async () => {
    if (!pendingTxHash) return;
    const active = generation.current;
    try {
      const next = await fetchJson<ReceiptStatusResponse>(
        `/api/v1/trading/evm-allowance?txHash=${encodeURIComponent(pendingTxHash)}`,
      );
      if (active !== generation.current) return;
      if (next.status === 'confirmed') {
        setReceipt({ preparedId: pendingTxHash, status: 'confirmed', txSignature: pendingTxHash });
        setError(null);
        setState('confirmed');
        remember(null);
        window.dispatchEvent(new Event('sentinel:positions-updated'));
        void options?.refreshEvmBalance?.();
      } else if (next.status === 'failed') {
        setReceipt({
          preparedId: pendingTxHash,
          status: 'failed',
          txSignature: pendingTxHash,
          reason: 'Transaction reverted on Robinhood Chain.',
        });
        setError('Transaction reverted on Robinhood Chain.');
        setState('failed');
        remember(null);
      } else {
        setState('confirming');
      }
    } catch (cause) {
      if (active === generation.current) {
        setState('unknown');
        setError(cause instanceof Error ? cause.message : 'Unable to check EVM confirmation.');
      }
    }
  }, [pendingTxHash, remember, options]);

  useEffect(() => {
    if (!pendingTxHash || busy.current) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await checkStatus();
      if (!stopped) timer = setTimeout(poll, 2_500);
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [pendingTxHash, checkStatus]);

  const execute = useCallback(
    async (quote: Quote, _slippage: number) => {
      if (busy.current) return;
      if (pendingTxHash) {
        await checkStatus();
        return;
      }

      if (!wallet) {
        setError('Connect an EVM wallet before trading on Robinhood Chain.');
        setState('failed');
        return;
      }
      const provider = getInjectedEvmProvider();
      if (!provider) {
        setError('No EVM wallet provider detected.');
        setState('failed');
        return;
      }
      if (quote.chainId !== 'robinhood' || !quote.evmTx) {
        setError(quote.unavailableReason || 'Missing executable Robinhood Chain swap payload. Refresh quote.');
        setState('failed');
        return;
      }

      const active = generation.current;
      const shouldAbort = () =>
        active !== generation.current ||
        current.current.wallet?.toLowerCase() !== wallet.toLowerCase() ||
        current.current.tokenAddress.toLowerCase() !== tokenAddress.toLowerCase();

      busy.current = true;
      setError(null);
      setReceipt(null);
      setState('preparing');
      let swapSent = false;

      try {
        const rawChain = await provider.request({ method: 'eth_chainId' });
        let chainNum = parseEvmChainId(rawChain);
        if (chainNum !== ROBINHOOD_CHAIN_ID) {
          const switched = await options?.switchToRobinhoodChain?.();
          const recheck = await provider.request({ method: 'eth_chainId' });
          chainNum = parseEvmChainId(recheck);
          if (!switched && chainNum !== ROBINHOOD_CHAIN_ID) {
            throw new Error(`Switch your EVM wallet to Robinhood Chain (${ROBINHOOD_CHAIN_ID}) to execute.`);
          }
        }

        if (Date.parse(quote.expiresAt) <= Date.now()) {
          throw new Error('Quote expired. Refresh and review again.');
        }

        const approval = quote.evmTx.approval;
        if (approval) {
          const allowances = await fetchJson<AllowanceResponse>('/api/v1/trading/evm-allowance', {
            owner: wallet,
            tokenAddress: approval.tokenAddress,
            spender: approval.spender,
            checkPermit2: approval.kind === 'permit2',
          });
          if (shouldAbort()) return;

          const needed = BigInt(approval.amountRaw);
          const currentErc20 = BigInt(allowances.erc20Allowance || '0');
          const erc20Spender =
            approval.kind === 'permit2'
              ? approval.permit2Address || ROBINHOOD_PERMIT2
              : approval.spender;

          if (currentErc20 < needed) {
            setState('awaitingWallet');
            const approveHash = (await provider.request({
              method: 'eth_sendTransaction',
              params: [
                {
                  from: wallet,
                  to: approval.tokenAddress,
                  data: encodeErc20Approve(erc20Spender, MAX_UINT256),
                  value: '0x0',
                },
              ],
            })) as string;
            if (shouldAbort()) return;
            setState('confirming');
            const status = await waitForEvmReceipt(approveHash, shouldAbort);
            if (status === 'failed') {
              throw new Error('ERC-20 token approval transaction reverted.');
            }
          }

          if (approval.kind === 'permit2') {
            const p2Amount = BigInt(allowances.permit2Amount || '0');
            const nowSec = Math.floor(Date.now() / 1000);
            if (p2Amount < needed || allowances.permit2Expiration <= nowSec + 120) {
              if (shouldAbort()) return;
              setState('awaitingWallet');
              const p2Exp = BigInt(nowSec + 30 * 86_400);
              const p2Addr = approval.permit2Address || ROBINHOOD_PERMIT2;
              const p2Hash = (await provider.request({
                method: 'eth_sendTransaction',
                params: [
                  {
                    from: wallet,
                    to: p2Addr,
                    data: encodePermit2Approve(approval.tokenAddress, approval.spender, MAX_UINT160, p2Exp),
                    value: '0x0',
                  },
                ],
              })) as string;
              if (shouldAbort()) return;
              setState('confirming');
              const p2Status = await waitForEvmReceipt(p2Hash, shouldAbort);
              if (p2Status === 'failed') {
                throw new Error('Permit2 approval transaction reverted.');
              }
            }
          }
        }

        if (shouldAbort()) return;
        if (Date.parse(quote.expiresAt) <= Date.now()) {
          throw new Error('Quote expired during approval. Refresh your quote before swapping.');
        }

        setState('awaitingWallet');
        const txHash = (await provider.request({
          method: 'eth_sendTransaction',
          params: [
            {
              from: wallet,
              to: quote.evmTx.to,
              data: quote.evmTx.data,
              value: quote.evmTx.value,
            },
          ],
        })) as string;
        if (shouldAbort()) return;

        swapSent = true;
        remember(txHash);
        setReceipt({ preparedId: txHash, status: 'pending', txSignature: txHash });
        setState('confirming');

        const outcome = await waitForEvmReceipt(txHash, shouldAbort);
        if (shouldAbort()) return;

        if (outcome === 'failed') {
          setReceipt({
            preparedId: txHash,
            status: 'failed',
            txSignature: txHash,
            reason: 'Swap reverted on-chain (try higher slippage or smaller size).',
          });
          setError('Swap reverted on-chain.');
          setState('failed');
          remember(null);
        } else {
          setReceipt({ preparedId: txHash, status: 'confirmed', txSignature: txHash });
          setError(null);
          setState('confirmed');
          remember(null);
          window.dispatchEvent(new Event('sentinel:positions-updated'));
          void options?.refreshEvmBalance?.();
        }
      } catch (cause) {
        if (shouldAbort()) return;
        const message = cause instanceof Error ? cause.message : 'EVM swap request failed.';
        setError(swapSent ? `${message} Check the transaction link before retrying.` : message);
        setState(
          swapSent
            ? 'unknown'
            : isWalletRejection(cause)
              ? 'rejected'
              : /expire/i.test(message)
                ? 'expired'
                : 'failed',
        );
      } finally {
        if (active === generation.current) {
          busy.current = false;
        }
      }
    },
    [wallet, tokenAddress, pendingTxHash, checkStatus, remember, options],
  );

  return {
    state,
    error,
    receipt,
    feeLamports: null as number | null,
    execute,
    checkStatus,
    pending: !!pendingTxHash,
    busy: ['preparing', 'awaitingWallet', 'signing', 'submitting', 'confirming'].includes(state),
  };
}
