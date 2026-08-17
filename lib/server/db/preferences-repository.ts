import 'server-only';

import { dbPool } from './pool';
import type { DbUserPreferences } from '@/lib/server/store';

const DEFAULT_PREFERENCES: Omit<DbUserPreferences, 'userId' | 'updatedAt'> = {
  slippageTolerance: 0.5,
  riskLevel: 'moderate',
  currencyDisplay: 'USD',
  rpcEndpoint: 'mainnet',
  theme: 'dark',
  density: 'standard',
  autoLockMinutes: 30,
  notificationsEnabled: { security: true, priceAlerts: true, tradeExecution: true, system: true },
};

/**
 * Postgres-backed replacement for `ServerStore`'s preferences Map. The whole
 * `DbUserPreferences` object is stored as one JSONB blob in
 * `user_settings.sentinel_preferences` (see 020's migration note) rather
 * than mapped onto 013's differently-shaped generic settings columns.
 */
export class PgPreferencesRepository {
  async getUserPreferences(userId: string): Promise<DbUserPreferences> {
    const { rows } = await dbPool.query<{ sentinel_preferences: Record<string, unknown> | null }>(
      'SELECT sentinel_preferences FROM user_settings WHERE user_id = $1',
      [userId],
    );
    const stored = rows[0]?.sentinel_preferences;
    if (stored) {
      return { userId, ...(stored as Omit<DbUserPreferences, 'userId'>) };
    }

    const defaults: DbUserPreferences = { userId, ...DEFAULT_PREFERENCES, updatedAt: new Date().toISOString() };
    await this.persist(userId, defaults);
    return defaults;
  }

  async updateUserPreferences(
    userId: string,
    updates: Partial<Omit<DbUserPreferences, 'notificationsEnabled'>> & {
      notificationsEnabled?: Partial<DbUserPreferences['notificationsEnabled']>;
    },
  ): Promise<DbUserPreferences> {
    const current = await this.getUserPreferences(userId);
    const updated: DbUserPreferences = {
      ...current,
      ...updates,
      userId,
      notificationsEnabled: {
        ...current.notificationsEnabled,
        ...(updates.notificationsEnabled || {}),
      },
      updatedAt: new Date().toISOString(),
    };
    await this.persist(userId, updated);
    return updated;
  }

  private async persist(userId: string, preferences: DbUserPreferences): Promise<void> {
    const { userId: _unused, ...toStore } = preferences;
    void _unused;
    await dbPool.query(
      `INSERT INTO user_settings (user_id, sentinel_preferences)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET sentinel_preferences = $2`,
      [userId, JSON.stringify(toStore)],
    );
  }
}

export const pgPreferencesRepository = new PgPreferencesRepository();
