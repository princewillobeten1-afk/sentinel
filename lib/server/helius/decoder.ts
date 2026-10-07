import { PROTOCOL_PROGRAMS, identifyProtocol } from './protocols';
import { EVENT_TYPES, type RealtimeEventType } from '../events/event-types';

export interface DecodedBlockchainEvent {
  type: RealtimeEventType;
  signature: string;
  slot?: number;
  instructionIndex?: number;
  innerInstructionIndex?: number;
  programId?: string;
  mint?: string;
  name?: string;
  symbol?: string;
  wallet?: string;
  pool?: string;
  dex?: string;
  amount?: number;
  amountSol?: number;
  amountUsd?: number;
  fromWallet?: string;
  toWallet?: string;
  tokenAmount?: number;
  price?: number;
  liquidityUsd?: number;
  marketCapUsd?: number;
  chainTimestamp?: number;
}

export class BlockchainDecoder {
  /**
   * Decodes Helius LaserStream / Yellowstone raw transaction or log message.
   */
  public static decodeTransaction(tx: any): DecodedBlockchainEvent[] {
    const events: DecodedBlockchainEvent[] = [];
    if (!tx) return events;

    const signature = tx.signature || tx.transaction?.signatures?.[0];
    if (typeof signature !== 'string' || !signature) return events;
    const slot = Number.isSafeInteger(tx.slot) && tx.slot >= 0 ? tx.slot as number : undefined;
    const chainTimestamp = Number.isFinite(tx.blockTime) && tx.blockTime > 0
      ? Number(tx.blockTime) * 1000 : undefined;

    // Check account keys and log messages
    const logs: string[] = tx.meta?.logMessages || tx.logs || [];
    const accountKeys: string[] = tx.transaction?.message?.accountKeys || tx.accounts || [];

    // 1. Pump.fun detection
    if (accountKeys.includes(PROTOCOL_PROGRAMS.pumpfun.programId) || logs.some((l) => l.includes(PROTOCOL_PROGRAMS.pumpfun.programId))) {
      const pumpEvents = this.decodePumpFunLogs(logs, signature, slot, accountKeys, chainTimestamp);
      events.push(...pumpEvents);
    }

    // 2. Raydium detection
    const isRaydium = accountKeys.some((k) =>
      [PROTOCOL_PROGRAMS.raydiumAmmV4.programId, PROTOCOL_PROGRAMS.raydiumCpmm.programId, PROTOCOL_PROGRAMS.raydiumClmm.programId].includes(k)
    ) || logs.some((l) => l.includes('ray_log') || l.includes('Raydium'));

    if (isRaydium) {
      const raydiumEvents = this.decodeRaydiumLogs(logs, signature, slot, accountKeys, chainTimestamp);
      events.push(...raydiumEvents);
    }

    // 3. Meteora detection
    const isMeteora = accountKeys.some((k) =>
      [PROTOCOL_PROGRAMS.meteoraDlmm.programId, PROTOCOL_PROGRAMS.meteoraDynamicAmm.programId].includes(k)
    ) || logs.some((l) => l.includes('LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo') || l.includes('Meteora'));

    if (isMeteora) {
      const meteoraEvents = this.decodeMeteoraLogs(logs, signature, slot, accountKeys, chainTimestamp);
      events.push(...meteoraEvents);
    }

    events.push(...this.decodeTokenTransfers(tx, signature, slot, chainTimestamp));
    return events;
  }

  /**
   * Identifies SPL-token movements from explicit transfer instructions and
   * owner-level token balance changes. No transfer is inferred from balance
   * deltas alone, since swaps also change token balances.
   */
  private static decodeTokenTransfers(
    tx: any,
    signature: string,
    slot: number | undefined,
    chainTimestamp: number | undefined,
  ): DecodedBlockchainEvent[] {
    const logs: string[] = tx.meta?.logMessages || tx.logs || [];
    if (!logs.some((line) => /Instruction: Transfer(?:Checked)?$/.test(line.trim()))) return [];

    type TokenBalance = {
      mint?: string;
      owner?: string;
      uiTokenAmount?: { uiAmount?: number | null; amount?: string; decimals?: number };
    };
    const pre = (tx.meta?.preTokenBalances ?? []) as TokenBalance[];
    const post = (tx.meta?.postTokenBalances ?? []) as TokenBalance[];
    const balance = (entry: TokenBalance): number | null => {
      const uiAmount = entry.uiTokenAmount?.uiAmount;
      if (typeof uiAmount === 'number' && Number.isFinite(uiAmount)) return uiAmount;
      const rawAmount = Number(entry.uiTokenAmount?.amount);
      const decimals = entry.uiTokenAmount?.decimals;
      if (!Number.isFinite(rawAmount) || !Number.isInteger(decimals) || decimals! < 0) return null;
      return rawAmount / 10 ** decimals!;
    };

    const totals = new Map<string, Map<string, number>>();
    const addBalances = (entries: TokenBalance[], sign: 1 | -1) => {
      for (const entry of entries) {
        if (!entry.mint || !entry.owner) continue;
        const amount = balance(entry);
        if (amount === null) continue;
        const owners = totals.get(entry.mint) ?? new Map<string, number>();
        owners.set(entry.owner, (owners.get(entry.owner) ?? 0) + amount * sign);
        totals.set(entry.mint, owners);
      }
    };
    addBalances(pre, -1);
    addBalances(post, 1);

    const transfers: DecodedBlockchainEvent[] = [];
    let instructionIndex = 0;
    for (const [mint, owners] of totals) {
      const senders = [...owners].filter(([, delta]) => delta < 0).map(([wallet, delta]) => ({ wallet, amount: -delta }));
      const recipients = [...owners].filter(([, delta]) => delta > 0).map(([wallet, delta]) => ({ wallet, amount: delta }));
      for (const sender of senders) {
        for (const recipient of recipients) {
          if (sender.amount <= 0 || recipient.amount <= 0) continue;
          const amount = Math.min(sender.amount, recipient.amount);
          transfers.push({
            type: EVENT_TYPES.TRANSFER,
            signature,
            slot,
            instructionIndex: instructionIndex++,
            mint,
            wallet: sender.wallet,
            fromWallet: sender.wallet,
            toWallet: recipient.wallet,
            tokenAmount: amount,
            amount,
            chainTimestamp,
          });
          sender.amount -= amount;
          recipient.amount -= amount;
        }
      }
    }
    return transfers;
  }

  /**
   * Decodes Pump.fun program logs
   */
  private static decodePumpFunLogs(
    logs: string[],
    signature: string,
    slot: number | undefined,
    accounts: string[],
    chainTimestamp: number | undefined
  ): DecodedBlockchainEvent[] {
    const events: DecodedBlockchainEvent[] = [];
    const mint = accounts[1] || accounts[2];
    const wallet = accounts[0];

    for (const log of logs) {
      if (log.includes('Instruction: Create')) {
        events.push({
          type: EVENT_TYPES.TOKEN_CREATED,
          signature,
          slot,
          programId: PROTOCOL_PROGRAMS.pumpfun.programId,
          mint,
          wallet,
          dex: 'pump.fun',
          chainTimestamp,
        });
      } else if (log.includes('Instruction: Buy')) {
        events.push({
          type: EVENT_TYPES.BUY,
          signature,
          slot,
          programId: PROTOCOL_PROGRAMS.pumpfun.programId,
          mint,
          wallet,
          dex: 'pump.fun',
          chainTimestamp,
        });
      } else if (log.includes('Instruction: Sell')) {
        events.push({
          type: EVENT_TYPES.SELL,
          signature,
          slot,
          programId: PROTOCOL_PROGRAMS.pumpfun.programId,
          mint,
          wallet,
          dex: 'pump.fun',
          chainTimestamp,
        });
      } else if (log.includes('Instruction: Migrate') || log.includes('Instruction: Complete')) {
        events.push({
          type: EVENT_TYPES.MIGRATION,
          signature,
          slot,
          programId: PROTOCOL_PROGRAMS.pumpfun.programId,
          mint,
          wallet,
          dex: 'raydium',
          chainTimestamp,
        });
      }
    }

    return events;
  }

  /**
   * Decodes Raydium program logs
   */
  private static decodeRaydiumLogs(
    logs: string[],
    signature: string,
    slot: number | undefined,
    accounts: string[],
    chainTimestamp: number | undefined
  ): DecodedBlockchainEvent[] {
    const events: DecodedBlockchainEvent[] = [];
    const mint = accounts.find((a) => a !== PROTOCOL_PROGRAMS.raydiumAmmV4.programId && a.length >= 32);
    const wallet = accounts[0];

    for (const log of logs) {
      if (log.includes('initialize2') || log.includes('init_pc_amount')) {
        events.push({
          type: EVENT_TYPES.POOL_CREATED,
          signature,
          slot,
          programId: PROTOCOL_PROGRAMS.raydiumAmmV4.programId,
          mint,
          wallet,
          pool: accounts[4],
          dex: 'raydium',
          chainTimestamp,
        });
      } else if (log.includes('swapBaseIn') || log.includes('swapBaseOut') || log.includes('ray_log')) {
        events.push({
          type: EVENT_TYPES.BUY,
          signature,
          slot,
          programId: PROTOCOL_PROGRAMS.raydiumAmmV4.programId,
          mint,
          wallet,
          dex: 'raydium',
          chainTimestamp,
        });
      } else if (log.includes('deposit') || log.includes('add_liquidity')) {
        events.push({
          type: EVENT_TYPES.LIQUIDITY_ADDED,
          signature,
          slot,
          programId: PROTOCOL_PROGRAMS.raydiumAmmV4.programId,
          mint,
          wallet,
          dex: 'raydium',
          chainTimestamp,
        });
      }
    }

    return events;
  }

  /**
   * Decodes Meteora program logs
   */
  private static decodeMeteoraLogs(
    logs: string[],
    signature: string,
    slot: number | undefined,
    accounts: string[],
    chainTimestamp: number | undefined
  ): DecodedBlockchainEvent[] {
    const events: DecodedBlockchainEvent[] = [];
    const mint = accounts.find((a) => a !== PROTOCOL_PROGRAMS.meteoraDlmm.programId && a.length >= 32);
    const wallet = accounts[0];

    for (const log of logs) {
      if (log.includes('initializeLbPair') || log.includes('initializeCustomizablePermissionlessLbPair')) {
        events.push({
          type: EVENT_TYPES.POOL_CREATED,
          signature,
          slot,
          programId: PROTOCOL_PROGRAMS.meteoraDlmm.programId,
          mint,
          wallet,
          pool: accounts[2] || accounts[1],
          dex: 'meteora',
          chainTimestamp,
        });
      } else if (log.includes('swap') || log.includes('swapExactAmountIn')) {
        events.push({
          type: EVENT_TYPES.BUY,
          signature,
          slot,
          programId: PROTOCOL_PROGRAMS.meteoraDlmm.programId,
          mint,
          wallet,
          dex: 'meteora',
          chainTimestamp,
        });
      } else if (log.includes('addLiquidity') || log.includes('addLiquidityOneSide')) {
        events.push({
          type: EVENT_TYPES.LIQUIDITY_ADDED,
          signature,
          slot,
          programId: PROTOCOL_PROGRAMS.meteoraDlmm.programId,
          mint,
          wallet,
          dex: 'meteora',
          chainTimestamp,
        });
      }
    }

    return events;
  }
}
