import { describe, expect, it } from 'vitest';
import {
  ORDER_TRANSITIONS,
  assertOrderTransition,
  isValidOrderTransition,
  isTerminalOrderState,
  stateForFill,
  type OrderState,
} from '../state-machine';

describe('order state machine — legal transitions', () => {
  it('follows the happy path CREATED → PENDING → SUBMITTED → FILLED', () => {
    expect(isValidOrderTransition('CREATED', 'PENDING')).toBe(true);
    expect(isValidOrderTransition('PENDING', 'SUBMITTED')).toBe(true);
    expect(isValidOrderTransition('SUBMITTED', 'FILLED')).toBe(true);
  });

  it('allows a partial fill to complete', () => {
    expect(isValidOrderTransition('SUBMITTED', 'PARTIALLY_FILLED')).toBe(true);
    expect(isValidOrderTransition('PARTIALLY_FILLED', 'FILLED')).toBe(true);
  });

  it('allows cancelling the remainder of a partial fill', () => {
    expect(isValidOrderTransition('PARTIALLY_FILLED', 'CANCELLED')).toBe(true);
  });
});

describe('order state machine — illegal transitions are rejected', () => {
  it('cannot skip straight from CREATED to FILLED', () => {
    expect(isValidOrderTransition('CREATED', 'FILLED')).toBe(false);
    expect(() => assertOrderTransition('CREATED', 'FILLED')).toThrow(/Illegal order transition/);
  });

  it('cannot move backwards', () => {
    expect(isValidOrderTransition('SUBMITTED', 'PENDING')).toBe(false);
    expect(isValidOrderTransition('FILLED', 'SUBMITTED')).toBe(false);
  });

  it('cannot leave a terminal state', () => {
    for (const terminal of ['FILLED', 'CANCELLED', 'FAILED', 'EXPIRED'] as OrderState[]) {
      expect(ORDER_TRANSITIONS[terminal]).toEqual([]);
      expect(isTerminalOrderState(terminal)).toBe(true);
      expect(() => assertOrderTransition(terminal, 'PENDING')).toThrow(/Illegal order transition/);
    }
  });

  it('cannot cancel an already-filled order', () => {
    expect(() => assertOrderTransition('FILLED', 'CANCELLED')).toThrow(/Illegal order transition/);
  });

  it('rejects a no-op transition to the same state', () => {
    expect(() => assertOrderTransition('PENDING', 'PENDING')).toThrow(/already in state/);
  });

  it('throws ApiError with INVALID_STATE_TRANSITION and a 409', () => {
    try {
      assertOrderTransition('FILLED', 'CANCELLED');
      throw new Error('should have thrown');
    } catch (err: any) {
      expect(err.code).toBe('INVALID_STATE_TRANSITION');
      expect(err.statusCode).toBe(409);
    }
  });
});

describe('stateForFill', () => {
  it('treats a zero fill as still SUBMITTED', () => {
    expect(stateForFill(0, 100)).toBe('SUBMITTED');
  });

  it('treats a complete fill as FILLED', () => {
    expect(stateForFill(100, 100)).toBe('FILLED');
  });

  it('treats an over-fill as FILLED rather than an invalid state', () => {
    expect(stateForFill(101, 100)).toBe('FILLED');
  });

  it('treats anything in between as PARTIALLY_FILLED', () => {
    expect(stateForFill(1, 100)).toBe('PARTIALLY_FILLED');
    expect(stateForFill(99.999, 100)).toBe('PARTIALLY_FILLED');
  });
});

describe('transition table integrity', () => {
  it('every reachable target state is itself a defined state', () => {
    const states = Object.keys(ORDER_TRANSITIONS) as OrderState[];
    for (const [, targets] of Object.entries(ORDER_TRANSITIONS)) {
      for (const t of targets) {
        expect(states).toContain(t);
      }
    }
  });

  it('no state lists itself as a legal target', () => {
    for (const [from, targets] of Object.entries(ORDER_TRANSITIONS)) {
      expect(targets).not.toContain(from);
    }
  });
});
