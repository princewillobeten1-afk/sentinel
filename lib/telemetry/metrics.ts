import { logger } from '@/lib/server/logger';

export interface PipelineLatencyMeasurement {
  eventId: string;
  mint: string;
  eventToSignalMs: number;
  signalToScoreMs: number;
  scoreToRankingMs: number;
  rankingToClientMs: number;
  totalPipelineMs: number;
  timestamp: string;
}

export interface MetricSummary {
  discoveryQueryLatencyMs: number;
  rankingLatencyMs: number;
  signalProcessingLatencyMs: number;
  eventProcessingFailures: number;
  providerDelays: number;
  staleDataEvents: number;
  rankingRecalculationFailures: number;
  discoveryApiErrors: number;
}

class TelemetryCollector {
  private static instance: TelemetryCollector;
  private metrics: MetricSummary = {
    discoveryQueryLatencyMs: 0,
    rankingLatencyMs: 0,
    signalProcessingLatencyMs: 0,
    eventProcessingFailures: 0,
    providerDelays: 0,
    staleDataEvents: 0,
    rankingRecalculationFailures: 0,
    discoveryApiErrors: 0,
  };

  private measurements: PipelineLatencyMeasurement[] = [];

  private constructor() {}

  public static getInstance(): TelemetryCollector {
    if (!TelemetryCollector.instance) {
      TelemetryCollector.instance = new TelemetryCollector();
    }
    return TelemetryCollector.instance;
  }

  /**
   * Record end-to-end pipeline latency: event → signal → score → ranking → client.
   */
  public recordPipelineLatency(measurement: Omit<PipelineLatencyMeasurement, 'totalPipelineMs' | 'timestamp'>): void {
    const totalPipelineMs =
      measurement.eventToSignalMs +
      measurement.signalToScoreMs +
      measurement.scoreToRankingMs +
      measurement.rankingToClientMs;

    const fullMeasurement: PipelineLatencyMeasurement = {
      ...measurement,
      totalPipelineMs,
      timestamp: new Date().toISOString(),
    };

    this.measurements.push(fullMeasurement);
    if (this.measurements.length > 500) {
      this.measurements.shift();
    }

    logger.info(`[TELEMETRY] Pipeline latency: ${totalPipelineMs}ms for ${measurement.mint}`, {
      eventToSignalMs: measurement.eventToSignalMs,
      signalToScoreMs: measurement.signalToScoreMs,
      scoreToRankingMs: measurement.scoreToRankingMs,
      rankingToClientMs: measurement.rankingToClientMs,
    });
  }

  public recordQueryLatency(latencyMs: number): void {
    this.metrics.discoveryQueryLatencyMs = latencyMs;
    logger.debug(`[TELEMETRY] Query latency: ${latencyMs}ms`);
  }

  public recordRankingLatency(latencyMs: number): void {
    this.metrics.rankingLatencyMs = latencyMs;
  }

  public recordSignalLatency(latencyMs: number): void {
    this.metrics.signalProcessingLatencyMs = latencyMs;
  }

  public incrementEventFailures(): void {
    this.metrics.eventProcessingFailures++;
    logger.warn('[TELEMETRY] Event processing failure incremented');
  }

  public incrementProviderDelay(): void {
    this.metrics.providerDelays++;
  }

  public incrementStaleData(): void {
    this.metrics.staleDataEvents++;
  }

  public incrementApiError(): void {
    this.metrics.discoveryApiErrors++;
  }

  public getSummary(): MetricSummary {
    return { ...this.metrics };
  }

  public getRecentMeasurements(): PipelineLatencyMeasurement[] {
    return [...this.measurements.slice(-20)];
  }
}

export const telemetry = TelemetryCollector.getInstance();
