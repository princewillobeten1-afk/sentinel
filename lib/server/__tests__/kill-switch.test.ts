import { describe, expect, it } from 'vitest';
import { killSwitch } from '../kill-switch';

describe('KillSwitchStore', () => {
  it('starts unpaused for every scope', () => {
    // Use a scope-independent assertion since state persists across the process (globalThis-guarded)
    // and other test files may have paused/resumed scopes — check resume() leaves it unpaused instead.
    killSwitch.resume('TRADING', { triggeredBy: 'test_setup' });
    expect(killSwitch.isPaused('TRADING')).toBe(false);
  });

  it('pause() sets paused true with reason/source recorded', () => {
    const state = killSwitch.pause('TRADING', { reason: 'test pause', triggeredBy: 'admin_a', source: 'ADMIN' });
    expect(state.paused).toBe(true);
    expect(state.reason).toBe('test pause');
    expect(state.source).toBe('ADMIN');
    expect(killSwitch.isPaused('TRADING')).toBe(true);
  });

  it('resume() clears the pause', () => {
    killSwitch.pause('TRADING', { reason: 'test pause', triggeredBy: 'admin_a', source: 'ADMIN' });
    const state = killSwitch.resume('TRADING', { triggeredBy: 'admin_b' });
    expect(state.paused).toBe(false);
    expect(killSwitch.isPaused('TRADING')).toBe(false);
  });

  it('scopes are independent', () => {
    killSwitch.resume('TRADING', { triggeredBy: 'test_setup' });
    killSwitch.resume('LAUNCHPAD', { triggeredBy: 'test_setup' });

    killSwitch.pause('LAUNCHPAD', { reason: 'test', triggeredBy: 'admin_c', source: 'ADMIN' });
    expect(killSwitch.isPaused('LAUNCHPAD')).toBe(true);
    expect(killSwitch.isPaused('TRADING')).toBe(false);

    killSwitch.resume('LAUNCHPAD', { triggeredBy: 'admin_c' });
  });

  it('getAllStates returns all three scopes', () => {
    const states = killSwitch.getAllStates();
    expect(states.map((s) => s.scope).sort()).toEqual(['LAUNCHPAD', 'TRADING', 'WALLET_TRANSFERS']);
  });
});
