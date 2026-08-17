import { describe, it, expect, beforeEach } from 'vitest';
import { executionKillSwitch } from '../kill-switch';
import { dbRepository } from '../../db/repository';

describe('Emergency Kill Switch & Blocklist (Sprint 47 §72-73, §90-91)', () => {
  beforeEach(() => {
    dbRepository.reset();
    executionKillSwitch.reset();
  });

  it('manages administrative execution emergency kill switch', () => {
    expect(executionKillSwitch.isEnabled()).toBe(false);

    executionKillSwitch.enableKillSwitch('Severe market volatility', 'admin_sec');
    expect(executionKillSwitch.isEnabled()).toBe(true);
    expect(executionKillSwitch.getStatus().reason).toBe('Severe market volatility');

    executionKillSwitch.disableKillSwitch('admin_sec');
    expect(executionKillSwitch.isEnabled()).toBe(false);
  });

  it('blocks compromised or malicious tokens and contracts', () => {
    const maliciousToken = '0xScamTokenAddress123';
    expect(executionKillSwitch.isTargetBlocked(maliciousToken)).toBe(false);

    executionKillSwitch.blockTarget('TOKEN', maliciousToken, 'Honeypot scam detected', 'admin_sec');
    expect(executionKillSwitch.isTargetBlocked(maliciousToken)).toBe(true);

    const list = executionKillSwitch.getBlocklist();
    expect(list.length).toBe(1);
    expect(list[0].target_value).toBe(maliciousToken);
  });
});
