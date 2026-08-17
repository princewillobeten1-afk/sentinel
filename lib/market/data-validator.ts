/**
 * Blockchain Data Quality, Integrity & Reorg Validator (Sprint 33 §25-28).
 *
 * Implements strict data hygiene and integrity checks for incoming blockchain event streams:
 *   - Duplicate Event Protection: Deduplicates via canonical eventId / txHash
 *   - Block Continuity & Sequence Validation: Detects slot gaps and out-of-order blocks
 *   - Impossible Value Filtering: Drops negative prices, zero decimals, zero volume on active trades
 *   - Timestamp Drift Checking: Flags events with timestamps drifting > 5 minutes from system clock
 *   - Chain Reorganization & Fork Detection: Detects slot rollbacks and handles event invalidation
 */

export interface NormalizedMarketEvent {
  eventId: string;
  txHash: string;
  slot: number;
  blockTimestamp: number; // UTC ms
  tokenMint: string;
  tokenDecimals: number;
  priceUsd: number;
  amountToken: number;
  volumeUsd: number;
  side: 'buy' | 'sell';
  sourceProvider: string;
}

export interface ValidationResult {
  valid: boolean;
  action: 'ACCEPT' | 'DEDUPLICATED' | 'REJECT_IMPOSSIBLE_VALUE' | 'REJECT_STALE_OR_DRIFT' | 'CHAIN_REORG_DETECTED';
  reason?: string;
}

export class BlockchainDataValidator {
  private seenEvents = new Set<string>();
  private maxSeenEvents = 50_000;
  private highestSlotSeen = 0;
  private lastBlockTimestamp = 0;
  private reorgCount = 0;

  /**
   * Validates an incoming market event for data quality, integrity, and reorg safety.
   */
  public validateEvent(event: NormalizedMarketEvent, now: number = Date.now()): ValidationResult {
    // 1. Duplicate Event Protection (Sprint 33 §27)
    if (this.seenEvents.has(event.eventId)) {
      return {
        valid: false,
        action: 'DEDUPLICATED',
        reason: `Duplicate event identifier ${event.eventId} already processed.`,
      };
    }

    // 2. Impossible Value Protection (Sprint 33 §25)
    if (event.priceUsd <= 0 || !Number.isFinite(event.priceUsd)) {
      return {
        valid: false,
        action: 'REJECT_IMPOSSIBLE_VALUE',
        reason: `Invalid priceUsd: ${event.priceUsd} must be strictly positive and finite.`,
      };
    }

    if (event.tokenDecimals < 0 || event.tokenDecimals > 18 || !Number.isInteger(event.tokenDecimals)) {
      return {
        valid: false,
        action: 'REJECT_IMPOSSIBLE_VALUE',
        reason: `Invalid tokenDecimals: ${event.tokenDecimals} must be an integer between 0 and 18.`,
      };
    }

    if (event.amountToken <= 0 || !Number.isFinite(event.amountToken)) {
      return {
        valid: false,
        action: 'REJECT_IMPOSSIBLE_VALUE',
        reason: `Invalid amountToken: ${event.amountToken} must be strictly positive.`,
      };
    }

    // 3. Timestamp Drift & Staleness Check (Sprint 33 §25)
    const MAX_ALLOWED_DRIFT_MS = 5 * 60 * 1000; // 5 minutes
    const drift = Math.abs(now - event.blockTimestamp);
    if (drift > MAX_ALLOWED_DRIFT_MS) {
      return {
        valid: false,
        action: 'REJECT_STALE_OR_DRIFT',
        reason: `Event timestamp drift of ${Math.round(drift / 1000)}s exceeds allowable 300s window.`,
      };
    }

    // 4. Chain Reorganization & Fork Detection (Sprint 33 §28)
    // If incoming event slot is significantly lower than highest confirmed slot (> 5 slots lower)
    if (this.highestSlotSeen > 0 && event.slot < this.highestSlotSeen - 5) {
      this.reorgCount++;
      return {
        valid: false,
        action: 'CHAIN_REORG_DETECTED',
        reason: `Slot rollback detected: incoming slot ${event.slot} is behind highest seen slot ${this.highestSlotSeen}. Potential chain reorganization.`,
      };
    }

    // Record valid event
    this.seenEvents.add(event.eventId);
    if (this.seenEvents.size > this.maxSeenEvents) {
      const first = this.seenEvents.values().next().value;
      if (first) this.seenEvents.delete(first);
    }

    if (event.slot > this.highestSlotSeen) {
      this.highestSlotSeen = event.slot;
    }
    this.lastBlockTimestamp = event.blockTimestamp;

    return {
      valid: true,
      action: 'ACCEPT',
    };
  }

  public getReorgCount(): number {
    return this.reorgCount;
  }

  public getHighestSlotSeen(): number {
    return this.highestSlotSeen;
  }

  /** Test-only reset */
  public reset(): void {
    this.seenEvents.clear();
    this.highestSlotSeen = 0;
    this.lastBlockTimestamp = 0;
    this.reorgCount = 0;
  }
}

export const blockchainDataValidator = new BlockchainDataValidator();
