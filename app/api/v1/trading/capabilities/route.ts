import { jsonResponse } from '@/lib/server/api';
import { checkTradingRpc } from '@/lib/trading/solana-rpc';
import { swapRepository } from '@/lib/trading/swap-repository';
import { killSwitch } from '@/lib/server/kill-switch';
export const dynamic = 'force-dynamic';
let last: { at: number; ready: boolean } | null = null;
export async function GET() {
  if (!last || Date.now() - last.at > 30_000) {
    let ready = false;
    try { await Promise.all([checkTradingRpc(), swapRepository.ready()]); ready = true; } catch { /* Public health never exposes endpoint URLs or credentials. */ }
    last = { at: Date.now(), ready };
  }
  const available = last.ready && !killSwitch.isPaused('TRADING');
  return jsonResponse({ available, network: 'solana:mainnet', provider: 'Solana RPC', walletApprovalRequired: true,
    automaticExecution: false, privateMevRelay: false,
    reason: available ? null : 'Swap execution is unavailable or paused. Check RPC access and migration 034.' }, 200, { 'Cache-Control': 'no-store' });
}
