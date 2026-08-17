import { NormalizedRealtimeEvent, type EventLatencyMetrics, type RealtimeEventType } from './event-types';
import type { DecodedBlockchainEvent } from '../helius/decoder';

export class EventNormalizer {
  private static sequenceCounter = 0;

  /**
   * Generates a deterministic deduplication ID: `${signature}:${type}:${mint}`
   */
  public static createEventId(signature: string, type: string, mint?: string): string {
    return `${signature}:${type}:${mint || 'unknown'}`;
  }

  /**
   * Normalizes a decoded blockchain event into a NormalizedRealtimeEvent.
   */
  public static normalize(
    raw: DecodedBlockchainEvent,
    source: 'helius_laserstream' | 'helius_ws' | 'birdeye' | 'mock' = 'helius_laserstream',
    receivedTimestamp: number = Date.now()
  ): NormalizedRealtimeEvent {
    const parsedTimestamp = Date.now();
    const id = this.createEventId(raw.signature, raw.type, raw.mint);
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
      mint: raw.mint,
      name: raw.name,
      symbol: raw.symbol,
      wallet: raw.wallet,
      program: raw.programId,
      pool: raw.pool,
      dex: raw.dex,
      amount: raw.amount,
      amountSol: raw.amountSol,
      price: raw.price,
      priceUsd: raw.price,
      liquidityUsd: raw.liquidityUsd,
      source,
      commitment: 'processed',
      latency,
    };
  }

  public static getSequence(): number {
    return this.sequenceCounter;
  }
}
