'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TokenAccountNotFoundError,
} from '@solana/spl-token';
import { AlertTriangle, Loader2, CheckCircle2, ExternalLink, Wallet as WalletIcon } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useWalletBalance } from '@/lib/hooks/use-wallet-balance';
import { useSession } from '@/lib/hooks/use-auth-hooks';
import { isValidSolanaAddress, checkBalanceSufficiency, computeMaxSendable, SOL_FEE_HEADROOM } from '@/lib/wallet/validation';
import type { LinkedWallet } from '@/lib/wallet/types';

interface WalletSendModalProps {
  wallet: LinkedWallet;
  isOpen: boolean;
  onClose: () => void;
}

type Asset = 'SOL' | 'USDC';
type Stage = 'form' | 'review' | 'sending' | 'success' | 'error';

const USDC_MINT = process.env.NEXT_PUBLIC_USDC_MINT_ADDRESS || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

/**
 * Real, self-custodial send flow (devnet-first — see
 * docs/security/threat-model.md's "Wallet transfers" section). The
 * platform never signs or broadcasts anything here — `useWallet().sendTransaction`
 * does both, entirely inside the user's own connected wallet extension.
 */
export function WalletSendModal({ wallet, isOpen, onClose }: WalletSendModalProps) {
  const { publicKey, connected, connecting, wallets, select, connect, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { token } = useSession();
  const { balance } = useWalletBalance(wallet.id, isOpen);

  const [asset, setAsset] = useState<Asset>('SOL');
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [stage, setStage] = useState<Stage>('form');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [destinationValid, setDestinationValid] = useState<boolean | null>(null);
  const [destinationUnfunded, setDestinationUnfunded] = useState(false);
  const [pastDestinations, setPastDestinations] = useState<Set<string>>(new Set());
  const [feeEstimateSol, setFeeEstimateSol] = useState<number | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const isConnectedWallet = connected && publicKey?.toBase58() === wallet.address;
  const isDevnet = (balance?.network ?? '').includes('devnet');

  // Reset local state whenever the modal is (re)opened for a wallet.
  useEffect(() => {
    if (!isOpen) return;
    setAsset('SOL');
    setDestination('');
    setAmount('');
    setStage('form');
    setErrorMsg(null);
    setSignature(null);
  }, [isOpen, wallet.id]);

  // Load this user's own past send destinations once, for the "sent here before" check.
  useEffect(() => {
    if (!isOpen || !token) return;
    fetch(`/api/v1/user/wallets/transactions?walletId=${wallet.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((body) => {
        if (body.success) {
          setPastDestinations(new Set<string>(body.data.transactions.map((t: { destinationAddress: string }) => t.destinationAddress)));
        }
      })
      .catch(() => {
        // Non-fatal — the "sent here before" check is a soft warning, not a blocker.
      });
  }, [isOpen, token, wallet.id]);

  // Validate the destination address as the user types.
  useEffect(() => {
    if (!destination) {
      setDestinationValid(null);
      setDestinationUnfunded(false);
      return;
    }
    if (isValidSolanaAddress(destination)) {
      setDestinationValid(true);
      connection
        .getAccountInfo(new PublicKey(destination))
        .then((info) => setDestinationUnfunded(info === null))
        .catch(() => setDestinationUnfunded(false));
    } else {
      setDestinationValid(false);
      setDestinationUnfunded(false);
    }
  }, [destination, connection]);

  const balanceForAsset = asset === 'SOL' ? balance?.sol ?? 0 : balance?.usdc ?? 0;
  const maxAmount = computeMaxSendable(balanceForAsset, asset);
  const parsedAmount = parseFloat(amount);
  const sufficiency = Number.isNaN(parsedAmount) ? null : checkBalanceSufficiency(parsedAmount, balanceForAsset, asset);
  const insufficientBalance = sufficiency !== null && !sufficiency.sufficient;
  const neverSentHere = destinationValid === true && destination.length > 0 && !pastDestinations.has(destination);

  const canReview =
    isConnectedWallet &&
    destinationValid === true &&
    amount !== '' &&
    !Number.isNaN(parsedAmount) &&
    parsedAmount > 0 &&
    !insufficientBalance;

  const handleMax = () => setAmount(maxAmount.toFixed(asset === 'SOL' ? 6 : 2));

  const handleConnectClick = async (walletName: Parameters<typeof select>[0]) => {
    try {
      select(walletName);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to select wallet');
    }
  };

  // wallet-adapter's `select()` is state-based, not immediately awaitable —
  // connect once a wallet becomes selected but isn't connected yet.
  useEffect(() => {
    if (!connected && !connecting && wallets.some((w) => w.readyState === 'Installed')) {
      const selected = wallets.find((w) => w.adapter.connecting || w.adapter.connected);
      if (selected) {
        connect().catch((err) => setErrorMsg(err instanceof Error ? err.message : 'Failed to connect wallet'));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets]);

  const buildTransaction = useCallback(async (): Promise<Transaction> => {
    if (!publicKey) throw new Error('Wallet not connected.');
    const destPubkey = new PublicKey(destination);
    const tx = new Transaction();

    if (asset === 'SOL') {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: destPubkey,
          lamports: Math.round(parsedAmount * LAMPORTS_PER_SOL),
        }),
      );
    } else {
      const mint = new PublicKey(USDC_MINT);
      const sourceAta = await getAssociatedTokenAddress(mint, publicKey);
      const destAta = await getAssociatedTokenAddress(mint, destPubkey);

      try {
        await getAccount(connection, destAta);
      } catch (err) {
        if (err instanceof TokenAccountNotFoundError) {
          // First transfer to this address for this mint — create its ATA first.
          tx.add(createAssociatedTokenAccountInstruction(publicKey, destAta, destPubkey, mint));
        } else {
          throw err;
        }
      }

      tx.add(createTransferInstruction(sourceAta, destAta, publicKey, Math.round(parsedAmount * 1_000_000)));
    }

    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = publicKey;
    return tx;
  }, [publicKey, destination, asset, parsedAmount, connection]);

  const handleReview = async () => {
    setErrorMsg(null);
    try {
      const tx = await buildTransaction();
      const feeResult = await connection.getFeeForMessage(tx.compileMessage(), 'confirmed');
      setFeeEstimateSol((feeResult.value ?? 5000) / LAMPORTS_PER_SOL);
      setStage('review');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to prepare transaction.');
    }
  };

  const handleConfirmSend = async () => {
    setStage('sending');
    setErrorMsg(null);
    try {
      const tx = await buildTransaction();

      // Simulate before ever asking the extension for a real signature.
      const sim = await connection.simulateTransaction(tx);
      if (sim.value.err) {
        throw new Error(`Simulation failed: ${JSON.stringify(sim.value.err)}`);
      }

      const sig = await sendTransaction(tx, connection);
      const latest = await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        { signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
        'confirmed',
      );

      setSignature(sig);
      setStage('success');

      if (token) {
        fetch('/api/v1/user/wallets/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            walletId: wallet.id,
            direction: 'SEND',
            asset,
            amount: parsedAmount,
            destinationAddress: destination,
            signature: sig,
            network: balance?.network ?? 'solana:devnet',
            feeLamports: feeEstimateSol ? Math.round(feeEstimateSol * LAMPORTS_PER_SOL) : undefined,
          }),
        }).catch(() => {
          // The transfer itself already succeeded on-chain — a failure to
          // record local history is not something the user needs an error for.
        });
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Transaction failed.');
      setStage('error');
    }
  };

  if (!isConnectedWallet) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Send" subtitle={wallet.label} size="sm">
        <div className="space-y-4 text-center">
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-left">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-2xs text-amber-200 leading-relaxed">
              Connect this wallet in your browser extension to send from it — Sentinel can only sign a transfer through the wallet that's actively connected, never on your behalf.
            </p>
          </div>

          <div className="space-y-2">
            {wallets.length === 0 && (
              <p className="text-xs text-slate-500">No Solana wallet extension detected.</p>
            )}
            {wallets.map((w) => (
              <Button
                key={w.adapter.name}
                variant="outline"
                size="sm"
                className="w-full"
                leftIcon={<WalletIcon className="h-4 w-4" />}
                onClick={() => handleConnectClick(w.adapter.name)}
                disabled={connecting}
              >
                {connecting ? 'Connecting…' : `Connect ${w.adapter.name}`}
              </Button>
            ))}
          </div>

          {errorMsg && <p className="text-xs text-rose-400">{errorMsg}</p>}

          <Button variant="ghost" size="sm" onClick={onClose} className="w-full">
            Cancel
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Send" subtitle={wallet.label} size="sm">
      {stage === 'success' && signature ? (
        <div className="space-y-4 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
          <p className="text-sm font-bold text-slate-100">Transfer confirmed</p>
          <p className="text-xs text-slate-400 font-mono break-all">{signature}</p>
          <a
            href={`https://explorer.solana.com/tx/${signature}?cluster=${isDevnet ? 'devnet' : 'mainnet'}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
          >
            View on Solana Explorer <ExternalLink className="h-3 w-3" />
          </a>
          <Button variant="outline" size="sm" onClick={onClose} className="w-full">
            Done
          </Button>
        </div>
      ) : stage === 'review' ? (
        <div className="space-y-4">
          <div className="flex justify-center">
            <Badge variant={isDevnet ? 'warning' : 'danger'} className="font-mono">
              {balance?.network ?? 'devnet'}
            </Badge>
          </div>

          <div className="space-y-2 rounded-xl border border-sentinel-800 bg-sentinel-950 p-3 font-mono text-xs">
            <div className="flex justify-between"><span className="text-slate-500">Sending</span><span className="text-slate-100 font-bold">{amount} {asset}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">To</span><span className="text-slate-100 break-all text-right ml-4">{destination}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Network fee (est.)</span><span className="text-slate-300">{feeEstimateSol?.toFixed(6) ?? '…'} SOL</span></div>
          </div>

          {neverSentHere && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-left">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-2xs text-amber-200 leading-relaxed">You haven't sent to this address before — verify it carefully.</p>
            </div>
          )}
          {destinationUnfunded && (
            <p className="text-2xs text-slate-500">This address has no on-chain history yet — that's fine for a brand-new wallet, but double check it's correct.</p>
          )}

          {errorMsg && <p className="text-xs text-rose-400">{errorMsg}</p>}

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setStage('form')} className="flex-1">Back</Button>
            <Button variant="buy" size="sm" onClick={handleConfirmSend} className="flex-1">Approve in Wallet</Button>
          </div>
        </div>
      ) : stage === 'sending' ? (
        <div className="space-y-4 text-center py-6">
          <Loader2 className="h-8 w-8 text-sky-400 animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Waiting for wallet approval and on-chain confirmation…</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['SOL', 'USDC'] as const).map((a) => (
              <button
                key={a}
                onClick={() => { setAsset(a); setAmount(''); }}
                className={`flex-1 rounded-lg border py-2 text-xs font-bold transition ${
                  asset === a ? 'border-sky-500 bg-sky-500/20 text-sky-300' : 'border-sentinel-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {a}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <label className="text-2xs uppercase text-slate-500 font-mono">Destination Address</label>
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value.trim())}
              placeholder="Solana wallet address"
              isMonospace
            />
            {destinationValid === false && <p className="text-2xs text-rose-400">Not a valid Solana address.</p>}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-2xs uppercase text-slate-500 font-mono">Amount ({asset})</label>
              <button onClick={handleMax} className="text-2xs text-sky-400 hover:text-sky-300 font-mono">
                Max: {maxAmount.toFixed(asset === 'SOL' ? 4 : 2)}
              </button>
            </div>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="any" placeholder="0.00" isMonospace />
            {insufficientBalance && sufficiency && (
              <p className="text-2xs text-rose-400">
                Insufficient balance — short by {sufficiency.shortfall.toFixed(asset === 'SOL' ? 6 : 2)} {asset}.
              </p>
            )}
          </div>

          {errorMsg && <p className="text-xs text-rose-400">{errorMsg}</p>}

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="flex-1">Cancel</Button>
            <Button variant="buy" size="sm" onClick={handleReview} disabled={!canReview} className="flex-1">Review</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
