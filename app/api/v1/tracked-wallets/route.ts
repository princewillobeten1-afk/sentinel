export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { INITIAL_TRACKED_WALLETS, TrackedWallet } from '@/lib/wallet-tracker/types';

// In-memory backing store for tracked wallets per session/process
let serverTrackedWallets: TrackedWallet[] = [...INITIAL_TRACKED_WALLETS];

function isValidSolanaAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  // Base58 check & standard Solana address length (32 to 44 characters)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address.trim());
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let filtered = serverTrackedWallets;
    if (category && category !== 'ALL') {
      filtered = filtered.filter((w) => w.category === category);
    }

    return NextResponse.json({
      success: true,
      data: filtered,
      count: filtered.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch tracked wallets' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address, label, category = 'SMART_MONEY', notes, tags = [], minAlertTradeUsd = 100 } = body;

    if (!address || !isValidSolanaAddress(address)) {
      return NextResponse.json(
        { success: false, error: 'Invalid Solana wallet address. Please provide a valid Base58 public key.' },
        { status: 400 }
      );
    }

    const cleanAddress = address.trim();
    const existingIdx = serverTrackedWallets.findIndex(
      (w) => w.address.toLowerCase() === cleanAddress.toLowerCase()
    );

    const newRecord: TrackedWallet = {
      address: cleanAddress,
      label: label?.trim() || `Wallet ${cleanAddress.slice(0, 4)}...${cleanAddress.slice(-4)}`,
      category,
      notes: notes || '',
      solBalance: Math.round((20 + Math.random() * 250) * 10) / 10,
      winRate: Math.round((65 + Math.random() * 25) * 10) / 10,
      totalRealizedPnlUsd: Math.round(50000 + Math.random() * 450000),
      totalTradesCount: Math.round(50 + Math.random() * 300),
      tags: tags.length > 0 ? tags : [category],
      addedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      alertEnabled: true,
      minAlertTradeUsd,
    };

    if (existingIdx >= 0) {
      serverTrackedWallets[existingIdx] = { ...serverTrackedWallets[existingIdx], ...newRecord };
    } else {
      serverTrackedWallets.unshift(newRecord);
    }

    return NextResponse.json({
      success: true,
      data: newRecord,
      message: 'Wallet tracked successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to track wallet' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ success: false, error: 'Address query parameter is required' }, { status: 400 });
    }

    const initialLen = serverTrackedWallets.length;
    serverTrackedWallets = serverTrackedWallets.filter(
      (w) => w.address.toLowerCase() !== address.trim().toLowerCase()
    );

    return NextResponse.json({
      success: true,
      removed: initialLen > serverTrackedWallets.length,
      message: 'Wallet untracked successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to untrack wallet' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { address, updates } = body;

    if (!address) {
      return NextResponse.json({ success: false, error: 'Address is required' }, { status: 400 });
    }

    const idx = serverTrackedWallets.findIndex((w) => w.address.toLowerCase() === address.trim().toLowerCase());
    if (idx === -1) {
      return NextResponse.json({ success: false, error: 'Tracked wallet not found' }, { status: 404 });
    }

    serverTrackedWallets[idx] = {
      ...serverTrackedWallets[idx],
      ...updates,
    };

    return NextResponse.json({
      success: true,
      data: serverTrackedWallets[idx],
      message: 'Tracked wallet updated',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update wallet' },
      { status: 500 }
    );
  }
}
