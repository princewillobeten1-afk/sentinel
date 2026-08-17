import { beforeEach, describe, expect, it } from 'vitest';
import { sessionStore } from '../session-store';

describe('SessionStore', () => {
  it('creates a session that is valid immediately', async () => {
    const session = await sessionStore.create('user_a', { ip: '1.2.3.4', userAgent: 'test-agent', expiresInSeconds: 3600, mfaVerified: true });
    expect(await sessionStore.isValid(session.id)).toBe(true);
    expect((await sessionStore.get(session.id))?.userId).toBe('user_a');
  });

  it('is invalid once revoked', async () => {
    const session = await sessionStore.create('user_b', { ip: null, userAgent: null, expiresInSeconds: 3600, mfaVerified: true });
    expect(await sessionStore.isValid(session.id)).toBe(true);

    const revoked = await sessionStore.revoke(session.id, 'test');
    expect(revoked).toBe(true);
    expect(await sessionStore.isValid(session.id)).toBe(false);
    expect((await sessionStore.get(session.id))?.revokedReason).toBe('test');
  });

  it('is invalid once expired', async () => {
    const session = await sessionStore.create('user_c', { ip: null, userAgent: null, expiresInSeconds: -1, mfaVerified: true });
    expect(await sessionStore.isValid(session.id)).toBe(false);
  });

  it('revoking twice returns false the second time', async () => {
    const session = await sessionStore.create('user_d', { ip: null, userAgent: null, expiresInSeconds: 3600, mfaVerified: true });
    expect(await sessionStore.revoke(session.id)).toBe(true);
    expect(await sessionStore.revoke(session.id)).toBe(false);
  });

  it('revokes all sessions for a user except the excluded one', async () => {
    const userId = 'user_e';
    const s1 = await sessionStore.create(userId, { ip: null, userAgent: null, expiresInSeconds: 3600, mfaVerified: true });
    const s2 = await sessionStore.create(userId, { ip: null, userAgent: null, expiresInSeconds: 3600, mfaVerified: true });
    const s3 = await sessionStore.create(userId, { ip: null, userAgent: null, expiresInSeconds: 3600, mfaVerified: true });

    const count = await sessionStore.revokeAllForUser(userId, { exceptSessionId: s2.id });

    expect(count).toBe(2);
    expect(await sessionStore.isValid(s1.id)).toBe(false);
    expect(await sessionStore.isValid(s2.id)).toBe(true);
    expect(await sessionStore.isValid(s3.id)).toBe(false);
  });

  it('does not revoke another user\'s sessions', async () => {
    const s1 = await sessionStore.create('user_f1', { ip: null, userAgent: null, expiresInSeconds: 3600, mfaVerified: true });
    const s2 = await sessionStore.create('user_f2', { ip: null, userAgent: null, expiresInSeconds: 3600, mfaVerified: true });

    await sessionStore.revokeAllForUser('user_f1');

    expect(await sessionStore.isValid(s1.id)).toBe(false);
    expect(await sessionStore.isValid(s2.id)).toBe(true);
  });

  it('lists sessions for a user sorted by most recently seen first', async () => {
    const userId = 'user_g';
    const s1 = await sessionStore.create(userId, { ip: null, userAgent: null, expiresInSeconds: 3600, mfaVerified: true });
    const s2 = await sessionStore.create(userId, { ip: null, userAgent: null, expiresInSeconds: 3600, mfaVerified: true });
    await sessionStore.touch(s1.id);

    const listed = await sessionStore.listForUser(userId);
    expect(listed.map((s) => s.id)).toContain(s1.id);
    expect(listed.map((s) => s.id)).toContain(s2.id);
    expect(listed[0].id).toBe(s1.id); // most recently touched first
  });

  it('detects a previously-seen device by IP or user agent', async () => {
    const userId = 'user_h';
    await sessionStore.create(userId, { ip: '9.9.9.9', userAgent: 'known-agent', expiresInSeconds: 3600, mfaVerified: true });

    expect(await sessionStore.hasSeenDeviceBefore(userId, { ip: '9.9.9.9', userAgent: 'different-agent' })).toBe(true);
    expect(await sessionStore.hasSeenDeviceBefore(userId, { ip: '1.1.1.1', userAgent: 'known-agent' })).toBe(true);
    expect(await sessionStore.hasSeenDeviceBefore(userId, { ip: '1.1.1.1', userAgent: 'unknown-agent' })).toBe(false);
  });
});
