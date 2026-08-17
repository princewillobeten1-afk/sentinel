/**
 * Short-lived, single-use challenges bridging "credential verified" to
 * "session issued" for accounts with MFA enabled (Sprint 30 — Tier 2).
 * In-memory, `globalThis`-guarded, same pattern as the other new stores this
 * sprint.
 */

import { generateId } from './id';
import type { AuthUser } from './auth';

export interface MfaChallenge {
  id: string;
  user: AuthUser;
  createdAt: string;
  expiresAt: string;
  consumed: boolean;
}

const TTL_MS = 5 * 60 * 1000;

class MfaChallengeStore {
  private challengesById = new Map<string, MfaChallenge>();

  create(user: AuthUser): MfaChallenge {
    const now = new Date();
    const challenge: MfaChallenge = {
      id: generateId('mfachal'),
      user,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + TTL_MS).toISOString(),
      consumed: false,
    };
    this.challengesById.set(challenge.id, challenge);
    return challenge;
  }

  /** Returns the challenge if it exists, isn't consumed, and hasn't expired — does not consume it. */
  peek(id: string): MfaChallenge | null {
    const challenge = this.challengesById.get(id);
    if (!challenge) return null;
    if (challenge.consumed) return null;
    if (Date.parse(challenge.expiresAt) < Date.now()) return null;
    return challenge;
  }

  /** Marks a challenge consumed so it can't be replayed. */
  consume(id: string): void {
    const challenge = this.challengesById.get(id);
    if (challenge) challenge.consumed = true;
  }
}

const globalForMfaChallenge = globalThis as unknown as { mfaChallengeStore?: MfaChallengeStore };
export const mfaChallengeStore = globalForMfaChallenge.mfaChallengeStore ?? new MfaChallengeStore();
if (process.env.NODE_ENV !== 'production') globalForMfaChallenge.mfaChallengeStore = mfaChallengeStore;
