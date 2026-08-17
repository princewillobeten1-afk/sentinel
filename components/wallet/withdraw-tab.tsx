'use client';

import React, { useState, useMemo } from 'react';
import {
  ArrowUpFromLine,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Flame,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWalletState, useWalletActions, useNotificationsActions } from '@/lib/store';

export function WithdrawTab() {
  const { primaryWallet } = useWalletState();
  const { withdrawCrypto, setActiveWalletTab } = useWalletActions();
  const { addNotification } = useNotificationsActions();

  const [selectedNetwork, setSelectedNetwork] = useState<'solana' | 'base' | 'ethereum'>('solana');
  const [selectedAsset, setSelectedAsset] = useState<string>('SOL');
  const [destinationAddress, setDestinationAddress] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [priorityTier, setPriorityTier] = useState<'normal' | 'fast' | 'turbo'>('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const walletAddress = primaryWallet?.address || '7xK99zK8mP2xQ5wN3a19';
  const availableBalance = primaryWallet?.balanceSol || 42.85;

  // Address validation check
  const isAddressValid = useMemo(() => {
    if (!destinationAddress) return false;
    const clean = destinationAddress.trim();
    if (selectedNetwork === 'solana') {
      return /^[1-9A-HJ-NP-Za-km-z]{20,44}$/.test(clean);
    } else {
      return /^0x[a-fA-F0-9]{40}$/.test(clean);
    }
  }, [destinationAddress, selectedNetwork]);

  // Fee calculation
  const networkFee = useMemo(() => {
    if (selectedNetwork === 'solana') {
      if (priorityTier === 'turbo') return 0.00015;
      if (priorityTier === 'fast') return 0.00005;
      return 0.000005;
    } else if (selectedNetwork === 'base') {
      if (priorityTier === 'turbo') return 0.0001;
      if (priorityTier === 'fast') return 0.00005;
      return 0.00002;
    } else {
      if (priorityTier === 'turbo') return 0.004;
      if (priorityTier === 'fast') return 0.0025;
      return 0.0015;
    }
  }, [selectedNetwork, priorityTier]);

  const numAmount = parseFloat(amount) || 0;
  const isSelfTransfer = destinationAddress.trim().toLowerCase() === walletAddress.toLowerCase();
  const maxSpendable = Math.max(0, availableBalance - networkFee);

  const handlePercentage = (pct: number) => {
    const calculated = (maxSpendable * (pct / 100)).toFixed(4);
    setAmount(calculated);
    setErrorMsg(null);
  };

  const handleWithdraw = async () => {
    setErrorMsg(null);
    if (!destinationAddress.trim()) {
      setErrorMsg('Destination address is required.');
      return;
    }
    if (!isAddressValid) {
      setErrorMsg(`Invalid ${selectedNetwork.toUpperCase()} address format.`);
      return;
    }
    if (isSelfTransfer) {
      setErrorMsg('Destination address cannot be your own wallet address.');
      return;
    }
    if (numAmount <= 0) {
      setErrorMsg('Withdrawal amount must be greater than zero.');
      return;
    }
    if (numAmount + networkFee > availableBalance) {
      setErrorMsg(`Insufficient balance for withdrawal + network fee (${networkFee} ${selectedAsset}).`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await withdrawCrypto({
        walletId: primaryWallet?.id || 'w_001',
        walletAddress,
        destinationAddress: destinationAddress.trim(),
        asset: selectedAsset,
        amount: numAmount,
        network: selectedNetwork,
        priorityFeeTier: priorityTier,
      });

      if (res.success) {
        addNotification({
          title: 'Withdrawal Initiated',
          message: `Successfully transferred ${numAmount} ${selectedAsset} to ${destinationAddress.slice(0, 6)}...${destinationAddress.slice(-4)}.`,
          type: 'execution',
        });
        setAmount('');
        setDestinationAddress('');
        setActiveWalletTab('history');
      } else {
        setErrorMsg(res.error || 'Withdrawal failed.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {errorMsg && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-3 flex items-start gap-2 text-xs text-rose-300">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Network & Asset Selection */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-2xs font-mono uppercase text-slate-400 block mb-1.5">
            Network
          </label>
          <select
            value={selectedNetwork}
            onChange={(e) => {
              const net = e.target.value as any;
              setSelectedNetwork(net);
              if (net === 'solana') setSelectedAsset('SOL');
              else setSelectedAsset('ETH');
            }}
            className="w-full rounded-xl border border-sentinel-700 bg-sentinel-900 px-3 py-2 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
          >
            <option value="solana">Solana (High Speed)</option>
            <option value="base">Base L2</option>
            <option value="ethereum">Ethereum Mainnet</option>
          </select>
        </div>

        <div>
          <label className="text-2xs font-mono uppercase text-slate-400 block mb-1.5">
            Asset
          </label>
          <select
            value={selectedAsset}
            onChange={(e) => setSelectedAsset(e.target.value)}
            className="w-full rounded-xl border border-sentinel-700 bg-sentinel-900 px-3 py-2 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
          >
            {selectedNetwork === 'solana' ? (
              <>
                <option value="SOL">SOL</option>
                <option value="USDC">USDC</option>
              </>
            ) : (
              <>
                <option value="ETH">ETH</option>
                <option value="USDC">USDC</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* Destination Address Input */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-2xs font-mono uppercase text-slate-400">
            Recipient Destination Address
          </label>
          {destinationAddress && (
            <Badge variant={isAddressValid ? 'success' : 'danger'} size="sm">
              {isAddressValid ? 'Valid Address' : 'Invalid Format'}
            </Badge>
          )}
        </div>
        <input
          type="text"
          value={destinationAddress}
          onChange={(e) => {
            setDestinationAddress(e.target.value);
            setErrorMsg(null);
          }}
          placeholder={selectedNetwork === 'solana' ? 'Solana Base58 Address (e.g. 8wJ3...)' : '0x... EVM Address'}
          className="w-full rounded-xl border border-sentinel-700 bg-sentinel-900 px-3.5 py-2.5 text-xs font-mono text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
        />
      </div>

      {/* Amount Input with Percentage Quick Buttons */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-2xs font-mono uppercase text-slate-400">
            Withdrawal Amount
          </label>
          <span className="text-2xs text-slate-400">
            Available:{' '}
            <strong className="text-emerald-400 font-numeric font-bold">
              {availableBalance.toFixed(4)} {selectedAsset}
            </strong>
          </span>
        </div>

        <div className="relative">
          <input
            type="number"
            step="any"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setErrorMsg(null);
            }}
            placeholder="0.00"
            className="w-full rounded-xl border border-sentinel-700 bg-sentinel-900 px-3.5 py-2.5 text-sm font-numeric font-bold text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
          />
          <div className="absolute right-3 top-2.5 text-xs font-mono font-bold text-slate-400">
            {selectedAsset}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2">
          {[25, 50, 75, 100].map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => handlePercentage(pct)}
              className="flex-1 py-1 rounded-lg border border-sentinel-800 bg-sentinel-900/60 hover:border-sentinel-600 hover:bg-sentinel-800 text-2xs font-mono text-slate-300 transition"
            >
              {pct === 100 ? 'MAX' : `${pct}%`}
            </button>
          ))}
        </div>
      </div>

      {/* Priority Fee Tier */}
      <div>
        <label className="text-2xs font-mono uppercase text-slate-400 block mb-1.5">
          Execution Priority & Speed
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['normal', 'fast', 'turbo'] as const).map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => setPriorityTier(tier)}
              className={`p-2 rounded-xl border text-center transition ${
                priorityTier === tier
                  ? 'border-sky-500 bg-sky-950/40 text-white'
                  : 'border-sentinel-800 bg-sentinel-900/50 text-slate-400 hover:border-sentinel-700'
              }`}
            >
              <div className="flex items-center justify-center gap-1 text-xs font-bold capitalize">
                {tier === 'turbo' ? <Flame className="h-3 w-3 text-amber-400" /> : <Zap className="h-3 w-3 text-sky-400" />}
                {tier}
              </div>
              <p className="text-2xs font-mono text-slate-400 mt-0.5">
                {tier === 'normal' ? 'Standard' : tier === 'fast' ? '+Priority' : 'Turbo Boost'}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Summary Box */}
      <div className="rounded-xl border border-sentinel-800 bg-sentinel-950 p-3 space-y-1.5 text-xs font-mono">
        <div className="flex items-center justify-between text-slate-400">
          <span>Gross Withdrawal:</span>
          <span className="text-slate-200">{numAmount.toFixed(4)} {selectedAsset}</span>
        </div>
        <div className="flex items-center justify-between text-slate-400">
          <span>Estimated Network Fee:</span>
          <span className="text-amber-400 font-numeric">{networkFee.toFixed(6)} {selectedNetwork === 'solana' ? 'SOL' : 'ETH'}</span>
        </div>
        <div className="border-t border-sentinel-800 pt-1.5 flex items-center justify-between font-bold">
          <span className="text-slate-300">Net Outflow:</span>
          <span className="text-emerald-400 font-numeric text-sm">
            {(numAmount + (selectedAsset === (selectedNetwork === 'solana' ? 'SOL' : 'ETH') ? networkFee : 0)).toFixed(4)} {selectedAsset}
          </span>
        </div>
      </div>

      {/* Submit Button */}
      <Button
        onClick={handleWithdraw}
        disabled={isSubmitting || !isAddressValid || numAmount <= 0}
        variant="destructive"
        size="md"
        className="w-full"
        leftIcon={isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowUpFromLine className="h-4 w-4" />}
      >
        {isSubmitting ? 'Signing & Broadcasting...' : 'Confirm & Withdraw Funds'}
      </Button>
    </div>
  );
}
