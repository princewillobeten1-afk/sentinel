import { expect, it } from 'vitest';
import { loadEnvConfig } from '@next/env';
import { bitqueryLaunchHealth, getBitqueryRecentLaunches, resetBitqueryLaunchesForTests } from '../bitquery-launch-feed';

/** Explicitly opted-in, read-only provider check; never part of the normal suite. */
it.skipIf(process.env.RUN_PROVIDER_SMOKE !== '1')('loads current Pump.fun creations from Bitquery', async () => {
  loadEnvConfig(process.cwd());
  resetBitqueryLaunchesForTests();
  const rows = await getBitqueryRecentLaunches();
  expect(bitqueryLaunchHealth().lastError).toBeNull();
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.every(({ token }) => token.lifecycleEvidence?.source === 'bitquery-pump-creation')).toBe(true);
}, 30_000);
