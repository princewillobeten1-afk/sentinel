import { describe, expect, it } from 'vitest';
import { LaunchState } from '@/lib/launchpad/types';
import { LAUNCH_STATE_TRANSITIONS, isValidLaunchStateTransition } from '../launchpad';

describe('LAUNCH_STATE_TRANSITIONS / isValidLaunchStateTransition', () => {
  it('has an entry for every LaunchState value', () => {
    const allStates = Object.values(LaunchState);
    for (const state of allStates) {
      expect(LAUNCH_STATE_TRANSITIONS[state]).toBeDefined();
    }
  });

  it('allows the real happy-path lifecycle', () => {
    const happyPath: LaunchState[] = [
      LaunchState.CREATED,
      LaunchState.VALIDATING,
      LaunchState.DEPLOYED,
      LaunchState.LIVE,
      LaunchState.GRADUATING,
      LaunchState.GRADUATED,
    ];
    for (let i = 0; i < happyPath.length - 1; i++) {
      expect(isValidLaunchStateTransition(happyPath[i], happyPath[i + 1])).toBe(true);
    }
  });

  it('allows pausing and resuming from LIVE', () => {
    expect(isValidLaunchStateTransition(LaunchState.LIVE, LaunchState.PAUSED)).toBe(true);
    expect(isValidLaunchStateTransition(LaunchState.PAUSED, LaunchState.LIVE)).toBe(true);
  });

  it('rejects skipping states (e.g. CREATED straight to LIVE)', () => {
    expect(isValidLaunchStateTransition(LaunchState.CREATED, LaunchState.LIVE)).toBe(false);
  });

  it('rejects any transition out of terminal states', () => {
    expect(isValidLaunchStateTransition(LaunchState.GRADUATED, LaunchState.LIVE)).toBe(false);
    expect(isValidLaunchStateTransition(LaunchState.CANCELLED, LaunchState.CREATED)).toBe(false);
  });

  it('allows cancellation from every non-terminal state', () => {
    const nonTerminal = [LaunchState.CREATED, LaunchState.VALIDATING, LaunchState.DEPLOYED, LaunchState.LIVE, LaunchState.PAUSED];
    for (const state of nonTerminal) {
      expect(isValidLaunchStateTransition(state, LaunchState.CANCELLED)).toBe(true);
    }
  });

  it('rejects an unrecognized "state" gracefully rather than throwing', () => {
    expect(isValidLaunchStateTransition('NOT_A_REAL_STATE' as LaunchState, LaunchState.LIVE)).toBe(false);
  });
});
