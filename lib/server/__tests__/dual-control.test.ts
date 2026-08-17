import { describe, expect, it } from 'vitest';
import { dualControlStore } from '../dual-control';

describe('DualControlStore', () => {
  it('proposes a request in PENDING status', () => {
    const request = dualControlStore.propose('PAUSE_TRADING', 'admin_a', 'testing');
    expect(request.status).toBe('PENDING');
    expect(request.requestedBy).toBe('admin_a');
  });

  it('rejects self-approval', () => {
    const request = dualControlStore.propose('PAUSE_TRADING', 'admin_b', 'testing');
    expect(() => dualControlStore.approve(request.id, 'admin_b')).toThrow(/cannot also approve/);
    // Status must remain PENDING after a rejected self-approval attempt.
    expect(dualControlStore.get(request.id)?.status).toBe('PENDING');
  });

  it('allows approval by a distinct admin', () => {
    const request = dualControlStore.propose('PAUSE_TRADING', 'admin_c', 'testing');
    const approved = dualControlStore.approve(request.id, 'admin_d');
    expect(approved.status).toBe('APPROVED');
    expect(approved.approvedBy).toBe('admin_d');
  });

  it('cannot be resolved twice', () => {
    const request = dualControlStore.propose('RESUME_TRADING', 'admin_e', 'testing');
    dualControlStore.approve(request.id, 'admin_f');
    expect(() => dualControlStore.approve(request.id, 'admin_g')).toThrow(/already approved/);
  });

  it('rejection also prevents further resolution', () => {
    const request = dualControlStore.propose('PAUSE_LAUNCHPAD', 'admin_h', 'testing');
    dualControlStore.reject(request.id, 'admin_i');
    expect(() => dualControlStore.approve(request.id, 'admin_j')).toThrow(/already rejected/);
  });

  it('listPending only returns PENDING requests', () => {
    const pending = dualControlStore.propose('PAUSE_TRADING', 'admin_k', 'testing');
    const resolved = dualControlStore.propose('PAUSE_TRADING', 'admin_l', 'testing');
    dualControlStore.approve(resolved.id, 'admin_m');

    const listed = dualControlStore.listPending();
    expect(listed.some((r) => r.id === pending.id)).toBe(true);
    expect(listed.some((r) => r.id === resolved.id)).toBe(false);
  });

  it('throws for an unknown request id', () => {
    expect(() => dualControlStore.approve('appr_does_not_exist', 'admin_n')).toThrow(/not found/);
  });
});
