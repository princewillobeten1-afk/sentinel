/**
 * Intelligence Processing Pipeline
 *
 * Pipeline architecture:
 *   Data Collection → Feature Extraction → Signal Engines
 *   → Risk Rules → Score Aggregator → Confidence Engine
 *   → Report Generator → Cache / Store
 *
 * Handles:
 * - Incremental computation (only affected tokens recalculated)
 * - Background processing (not inside synchronous HTTP requests)
 * - Event-driven updates
 * - Duplicate event detection
 * - Cache invalidation
 */

import { logger } from '@/lib/server/logger';
import type { TokenIntelligenceReport, IntelligenceSnapshot, IntelligenceTimelineEvent, RiskCategory } from './types';
import { generateReport, type ReportInput } from './report-generator';
import { intelligenceStore } from './store';

type IntelligenceUpdateListener = (tokenId: string, report: TokenIntelligenceReport) => void;

/**
 * Intelligence Processing Pipeline
 *
 * Singleton — manages the lifecycle of intelligence computations.
 */
export class IntelligencePipeline {
  private static instance: IntelligencePipeline;
  private listeners: IntelligenceUpdateListener[] = [];
  private processedEventIds: Set<string> = new Set();
  private processingQueue: Map<string, NodeJS.Timeout> = new Map();
  private readonly DEBOUNCE_MS = 1000;

  private constructor() {}

  public static getInstance(): IntelligencePipeline {
    if (!IntelligencePipeline.instance) {
      IntelligencePipeline.instance = new IntelligencePipeline();
    }
    return IntelligencePipeline.instance;
  }

  /**
   * Process an intelligence update for a specific token.
   * Debounced to avoid recomputing on every micro-event.
   */
  public scheduleUpdate(tokenId: string, input: ReportInput, eventId?: string): void {
    // Duplicate event detection
    if (eventId) {
      if (this.processedEventIds.has(eventId)) {
        logger.debug(`[INTELLIGENCE_PIPELINE] Duplicate event skipped: ${eventId}`);
        return;
      }
      this.processedEventIds.add(eventId);
      this.cleanupProcessedEvents();
    }

    // Debounce: cancel pending processing for this token
    const pending = this.processingQueue.get(tokenId);
    if (pending) {
      clearTimeout(pending);
    }

    // Schedule processing
    const timer = setTimeout(() => {
      this.processToken(tokenId, input);
      this.processingQueue.delete(tokenId);
    }, this.DEBOUNCE_MS);

    this.processingQueue.set(tokenId, timer);
    logger.info(`[INTELLIGENCE_PIPELINE] Update scheduled for ${tokenId}`);
  }

  /**
   * Immediately process a token — used for on-demand report generation.
   */
  public processImmediate(tokenId: string, input: ReportInput): TokenIntelligenceReport {
    return this.processToken(tokenId, input);
  }

  /**
   * Subscribe to intelligence update events.
   */
  public onUpdate(listener: IntelligenceUpdateListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Get pipeline observability metrics.
   */
  public getMetrics() {
    return {
      pendingUpdates: this.processingQueue.size,
      processedEvents: this.processedEventIds.size,
      activeListeners: this.listeners.length,
    };
  }

  // ── Internal ──

  private processToken(tokenId: string, input: ReportInput): TokenIntelligenceReport {
    const startTime = Date.now();

    try {
      // Fetch existing report to detect changes
      const previousReport = intelligenceStore.getCurrentReport(tokenId);

      // Generate new report
      const report = generateReport(input);

      // Store current report (cache)
      intelligenceStore.storeReport(tokenId, report);

      // Create snapshot for history
      const snapshot = this.createSnapshot(tokenId, report);
      intelligenceStore.addSnapshot(snapshot);

      // Detect and record timeline events
      if (previousReport) {
        const events = this.detectChanges(tokenId, previousReport, report);
        for (const event of events) {
          intelligenceStore.addTimelineEvent(tokenId, event);
        }
        // Merge recent timeline events into report
        report.recentTimeline = intelligenceStore.getTimeline(tokenId, 20);
      }

      // Notify listeners
      for (const listener of this.listeners) {
        try {
          listener(tokenId, report);
        } catch (err) {
          logger.error(`[INTELLIGENCE_PIPELINE] Listener error`, { error: String(err) });
        }
      }

      const elapsed = Date.now() - startTime;
      logger.info(`[INTELLIGENCE_PIPELINE] Processed ${tokenId} in ${elapsed}ms (score: ${report.overallScore})`);

      return report;
    } catch (err) {
      logger.error(`[INTELLIGENCE_PIPELINE] Failed to process ${tokenId}`, { error: String(err) });
      throw err;
    }
  }

  private createSnapshot(tokenId: string, report: TokenIntelligenceReport): IntelligenceSnapshot {
    const riskScores: Record<string, number> = {};
    for (const [cat, dim] of Object.entries(report.riskDimensions)) {
      if (dim) riskScores[cat] = dim.score;
    }

    return {
      id: `snap_${tokenId}_${Date.now()}`,
      tokenId,
      overallScore: report.overallScore,
      riskLevel: report.riskLevel,
      confidence: report.confidence.score,
      riskScores: riskScores as Record<RiskCategory, number>,
      signalCount: report.signals.length,
      warningCount: report.warnings.length,
      positiveCount: report.positives.length,
      methodologyVersion: report.methodologyVersion,
      snapshotAt: report.generatedAt,
    };
  }

  private detectChanges(
    tokenId: string,
    previous: TokenIntelligenceReport,
    current: TokenIntelligenceReport,
  ): IntelligenceTimelineEvent[] {
    const events: IntelligenceTimelineEvent[] = [];
    const now = new Date().toISOString();

    // Score change
    const scoreDelta = current.overallScore - previous.overallScore;
    if (Math.abs(scoreDelta) >= 5) {
      events.push({
        id: `evt_score_${Date.now()}`,
        timestamp: now,
        category: 'GENERAL',
        severity: Math.abs(scoreDelta) >= 15 ? 'HIGH' : 'MEDIUM',
        title: `Intelligence score ${scoreDelta > 0 ? 'increased' : 'decreased'}`,
        description: `Score changed from ${previous.overallScore} to ${current.overallScore} (${scoreDelta > 0 ? '+' : ''}${scoreDelta})`,
        evidence: [{
          fact: `Previous score: ${previous.overallScore}, Current score: ${current.overallScore}`,
          source: 'intelligence_pipeline',
          observedAt: now,
          confidence: 0.99,
        }],
      });
    }

    // Risk level change
    if (current.riskLevel !== previous.riskLevel) {
      events.push({
        id: `evt_risk_${Date.now()}`,
        timestamp: now,
        category: 'GENERAL',
        severity: 'HIGH',
        title: 'Risk level changed',
        description: `Risk level changed from ${previous.riskLevel} to ${current.riskLevel}`,
        evidence: [{
          fact: `Previous: ${previous.riskLevel}, Current: ${current.riskLevel}`,
          source: 'intelligence_pipeline',
          observedAt: now,
          confidence: 0.99,
        }],
      });
    }

    // Dimension-level changes
    const categories: RiskCategory[] = ['MARKET', 'LIQUIDITY', 'OWNERSHIP', 'CREATOR', 'ACTIVITY', 'CONTRACT', 'EXIT'];
    for (const cat of categories) {
      const prevDim = previous.riskDimensions[cat];
      const currDim = current.riskDimensions[cat];
      if (prevDim && currDim) {
        const dimDelta = currDim.score - prevDim.score;
        if (Math.abs(dimDelta) >= 10) {
          events.push({
            id: `evt_dim_${cat.toLowerCase()}_${Date.now()}`,
            timestamp: now,
            category: cat,
            severity: Math.abs(dimDelta) >= 20 ? 'HIGH' : 'MEDIUM',
            title: `${cat} dimension ${dimDelta > 0 ? 'improved' : 'deteriorated'}`,
            description: `${cat} score changed from ${prevDim.score} to ${currDim.score}`,
            evidence: [{
              fact: `${cat} score: ${prevDim.score} → ${currDim.score}`,
              source: 'intelligence_pipeline',
              observedAt: now,
              confidence: 0.98,
            }],
          });
        }
      }
    }

    return events;
  }

  private cleanupProcessedEvents(): void {
    if (this.processedEventIds.size > 5000) {
      const items = Array.from(this.processedEventIds);
      this.processedEventIds = new Set(items.slice(2500));
    }
  }
}

export const intelligencePipeline = IntelligencePipeline.getInstance();
