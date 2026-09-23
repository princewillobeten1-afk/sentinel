'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { VersionedTransaction } from '@solana/web3.js';
import type { Quote } from '@/lib/quote/types';
import type { WalletAdapter } from '@/lib/wallet/types';
import type { TransactionExecutionState } from '@/lib/trading/types';

interface Receipt { preparedId: string; status: 'prepared' | 'pending' | 'confirmed' | 'failed' | 'expired'; txSignature: string | null; reason?: string | null }
async function request(url: string, body?: unknown) {
  const response = await fetch(url, { method: body ? 'POST' : 'GET', credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(45_000), cache: 'no-store' });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.error?.message || `Trading request failed (${response.status}).`);
  return result.data;
}
export function useSwapExecution(wallet: string | null, mint: string, adapter: WalletAdapter | null | undefined) {
  const [state, setState] = useState<TransactionExecutionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [preparedId, setPreparedId] = useState<string | null>(null);
  const [feeLamports, setFeeLamports] = useState<number | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);
  const key = wallet ? `sentinel.swap.pending.v1:${wallet}:${mint}` : null;
  const current = useRef({ wallet, mint }); current.current = { wallet, mint };
  const remember = useCallback((id: string | null) => {
    setPreparedId(id);
    try { if (key) { if (id) sessionStorage.setItem(key, id); else sessionStorage.removeItem(key); } } catch { /* Server record remains durable. */ }
  }, [key]);
  useEffect(() => {
    generation.current++; busy.current = false; setState('idle'); setError(null); setReceipt(null); setFeeLamports(null);
    let id: string | null = null;
    try { id = key ? sessionStorage.getItem(key) : null; } catch {}
    setPreparedId(id);
    if (id) setState('confirming');
    // A wallet or token change invalidates in-flight signing and submission.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { generation.current++; };
  }, [key]);
  const applyReceipt = useCallback((next: Receipt) => {
    setReceipt(next); setError(next.reason || null);
    if (next.status === 'confirmed') {
      setState('confirmed'); remember(null);
      window.dispatchEvent(new Event('sentinel:positions-updated'));
    } else if (next.status === 'failed' || next.status === 'expired') {
      setState(next.status); remember(null);
    } else if (next.status === 'prepared') {
      // Server has no send record: still do not submit automatically after a reload.
      setState('unknown'); setError('This reviewed swap was not submitted. Close this review and obtain a fresh quote.'); remember(null);
    } else setState('confirming');
  }, [remember]);
  const checkStatus = useCallback(async () => {
    if (!preparedId) return;
    const active = generation.current;
    try {
      const next = await request(`/api/v1/trading/status/${encodeURIComponent(preparedId)}`) as Receipt;
      if (active === generation.current) applyReceipt(next);
    } catch (cause) {
      if (active === generation.current) { setState('unknown'); setError(cause instanceof Error ? cause.message : 'Confirmation is unavailable. Do not place a replacement trade.'); }
    }
  }, [preparedId, applyReceipt]);
  useEffect(() => {
    if (!preparedId || busy.current) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => { await checkStatus(); if (!stopped) timer = setTimeout(poll, 3000); };
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [preparedId, checkStatus, state]);

  const execute = useCallback(async (quote: Quote, slippage: number) => {
    if (busy.current) return;
    if (preparedId) { await checkStatus(); return; }
    if (!wallet || !adapter?.signTransaction || adapter.type === 'manual') {
      setError('Connect a signing wallet and authenticate it before trading.'); setState('failed'); return;
    }
    const active = generation.current;
    busy.current = true; setError(null); setReceipt(null); setState('preparing');
    let submitted = false;
    let id: string | null = null;
    try {
      if (!quote.inputMint || !quote.outputMint || !quote.minimumReceivedRaw) throw new Error('Refresh this quote before trading.');
      if (Date.parse(quote.expiresAt) <= Date.now()) throw new Error('Quote expired. Refresh and review again.');
      const idempotencyKey = crypto.randomUUID();
      const data = await request('/api/v1/trading/prepare', { quoteId: quote.id, inputToken: quote.inputMint,
        outputToken: quote.outputMint, amount: quote.inputAmount, slippage, walletAddress: wallet,
        minimumOutputRaw: quote.minimumReceivedRaw, idempotencyKey });
      const prepared = data.preparedTransaction;
      if (active !== generation.current || current.current.wallet !== wallet || current.current.mint !== mint) return;
      if (!prepared || prepared.network !== 'solana:mainnet' || prepared.wallet !== wallet || prepared.status !== 'prepared')
        throw new Error('Prepared swap does not match this wallet or network.');
      if (Date.parse(prepared.expiresAt) <= Date.now()) throw new Error('Prepared swap expired. Refresh your quote.');
      id = prepared.id; setFeeLamports(prepared.feeLamports);
      const transaction = VersionedTransaction.deserialize(Uint8Array.from(atob(prepared.unsignedTxBase64), c => c.charCodeAt(0)));
      if (transaction.message.staticAccountKeys[0].toBase58() !== wallet) throw new Error('Prepared signer mismatch.');
      const original = transaction.message.serialize().toString();
      setState('awaitingWallet');
      const signed = await adapter.signTransaction(transaction);
      if (active !== generation.current || current.current.wallet !== wallet || current.current.mint !== mint) return;
      if (signed.message.serialize().toString() !== original) throw new Error('Wallet changed the prepared transaction. Nothing was sent.');
      let binary = ''; for (const byte of signed.serialize()) binary += String.fromCharCode(byte);
      // Save only the opaque recovery ID, never wallet keys or signed transaction bytes.
      remember(id); submitted = true; setState('submitting');
      const next = await request('/api/v1/trading/submit', { preparedId: id, signedTransaction: btoa(binary), idempotencyKey }) as Receipt;
      if (active === generation.current) applyReceipt(next);
    } catch (cause) {
      if (active !== generation.current) return;
      const message = cause instanceof Error ? cause.message : 'Trade request failed.';
      setError(submitted ? `${message} Check the saved trade status before placing another order.` : message);
      setState(submitted ? 'unknown' : /reject|denied/i.test(message) ? 'rejected' : /expire/i.test(message) ? 'expired' : 'failed');
    } finally { if (active === generation.current) busy.current = false; }
  }, [wallet, mint, adapter, preparedId, checkStatus, applyReceipt, remember]);
  return { state, error, receipt, feeLamports, execute, checkStatus, pending: !!preparedId,
    busy: ['preparing','awaitingWallet','signing','submitting','confirming'].includes(state) };
}
