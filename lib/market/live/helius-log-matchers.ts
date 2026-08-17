/**
 * Coarse, per-program log-pattern classification for Helius `logsSubscribe`
 * notifications.
 *
 * IMPORTANT LIMITATION: a `logsNotification` only carries `{signature, logs}`
 * — no parsed instruction data, no account list, no amounts. These matchers
 * can reliably classify *what kind* of instruction ran (swap vs. add/remove
 * liquidity) by looking for the human-readable "Program log: Instruction: X"
 * lines that Anchor-based programs emit, but they cannot reliably recover
 * *which mint* or *what amount* was involved from log text alone. Rather than
 * fabricate a mint/price, `mint`/`priceUsd`/`volumeUsd` are left `undefined`
 * when not confidently derivable — `normalizers.ts` drops any match with no
 * mint rather than emit a corrupted event.
 *
 * v2 fast-follow: call Helius's Enhanced Transactions API or `getTransaction`
 * on interesting signatures to get fully parsed swap details (mint, amounts,
 * counterparties) instead of pattern-matching raw logs.
 */

import type { LogMatchResult, LogMatcher } from './types';

function hasInstruction(logs: string[], ...names: string[]): boolean {
  const needles = names.map((name) => name.toLowerCase());
  return logs.some((line) => {
    const lower = line.toLowerCase();
    return needles.some((needle) => lower.includes(`instruction: ${needle}`));
  });
}

/**
 * Raydium AMM v4. Historically encodes instruction data in a base64 `ray_log`
 * line rather than a human-readable instruction name, but current mainnet
 * deployments also emit an Anchor-style "Instruction: X" line for common
 * instructions — matched here. Falls back to detecting bare `ray_log`
 * presence as a lower-confidence SWAP signal (Raydium's swap path is by far
 * the most common ray_log emitter), documented as approximate.
 */
export const matchRaydiumAmmV4Logs: LogMatcher = (logs) => {
  if (hasInstruction(logs, 'swap', 'swapbasein', 'swapbaseout')) {
    return { eventType: 'SWAP' };
  }
  if (hasInstruction(logs, 'deposit', 'addliquidity')) {
    return { eventType: 'LIQUIDITY_ADD' };
  }
  if (hasInstruction(logs, 'withdraw', 'removeliquidity')) {
    return { eventType: 'LIQUIDITY_REMOVE' };
  }

  const hasRayLog = logs.some((line) => line.toLowerCase().includes('ray_log'));
  if (hasRayLog) {
    return { eventType: 'SWAP' };
  }

  return null;
};

/** Orca Whirlpool — standard Anchor instruction logging. */
export const matchOrcaWhirlpoolLogs: LogMatcher = (logs) => {
  if (hasInstruction(logs, 'swap', 'twohopswap')) {
    return { eventType: 'SWAP' };
  }
  if (hasInstruction(logs, 'increaseliquidity', 'openposition')) {
    return { eventType: 'LIQUIDITY_ADD' };
  }
  if (hasInstruction(logs, 'decreaseliquidity', 'closeposition')) {
    return { eventType: 'LIQUIDITY_REMOVE' };
  }
  return null;
};

/**
 * Pump.fun bonding-curve trades. Buy/sell on the curve are Sentinel's SWAP
 * events; the bonding-curve model has no discrete add/remove-liquidity
 * instruction in the traditional AMM sense, so only SWAP is classified here.
 * (When a pump.fun token graduates to a Raydium pool, that migration shows up
 * as a separate Raydium-program transaction, matched by
 * `matchRaydiumAmmV4Logs` instead.)
 */
export const matchPumpFunLogs: LogMatcher = (logs) => {
  if (hasInstruction(logs, 'buy', 'sell')) {
    return { eventType: 'SWAP' };
  }
  return null;
};

/** Keyed by the same labels used in `subscription-set.ts`'s program ID map. */
export const PROGRAM_MATCHERS: Record<string, LogMatcher> = {
  raydium_amm_v4: matchRaydiumAmmV4Logs,
  orca_whirlpool: matchOrcaWhirlpoolLogs,
  pumpfun: matchPumpFunLogs,
};

export function matchLogsForProgram(programLabel: string, logs: string[]): LogMatchResult | null {
  const matcher = PROGRAM_MATCHERS[programLabel];
  if (!matcher) return null;
  return matcher(logs);
}
