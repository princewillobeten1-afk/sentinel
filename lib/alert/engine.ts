import {
  AlertCategory,
  AlertRule,
  RawEvent,
  AlertEvent,
  AlertSeverity,
  AlertConfidence,
  AlertReadState,
  MultiConditionGroup,
  AlertCondition,
} from './types';

export class AlertEngine {
  
  /**
   * Evaluates an incoming event against a rule.
   */
  public evaluate(rule: AlertRule, event: RawEvent): boolean {
    if (!rule.isEnabled) return false;
    if (rule.category !== event.category) return false;

    // Check scope (e.g. if rule is for a specific token)
    for (const [key, value] of Object.entries(rule.scope)) {
      if (event.payload[key] !== value && event.context?.[key] !== value) {
        return false;
      }
    }

    return this.evaluateConditionGroup(rule.conditions, event);
  }

  private evaluateConditionGroup(group: MultiConditionGroup, event: RawEvent): boolean {
    if (group.operator === 'AND') {
      return group.conditions.every(c => this.isConditionGroup(c) ? this.evaluateConditionGroup(c, event) : this.evaluateCondition(c, event));
    } else if (group.operator === 'OR') {
      return group.conditions.some(c => this.isConditionGroup(c) ? this.evaluateConditionGroup(c, event) : this.evaluateCondition(c, event));
    } else if (group.operator === 'NOT') {
      // For NOT, we expect a single condition or group inside
      const first = group.conditions[0];
      if (!first) return true;
      return !(this.isConditionGroup(first) ? this.evaluateConditionGroup(first, event) : this.evaluateCondition(first, event));
    }
    return false;
  }

  private evaluateCondition(condition: AlertCondition, event: RawEvent): boolean {
    // We check both payload and context for the field
    const value = event.payload[condition.field] !== undefined ? event.payload[condition.field] : event.context?.[condition.field];

    if (value === undefined) return false;

    switch (condition.operator) {
      case 'EQ': return value === condition.value;
      case 'NEQ': return value !== condition.value;
      case 'GT': return value > condition.value;
      case 'GTE': return value >= condition.value;
      case 'LT': return value < condition.value;
      case 'LTE': return value <= condition.value;
      case 'IN': return Array.isArray(condition.value) && condition.value.includes(value);
      case 'NOT_IN': return Array.isArray(condition.value) && !condition.value.includes(value);
      case 'CONTAINS': return typeof value === 'string' && typeof condition.value === 'string' && value.includes(condition.value);
      default: return false;
    }
  }

  private isConditionGroup(c: any): c is MultiConditionGroup {
    return 'operator' in c && 'conditions' in c;
  }

  /**
   * Calculates a relevance score for the alert based on user context.
   */
  public calculateRelevance(
    event: RawEvent,
    userContext: { exposureUsd?: number; isWatchlisted?: boolean }
  ): number {
    let score = 50; // base score

    if (userContext.isWatchlisted) {
      score += 20;
    }

    if (userContext.exposureUsd) {
      if (userContext.exposureUsd > 10000) score += 30;
      else if (userContext.exposureUsd > 1000) score += 20;
      else if (userContext.exposureUsd > 100) score += 10;
    }

    return Math.min(score, 100);
  }

  /**
   * Transforms a raw event into a structured AlertEvent, deduplicating and applying cooldowns.
   */
  public generateAlert(rule: AlertRule, event: RawEvent, userContext: any): AlertEvent | null {
    // 1. Check Cooldowns (Stub)
    // if (this.isRuleOnCooldown(rule.id)) return null;

    const relevanceScore = this.calculateRelevance(event, userContext);
    const confidenceScore = 90; // Defaulting to high for stub
    const timeSensitivity = 1.2; // Multiplier for time-critical events

    // Calculate Priority: Severity (1-5) * Relevance (0-100) * Confidence (0-100) * TimeSensitivity
    const severityMap: Record<AlertSeverity, number> = {
      [AlertSeverity.INFO]: 1,
      [AlertSeverity.LOW]: 2,
      [AlertSeverity.MEDIUM]: 3,
      [AlertSeverity.HIGH]: 4,
      [AlertSeverity.CRITICAL]: 5
    };
    
    let finalSeverity = rule.severity;
    
    // Priority Score helps rank alerts in the UI inbox
    const priorityScore = (severityMap[finalSeverity] * relevanceScore * confidenceScore * timeSensitivity) / 100;

    // Upgrade severity based on priority/relevance (example logic)
    if (priorityScore > 350 && finalSeverity !== AlertSeverity.CRITICAL) {
      finalSeverity = AlertSeverity.CRITICAL;
    }

    // A group_id can be generated based on token/event type/time window to deduplicate
    const groupId = `${event.category}-${event.payload.tokenId || 'global'}-${Math.floor(Date.now() / (15 * 60 * 1000))}`; // 15-min buckets

    // 2. Set Cooldown
    // this.setRuleCooldown(rule.id, rule.cooldownMinutes);

    return {
      id: crypto.randomUUID(),
      userId: rule.userId,
      ruleId: rule.id,
      category: event.category,
      severity: finalSeverity,
      confidence: AlertConfidence.HIGH, 
      relevanceScore: priorityScore, // Using this field to store calculated priority
      message: this.generateMessage(rule, event),
      evidence: event.payload,
      snapshot: event.context || {},
      readState: AlertReadState.UNREAD,
      groupId,
      createdAt: new Date()
    };
  }

  private generateMessage(rule: AlertRule, event: RawEvent): string {
    // Real implementation would have robust templates
    return `Alert for ${rule.category}: ${rule.name || 'Condition met'}`;
  }
}
