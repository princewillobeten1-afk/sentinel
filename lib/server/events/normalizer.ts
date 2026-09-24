import { NormalizedRealtimeEvent, type EventLatencyMetrics, type RealtimeEventType } from './event-types';
import type { DecodedBlockchainEvent } from '../helius/decoder';
import { chainEventId } from '@/lib/market/event-identity';

export class EventNormalizer {
  private static sequenceCounter = 0;

  /**
   * Generates a provider-independent ID at the most precise observed granularity.
   */
  public static createEventId(signature: string, type: string, mint?: string,
    instructionIndex?: number, innerInstructionIndex?: number): string {
    return chainEventId({ signature, mint: mint || 'unknown', kind: type,
      instructionIndex, innerInstructionIndex }) ?? `${signature}:${type}:${mint || 'unknown'}`;
  }

  /**
   * Normalizes a decoded blockchain event into a NormalizedRealtimeEvent.
   */
  public static normalize(
    raw: DecodedBlockchainEvent,
    source: 'helius_laserstream' | 'helius_ws' | 'quicknode' | 'birdeye' | 'mock' = 'helius_laserstream',
    receivedTimestamp: number = Date.now(),
    commitment: 'processed' | 'confirmed' | 'finalized' | undefined = source === 'helius_laserstream' ? 'processed' : undefined,
  ): NormalizedRealtimeEvent {
    const parsedTimestamp = Date.now();
    const id = this.createEventId(raw.signature, raw.type, raw.mint,
      raw.instructionIndex, raw.innerInstructionIndex);
    this.sequenceCounter += 1;

    const latency: EventLatencyMetrics = {
      chainTimestamp: raw.chainTimestamp,
      receivedTimestamp,
      parsedTimestamp,
      totalDetectionLatencyMs: raw.chainTimestamp ? parsedTimestamp - raw.chainTimestamp : undefined,
    };

    return {
      id,
      sequence: this.sequenceCounter,
      type: raw.type,
      timestamp: parsedTimestamp,
      slot: raw.slot,
      signature: raw.signature,
      instructionIndex: raw.instructionIndex,
      innerInstructionIndex: raw.innerInstructionIndex,
      mint: raw.mint,
      name: raw.name,
      symbol: raw.symbol,
      wallet: raw.wallet,
      program: raw.programId,
      pool: raw.pool,
      dex: raw.dex,
      amount: raw.amount,
      amountSol: raw.amountSol,
      amountUsd: raw.amountUsd,
      price: raw.price,
      priceUsd: raw.price,
      liquidityUsd: raw.liquidityUsd,
      source,
      commitment,
      latency,
    };
  }

  public static getSequence(): number {
    return this.sequenceCounter;
  }
}
