import { PROTOCOL_PROGRAMS, identifyProtocol } from './protocols';
import { EVENT_TYPES, type RealtimeEventType } from '../events/event-types';

export interface DecodedBlockchainEvent {
  type: RealtimeEventType;
  signature: string;
  slot: number;
  programId: string;
  mint?: string;
  name?: string;
  symbol?: string;
  wallet?: string;
  pool?: string;
  dex?: string;
  amount?: number;
  amountSol?: number;
  amountUsd?: number;
  price?: number;
  liquidityUsd?: number;
  chainTimestamp?: number;
}

export class BlockchainDecoder {
  /**
   * Decodes Helius LaserStream / Yellowstone raw transaction or log message.
   */
  public static decodeTransaction(tx: any): DecodedBlockchainEvent[] {
    const events: DecodedBlockchainEvent[] = [];
    if (!tx) return events;

    const signature = tx.signature || tx.transaction?.signatures?.[0] || `tx_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const slot = Number(tx.slot) || 0;
    const chainTimestamp = tx.blockTime ? Number(tx.blockTime) * 1000 : Date.now();

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

    return events;
  }

  /**
   * Decodes Pump.fun program logs
   */
  private static decodePumpFunLogs(
    logs: string[],
    signature: string,
    slot: number,
    accounts: string[],
    chainTimestamp: number
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
    slot: number,
    accounts: string[],
    chainTimestamp: number
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
    slot: number,
    accounts: string[],
    chainTimestamp: number
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
