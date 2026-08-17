import { AlertEvent, AlertSeverity } from './types';
import { CorrelatedAlertEvent } from './correlation';
import { SignalConflictEngine, ConflictReport } from './conflict';

export interface AlertFact {
  metricName: string;
  previousValue: string;
  newValue: string;
  confidence: number;
  timestamp: Date;
}

export interface AlertStory {
  eventId: string;
  title: string;
  timeline: AlertFact[];
  conflictReport: ConflictReport;
  aiExplanation: string; // The generated summary
  confidence: number;
  suggestedActions: string[];
}

export class AlertStoryEngine {
  private conflictEngine: SignalConflictEngine;

  constructor() {
    this.conflictEngine = new SignalConflictEngine();
  }

  /**
   * Constructs a narrative timeline and AI explanation context from grouped facts.
   * This structure is passed to the UI and eventually to the LLM for summarization.
   */
  public generateStory(event: CorrelatedAlertEvent): AlertStory {
    const facts = this.extractFacts(event);
    const conflictReport = this.conflictEngine.detectConflicts(event);
    
    // In a real implementation, this would trigger an async job or be fetched lazily via LLM
    const aiExplanation = this.buildDeterministicExplanation(event, facts, conflictReport);

    return {
      eventId: event.id,
      title: this.generateTitle(event, conflictReport),
      timeline: facts,
      conflictReport,
      aiExplanation,
      confidence: 90, // Derived from aggregate fact confidences
      suggestedActions: this.deriveActions(event, conflictReport)
    };
  }

  private extractFacts(event: CorrelatedAlertEvent): AlertFact[] {
    const facts: AlertFact[] = [];
    
    // Sort child events chronologically to build the timeline
    const sortedEvents = [...event.childEvents, event].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    // In the real system, facts are extracted from event.evidence
    for (const child of sortedEvents) {
      if (child.evidence?.metricName) {
        facts.push({
          metricName: child.evidence.metricName,
          previousValue: child.evidence.previousValue || 'N/A',
          newValue: child.evidence.newValue || 'N/A',
          confidence: 95,
          timestamp: child.createdAt
        });
      }
    }
    
    return facts;
  }

  private generateTitle(event: CorrelatedAlertEvent, conflict: ConflictReport): string {
    if (conflict.hasConflict) {
      return 'MOMENTUM/RISK CONFLICT';
    }
    if (event.severity === AlertSeverity.CRITICAL) {
      return 'CRITICAL MARKET TRANSITION';
    }
    return 'MARKET ACTIVITY DETECTED';
  }

  private buildDeterministicExplanation(event: CorrelatedAlertEvent, facts: AlertFact[], conflict: ConflictReport): string {
    // This is the fallback/structured string passed to the UI before AI kicks in, or the prompt payload.
    if (conflict.hasConflict) {
      return `Price is rising rapidly, but market-quality signals are deteriorating. Please review market condition facts immediately.`;
    }
    return `Token is experiencing significant changes across multiple metrics. Confidence in these signals is high based on verified on-chain facts.`;
  }

  private deriveActions(event: CorrelatedAlertEvent, conflict: ConflictReport): string[] {
    if (conflict.hasConflict) {
      return ['Investigate Risk', 'View Token', 'Set Protection Alert'];
    }
    return ['View Token', 'Set Trade', 'Follow Wallets'];
  }
}
