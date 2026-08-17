export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { WalletSystemEngine } from '@/lib/wallet/engine';
import { TransactionRequest } from '@/lib/wallet/system-types';

export async function POST(request: Request) {
  try {
    const payload: TransactionRequest = await request.json();
    
    if (!payload.walletId || !payload.amountUsd) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const engine = new WalletSystemEngine();
    const wallets = engine.getConnectedWallets();
    
    const wallet = wallets.find(w => w.id === payload.walletId);
    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const simulation = await engine.simulateTransaction(wallet, payload);

    return NextResponse.json(simulation);
  } catch (err) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
