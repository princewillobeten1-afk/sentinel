import { describe, expect, it } from 'vitest';
import {
  ALERT_RULE_TRANSITIONS,
  READ_STATE_TRANSITIONS,
  assertAlertRuleTransition,
  assertReadStateTransition,
  isValidAlertRuleTransition,
  type AlertRuleState,
  type AlertEventReadState,
} from '../rule-state-machine';

describe('alert RULE lifecycle', () => {
  it('pauses and resumes', () => {
    expect(isValidAlertRuleTransition('ACTIVE', 'PAUSED')).toBe(true);
    expect(isValidAlertRuleTransition('PAUSED', 'ACTIVE')).toBe(true);
  });

  it('returns to ACTIVE after firing — TRIGGERED is not terminal', () => {
    expect(isValidAlertRuleTransition('ACTIVE', 'TRIGGERED')).toBe(true);
    expect(isValidAlertRuleTransition('TRIGGERED', 'ACTIVE')).toBe(true);
  });

  it('cannot fire while paused', () => {
    expect(isValidAlertRuleTransition('PAUSED', 'TRIGGERED')).toBe(false);
    expect(() => assertAlertRuleTransition('PAUSED', 'TRIGGERED')).toThrow(/Illegal alert rule transition/);
  });

  it('cannot revive a deleted rule', () => {
    expect(ALERT_RULE_TRANSITIONS.DELETED).toEqual([]);
    expect(() => assertAlertRuleTransition('DELETED', 'ACTIVE')).toThrow(/Illegal alert rule transition/);
  });

  it('an expired rule can only be deleted', () => {
    expect(ALERT_RULE_TRANSITIONS.EXPIRED).toEqual(['DELETED']);
    expect(() => assertAlertRuleTransition('EXPIRED', 'ACTIVE')).toThrow(/Illegal alert rule transition/);
  });

  it('rejects a no-op transition', () => {
    expect(() => assertAlertRuleTransition('ACTIVE', 'ACTIVE')).toThrow(/already ACTIVE/);
  });

  it('throws INVALID_STATE_TRANSITION with a 409', () => {
    try {
      assertAlertRuleTransition('DELETED', 'ACTIVE');
      throw new Error('should have thrown');
    } catch (err: any) {
      expect(err.code).toBe('INVALID_STATE_TRANSITION');
      expect(err.statusCode).toBe(409);
    }
  });

  it('every rule state can reach DELETED except DELETED itself', () => {
    const states = Object.keys(ALERT_RULE_TRANSITIONS) as AlertRuleState[];
    for (const s of states) {
      if (s === 'DELETED') continue;
      expect(ALERT_RULE_TRANSITIONS[s]).toContain('DELETED');
    }
  });
});

describe('alert EVENT read state — a separate lifecycle from the rule', () => {
  it('advances UNREAD → READ → ACTIONED', () => {
    expect(() => assertReadStateTransition('UNREAD', 'READ')).not.toThrow();
    expect(() => assertReadStateTransition('READ', 'ACTIONED')).not.toThrow();
  });

  it('can be dismissed from either UNREAD or READ', () => {
    expect(() => assertReadStateTransition('UNREAD', 'DISMISSED')).not.toThrow();
    expect(() => assertReadStateTransition('READ', 'DISMISSED')).not.toThrow();
  });

  it('cannot go back to UNREAD once read', () => {
    expect(() => assertReadStateTransition('READ', 'UNREAD')).toThrow(/Illegal read-state transition/);
  });

  it('acting on or dismissing a firing is terminal', () => {
    for (const terminal of ['ACTIONED', 'DISMISSED'] as AlertEventReadState[]) {
      expect(READ_STATE_TRANSITIONS[terminal]).toEqual([]);
      expect(() => assertReadStateTransition(terminal, 'READ')).toThrow(/Illegal read-state transition/);
    }
  });

  it('cannot jump straight from UNREAD to ACTIONED', () => {
    expect(() => assertReadStateTransition('UNREAD', 'ACTIONED')).toThrow(/Illegal read-state transition/);
  });

  it('is genuinely independent of the rule lifecycle', () => {
    // A rule state must never be accepted as a read state, and vice versa.
    const ruleStates = Object.keys(ALERT_RULE_TRANSITIONS);
    const readStates = Object.keys(READ_STATE_TRANSITIONS);
    expect(ruleStates.some((s) => readStates.includes(s))).toBe(false);
  });
});
