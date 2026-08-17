import { AlertEvent, AlertCategory, AlertSeverity } from './types';
import { CorrelatedAlertEvent } from './correlation';

export interface ConflictReport {
  hasConflict: boolean;
  conflictType: 'BULLISH_PRICE_BEARISH_RISK' | 'BEARISH_PRICE_BULLISH_RISK' | 'NONE';
  description?: string;
}

export class SignalConflictEngine {
  /**
   * Identifies contradictory signals within a correlated event cluster.
   * e.g., Bullish price action coupled with bearish market quality.
   */
  public detectConflicts(event: CorrelatedAlertEvent): ConflictReport {
    if (event.childEvents.length === 0) return { hasConflict: false, conflictType: 'NONE' };

    let bullishSignals = 0;
    let bearishSignals = 0;
    
    // Evaluate the nature of the child events
    for (const child of event.childEvents) {
      if (child.category === AlertCategory.PRICE && this.isPositiveMetric(child)) {
        bullishSignals++;
      } else if (child.category === AlertCategory.PRICE && !this.isPositiveMetric(child)) {
        bearishSignals++;
      }

      if (child.category === AlertCategory.RISK || child.category === AlertCategory.EXITABILITY) {
        if (!this.isPositiveMetric(child)) {
          bearishSignals++;
        } else {
          bullishSignals++;
        }
      }
      
      // Insider and Creator activity can also be evaluated similarly
    }

    if (bullishSignals > 0 && bearishSignals > 0) {
      // Determine the specific conflict type
      const priceIsUp = event.childEvents.some(e => e.category === AlertCategory.PRICE && this.isPositiveMetric(e));
      const riskIsUp = event.childEvents.some(e => (e.category === AlertCategory.RISK || e.category === AlertCategory.EXITABILITY) && !this.isPositiveMetric(e));
      
      if (priceIsUp && riskIsUp) {
        return {
          hasConflict: true,
          conflictType: 'BULLISH_PRICE_BEARISH_RISK',
          description: 'Price momentum conflicts with deteriorating market-quality signals.'
        };
      }
    }

    return { hasConflict: false, conflictType: 'NONE' };
  }

  private isPositiveMetric(event: AlertEvent): boolean {
    // Stub: determine if the event payload implies a positive change
    // Example: { field: "price", newValue: 10, previousValue: 8 } -> true
    if (event.evidence?.newValue && event.evidence?.previousValue) {
      if (event.category === AlertCategory.RISK) {
        // Lower risk is positive
        return event.evidence.newValue < event.evidence.previousValue;
      }
      // Generally higher is positive
      return event.evidence.newValue > event.evidence.previousValue;
    }
    
    // Default fallback based on event category/severity semantics
    return true; 
  }
}
