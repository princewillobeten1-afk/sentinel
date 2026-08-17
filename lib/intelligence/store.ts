/**
 * Intelligence Store
 *
 * In-memory singleton (same pattern as ServerStore from Sprint 2).
 * Stores:
 * - Current reports (per token, cached)
 * - Historical snapshots (persistent)
 * - Timeline events
 * - Wallet relationships / clusters
 * - Creator observations
 * - Holder snapshots
 * - Contract observations
 *
 * Handles duplicate detection and cache invalidation.
 */

import type {
  TokenIntelligenceReport,
  IntelligenceSnapshot,
  IntelligenceTimelineEvent,
  WalletRelationship,
  WalletCluster,
  CreatorObservation,
  HolderSnapshot,
  ContractObservation,
} from './types';

const REPORT_CACHE_TTL_MS = 30_000; // 30 seconds for dynamic values
const MAX_SNAPSHOTS_PER_TOKEN = 100;
const MAX_TIMELINE_PER_TOKEN = 200;

interface CachedReport {
  report: TokenIntelligenceReport;
  cachedAt: number;
}

class IntelligenceStoreImpl {
  // ── Current Reports (cache) ──
  private reportCache: Map<string, CachedReport> = new Map();

  // ── Historical Snapshots ──
  private snapshots: Map<string, IntelligenceSnapshot[]> = new Map();

  // ── Timeline Events ──
  private timeline: Map<string, IntelligenceTimelineEvent[]> = new Map();

  // ── Wallet Data ──
  private walletRelationships: WalletRelationship[] = [];
  private walletClusters: WalletCluster[] = [];

  // ── Creator Observations ──
  private creatorObservations: Map<string, CreatorObservation> = new Map();

  // ── Holder Snapshots ──
  private holderSnapshots: Map<string, HolderSnapshot[]> = new Map();

  // ── Contract Observations ──
  private contractObservations: Map<string, ContractObservation> = new Map();

  // ── Processed Event IDs (deduplication) ──
  private processedEventIds: Set<string> = new Set();

  // ── Report Cache ──

  storeReport(tokenId: string, report: TokenIntelligenceReport): void {
    this.reportCache.set(tokenId, {
      report,
      cachedAt: Date.now(),
    });
  }

  getCurrentReport(tokenId: string): TokenIntelligenceReport | null {
    const cached = this.reportCache.get(tokenId);
    if (!cached) return null;

    // Check TTL
    if (Date.now() - cached.cachedAt > REPORT_CACHE_TTL_MS) {
      // Report is stale but still return it — caller decides whether to regenerate
      // The freshness is tracked in the report itself
    }

    return cached.report;
  }

  isCacheFresh(tokenId: string): boolean {
    const cached = this.reportCache.get(tokenId);
    if (!cached) return false;
    return Date.now() - cached.cachedAt <= REPORT_CACHE_TTL_MS;
  }

  invalidateReport(tokenId: string): void {
    this.reportCache.delete(tokenId);
  }

  getAllCachedTokenIds(): string[] {
    return Array.from(this.reportCache.keys());
  }

  // ── Snapshots ──

  addSnapshot(snapshot: IntelligenceSnapshot): void {
    const existing = this.snapshots.get(snapshot.tokenId) || [];
    existing.push(snapshot);

    // Trim to max
    if (existing.length > MAX_SNAPSHOTS_PER_TOKEN) {
      existing.splice(0, existing.length - MAX_SNAPSHOTS_PER_TOKEN);
    }

    this.snapshots.set(snapshot.tokenId, existing);
  }

  getSnapshots(tokenId: string, limit = 50): IntelligenceSnapshot[] {
    const all = this.snapshots.get(tokenId) || [];
    return all.slice(-limit);
  }

  // ── Timeline ──

  addTimelineEvent(tokenId: string, event: IntelligenceTimelineEvent): void {
    const existing = this.timeline.get(tokenId) || [];
    existing.push(event);

    if (existing.length > MAX_TIMELINE_PER_TOKEN) {
      existing.splice(0, existing.length - MAX_TIMELINE_PER_TOKEN);
    }

    this.timeline.set(tokenId, existing);
  }

  getTimeline(tokenId: string, limit = 50): IntelligenceTimelineEvent[] {
    const all = this.timeline.get(tokenId) || [];
    return all.slice(-limit).reverse(); // Most recent first
  }

  // ── Wallet Relationships ──

  addWalletRelationship(relationship: WalletRelationship): void {
    // Dedup by ID
    if (!this.walletRelationships.some(r => r.id === relationship.id)) {
      this.walletRelationships.push(relationship);
    }
  }

  getWalletRelationships(walletAddress: string): WalletRelationship[] {
    return this.walletRelationships.filter(
      r => r.walletA === walletAddress || r.walletB === walletAddress,
    );
  }

  addWalletCluster(cluster: WalletCluster): void {
    if (!this.walletClusters.some(c => c.id === cluster.id)) {
      this.walletClusters.push(cluster);
    }
  }

  getWalletClusters(): WalletCluster[] {
    return [...this.walletClusters];
  }

  // ── Creator Observations ──

  storeCreatorObservation(tokenId: string, obs: CreatorObservation): void {
    this.creatorObservations.set(tokenId, obs);
  }

  getCreatorObservation(tokenId: string): CreatorObservation | null {
    return this.creatorObservations.get(tokenId) || null;
  }

  // ── Holder Snapshots ──

  addHolderSnapshot(tokenId: string, snapshot: HolderSnapshot): void {
    const existing = this.holderSnapshots.get(tokenId) || [];
    existing.push(snapshot);
    if (existing.length > 50) existing.splice(0, existing.length - 50);
    this.holderSnapshots.set(tokenId, existing);
  }

  getLatestHolderSnapshot(tokenId: string): HolderSnapshot | null {
    const all = this.holderSnapshots.get(tokenId) || [];
    return all.length > 0 ? all[all.length - 1] : null;
  }

  getHolderHistory(tokenId: string): HolderSnapshot[] {
    return this.holderSnapshots.get(tokenId) || [];
  }

  // ── Contract Observations ──

  storeContractObservation(tokenId: string, obs: ContractObservation): void {
    this.contractObservations.set(tokenId, obs);
  }

  getContractObservation(tokenId: string): ContractObservation | null {
    return this.contractObservations.get(tokenId) || null;
  }

  // ── Event Deduplication ──

  isEventProcessed(eventId: string): boolean {
    return this.processedEventIds.has(eventId);
  }

  markEventProcessed(eventId: string): void {
    this.processedEventIds.add(eventId);
    if (this.processedEventIds.size > 10_000) {
      const items = Array.from(this.processedEventIds);
      this.processedEventIds = new Set(items.slice(5_000));
    }
  }

  // ── Metrics ──

  getStoreMetrics() {
    return {
      cachedReports: this.reportCache.size,
      snapshotTokens: this.snapshots.size,
      totalSnapshots: Array.from(this.snapshots.values()).reduce((sum, arr) => sum + arr.length, 0),
      timelineTokens: this.timeline.size,
      totalTimelineEvents: Array.from(this.timeline.values()).reduce((sum, arr) => sum + arr.length, 0),
      walletRelationships: this.walletRelationships.length,
      walletClusters: this.walletClusters.length,
      creatorObservations: this.creatorObservations.size,
      contractObservations: this.contractObservations.size,
      processedEvents: this.processedEventIds.size,
    };
  }
}

// Global instance — survives HMR in development
const globalForIntelligence = globalThis as unknown as { intelligenceStore?: IntelligenceStoreImpl };
export const intelligenceStore = globalForIntelligence.intelligenceStore ?? new IntelligenceStoreImpl();
if (process.env.NODE_ENV !== 'production') globalForIntelligence.intelligenceStore = intelligenceStore;
