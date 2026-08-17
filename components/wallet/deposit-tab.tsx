'use client';

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  ArrowDownToLine,
  Sparkles,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWalletState, useWalletActions, useNotificationsActions } from '@/lib/store';

export function DepositTab() {
  const { primaryWallet } = useWalletState();
  const { depositCrypto } = useWalletActions();
  const { addNotification } = useNotificationsActions();

  const [selectedNetwork, setSelectedNetwork] = useState<'solana' | 'base' | 'ethereum'>('solana');
  const [selectedAsset, setSelectedAsset] = useState<string>('SOL');
  const [copied, setCopied] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  const walletAddress = primaryWallet?.address || '7xK99zK8mP2xQ5wN3a19';
  const qrPayload = selectedNetwork === 'solana' ? `solana:${walletAddress}` : `ethereum:${walletAddress}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addNotification({
      title: 'Address Copied',
      message: 'Deposit address copied to clipboard.',
      type: 'system',
    });
  };

  const handleSimulateDeposit = async (amount: number, asset: string) => {
    setIsSimulating(true);
    try {
      const res = await depositCrypto({
        walletId: primaryWallet?.id || 'w_001',
        walletAddress,
        asset,
        amount,
        network: selectedNetwork,
        sourceAddress: 'Binance Hot Wallet (0x3a...binance)',
      });

      if (res.success) {
        addNotification({
          title: 'Deposit Received',
          message: `Successfully deposited ${amount} ${asset} into your ${primaryWallet?.label || 'primary wallet'}.`,
          type: 'execution',
        });
      } else {
        addNotification({
          title: 'Deposit Failed',
          message: res.error || 'Failed to simulate deposit.',
          type: 'risk',
        });
      }
    } finally {
      setIsSimulating(false);
    }
  };

  const explorerUrl =
    selectedNetwork === 'solana'
      ? `https://solscan.io/account/${walletAddress}`
      : selectedNetwork === 'base'
      ? `https://basescan.org/address/${walletAddress}`
      : `https://etherscan.io/address/${walletAddress}`;

  return (
    <div className="space-y-5">
      {/* Network & Asset Selection */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-2xs font-mono uppercase text-slate-400 block mb-1.5">
            Deposit Network
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
            <option value="solana">Solana (High Speed, Low Fee)</option>
            <option value="base">Base L2 (EVM)</option>
            <option value="ethereum">Ethereum Mainnet</option>
          </select>
        </div>

        <div>
          <label className="text-2xs font-mono uppercase text-slate-400 block mb-1.5">
            Deposit Asset
          </label>
          <select
            value={selectedAsset}
            onChange={(e) => setSelectedAsset(e.target.value)}
            className="w-full rounded-xl border border-sentinel-700 bg-sentinel-900 px-3 py-2 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
          >
            {selectedNetwork === 'solana' ? (
              <>
                <option value="SOL">SOL (Native)</option>
                <option value="USDC">USDC (SPL Token)</option>
              </>
            ) : selectedNetwork === 'base' ? (
              <>
                <option value="ETH">ETH (Base Native)</option>
                <option value="USDC">USDC (Base ERC20)</option>
              </>
            ) : (
              <>
                <option value="ETH">ETH (Ethereum Native)</option>
                <option value="USDC">USDC (ERC20)</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* QR Code & Address Display */}
      <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl border border-sentinel-800 bg-sentinel-950">
        <div className="p-2.5 bg-white rounded-xl shadow-md shrink-0">
          <QRCodeSVG value={qrPayload} size={130} level="M" />
        </div>

        <div className="space-y-3 flex-1 w-full text-center sm:text-left">
          <div>
            <span className="text-2xs font-mono text-slate-500 uppercase tracking-wider block">
              Your {selectedNetwork.toUpperCase()} Deposit Address
            </span>
            <p className="text-xs font-mono font-bold text-sky-300 break-all mt-0.5 select-all">
              {walletAddress}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
            <Button
              onClick={handleCopy}
              variant={copied ? 'secondary' : 'outline'}
              size="xs"
              leftIcon={copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            >
              {copied ? 'Copied' : 'Copy Address'}
            </Button>
            <Button
              onClick={() => window.open(explorerUrl, '_blank')}
              variant="ghost"
              size="xs"
              leftIcon={<ExternalLink className="h-3.5 w-3.5" />}
            >
              View on Explorer
            </Button>
          </div>
        </div>
      </div>

      {/* Network Safety Notice */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3.5 flex items-start gap-2.5 text-xs text-amber-200">
        <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-300">Important Network Notice</p>
          <p className="text-2xs text-amber-200/80 leading-relaxed">
            Send only <strong className="text-white">{selectedAsset}</strong> via{' '}
            <strong className="text-white">{selectedNetwork.toUpperCase()}</strong> network to this address. Minimum deposit is{' '}
            {selectedAsset === 'SOL' ? '0.01 SOL' : selectedAsset === 'USDC' ? '1.00 USDC' : '0.005 ETH'}.
          </p>
        </div>
      </div>

      {/* Interactive Simulation / Test Route */}
      <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sky-300 text-xs font-bold font-mono">
            <Sparkles className="h-3.5 w-3.5" /> Testnet / Interactive Deposit Simulator
          </div>
          <Badge variant="info" size="sm">Instant Credit</Badge>
        </div>
        <p className="text-2xs text-slate-300">
          Simulate an inbound deposit from an external exchange or funding wallet to test real-time portfolio balance updates.
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            onClick={() => handleSimulateDeposit(2.5, 'SOL')}
            disabled={isSimulating}
            variant="outline"
            size="xs"
            leftIcon={<ArrowDownToLine className="h-3 w-3 text-emerald-400" />}
          >
            +2.5 SOL
          </Button>
          <Button
            onClick={() => handleSimulateDeposit(10.0, 'SOL')}
            disabled={isSimulating}
            variant="outline"
            size="xs"
            leftIcon={<ArrowDownToLine className="h-3 w-3 text-emerald-400" />}
          >
            +10.0 SOL
          </Button>
          <Button
            onClick={() => handleSimulateDeposit(500.0, 'USDC')}
            disabled={isSimulating}
            variant="outline"
            size="xs"
            leftIcon={<ArrowDownToLine className="h-3 w-3 text-emerald-400" />}
          >
            +500 USDC
          </Button>
        </div>
      </div>
    </div>
  );
}
