import { AlertEvent, AlertCategory, AlertSeverity } from './types';

export interface CorrelatedAlertEvent extends AlertEvent {
  childEvents: AlertEvent[];
  correlationReason: string;
}

export class AlertCorrelationEngine {
  /**
   * Groups simultaneous or related events into a single parent event
   * to prevent alert fatigue. (e.g., Liquidity drop + Exitability drop -> Market quality drop)
   */
  public correlateEvents(events: AlertEvent[], timeWindowMs: number = 5 * 60 * 1000): CorrelatedAlertEvent[] {
    const correlated: CorrelatedAlertEvent[] = [];
    const processedIds = new Set<string>();

    // Group events by token
    const tokenGroups = this.groupByToken(events);

    for (const [tokenId, tokenEvents] of Object.entries(tokenGroups)) {
      // Sort chronologically
      tokenEvents.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      for (let i = 0; i < tokenEvents.length; i++) {
        const primaryEvent = tokenEvents[i];
        if (processedIds.has(primaryEvent.id)) continue;

        // Find related events within the time window
        const relatedEvents = tokenEvents.filter(e => 
          e.id !== primaryEvent.id &&
          !processedIds.has(e.id) &&
          e.createdAt.getTime() - primaryEvent.createdAt.getTime() <= timeWindowMs
        );

        if (relatedEvents.length > 0) {
          // Identify correlation reason
          const hasRisk = relatedEvents.some(e => e.category === AlertCategory.RISK) || primaryEvent.category === AlertCategory.RISK;
          const hasMarket = relatedEvents.some(e => e.category === AlertCategory.MARKET) || primaryEvent.category === AlertCategory.MARKET;
          
          let reason = 'Multiple related events detected';
          if (hasRisk && hasMarket) {
            reason = 'Market event with associated risk changes';
          }

          // Escalate severity if multiple events cluster
          const highestSeverity = this.getHighestSeverity([primaryEvent, ...relatedEvents]);
          let finalSeverity = highestSeverity;
          if (relatedEvents.length >= 3 && highestSeverity !== AlertSeverity.CRITICAL) {
            finalSeverity = AlertSeverity.CRITICAL;
          }

          const correlatedEvent: CorrelatedAlertEvent = {
            ...primaryEvent,
            id: `corr-${crypto.randomUUID()}`,
            category: AlertCategory.MARKET, // Grouped as a high-level market/risk event
            severity: finalSeverity,
            message: `Correlated Activity: ${reason}`,
            childEvents: [primaryEvent, ...relatedEvents],
            correlationReason: reason
          };

          correlated.push(correlatedEvent);

          // Mark as processed
          processedIds.add(primaryEvent.id);
          relatedEvents.forEach(e => processedIds.add(e.id));
        } else {
          // Promote solitary event to output, disguised as correlated without children
          correlated.push({
            ...primaryEvent,
            childEvents: [],
            correlationReason: 'Single independent event'
          });
          processedIds.add(primaryEvent.id);
        }
      }
    }

    return correlated;
  }

  private groupByToken(events: AlertEvent[]): Record<string, AlertEvent[]> {
    return events.reduce((acc, event) => {
      const tokenId = event.evidence?.tokenId || event.snapshot?.tokenId || 'global';
      if (!acc[tokenId]) acc[tokenId] = [];
      acc[tokenId].push(event);
      return acc;
    }, {} as Record<string, AlertEvent[]>);
  }

  private getHighestSeverity(events: AlertEvent[]): AlertSeverity {
    const order = [AlertSeverity.INFO, AlertSeverity.LOW, AlertSeverity.MEDIUM, AlertSeverity.HIGH, AlertSeverity.CRITICAL];
    let max = -1;
    let highest = AlertSeverity.INFO;
    for (const e of events) {
      const idx = order.indexOf(e.severity);
      if (idx > max) {
        max = idx;
        highest = e.severity;
      }
    }
    return highest;
  }
}
