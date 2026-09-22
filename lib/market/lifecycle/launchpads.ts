/**
 * Centralized registry and configuration for Solana launchpads.
 *
 * Each launchpad uses distinct curve mechanics, graduation thresholds,
 * destination AMMs, and migration instructions.
 */

export type LaunchpadId =
  | 'pump.fun'
  | 'moonshot'
  | 'launchlab'
  | 'letsbonk'
  | 'believe'
  | 'virtuals'
  | 'boop';

export interface LaunchpadConfig {
  id: LaunchpadId;
  name: string;
  shortName: string;
  tag: string;
  programId?: string;
  destinationDex: string;
  destinationProgramId?: string;
  graduationThreshold: string;
  graduationTargetSol?: number;
  graduationTargetUsd?: number;
  graduationTargetQuote?: string;
  quoteToken: 'SOL' | '$VIRTUAL' | 'USDC';
  lpHandling: 'Burned' | 'Locked' | 'Locked 10Y';
  migrationInstructions: string[];
  curveType: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
}

export const LAUNCHPAD_CONFIGS: Record<LaunchpadId, LaunchpadConfig> = {
  'pump.fun': {
    id: 'pump.fun',
    name: 'Pump.fun',
    shortName: 'Pump',
    tag: 'PUMP',
    programId: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
    destinationDex: 'PumpSwap',
    destinationProgramId: 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA',
    graduationThreshold: '~85 SOL (~$69K mcap)',
    graduationTargetSol: 85,
    graduationTargetUsd: 69_000,
    quoteToken: 'SOL',
    lpHandling: 'Burned',
    migrationInstructions: ['migrate', 'migratev2', 'withdraw'],
    curveType: 'Virtual AMM (x * y = k)',
    badgeBg: 'bg-emerald-950/60',
    badgeBorder: 'border-emerald-800/80',
    badgeText: 'text-emerald-400',
  },
  'moonshot': {
    id: 'moonshot',
    name: 'Moonshot',
    shortName: 'Moonshot',
    tag: 'MOON',
    programId: 'CURVEmPpijXDTNdqrA9PGP1io2rkgiVXH26xdXVGLLfz',
    destinationDex: 'Raydium',
    destinationProgramId: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
    graduationThreshold: '500 SOL (~$100K mcap)',
    graduationTargetSol: 500,
    graduationTargetUsd: 100_000,
    quoteToken: 'SOL',
    lpHandling: 'Burned',
    migrationInstructions: ['migrate_to_raydium', 'migrate'],
    curveType: 'Constant Product (500 SOL pool)',
    badgeBg: 'bg-blue-950/60',
    badgeBorder: 'border-blue-800/80',
    badgeText: 'text-blue-400',
  },
  'launchlab': {
    id: 'launchlab',
    name: 'Raydium LaunchLab',
    shortName: 'LaunchLab',
    tag: 'LAB',
    programId: 'LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj',
    destinationDex: 'Raydium CPMM',
    destinationProgramId: 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C',
    graduationThreshold: '85 SOL (24-411 SOL)',
    graduationTargetSol: 85,
    graduationTargetUsd: 69_000,
    quoteToken: 'SOL',
    lpHandling: 'Locked',
    migrationInstructions: ['graduate', 'initialize_cpmm', 'initialize_pool'],
    curveType: 'LaunchLab CPMM Curve',
    badgeBg: 'bg-violet-950/60',
    badgeBorder: 'border-violet-800/80',
    badgeText: 'text-violet-400',
  },
  'letsbonk': {
    id: 'letsbonk',
    name: 'LetsBonk.fun',
    shortName: 'LetsBonk',
    tag: 'BONK',
    programId: 'LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj',
    destinationDex: 'Raydium CPMM',
    destinationProgramId: 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C',
    graduationThreshold: '~411 SOL mcap',
    graduationTargetSol: 411,
    graduationTargetUsd: 100_000,
    quoteToken: 'SOL',
    lpHandling: 'Burned',
    migrationInstructions: ['graduate', 'initialize_v2'],
    curveType: 'LaunchLab Bonk Curve',
    badgeBg: 'bg-amber-950/60',
    badgeBorder: 'border-amber-800/80',
    badgeText: 'text-amber-400',
  },
  'believe': {
    id: 'believe',
    name: 'Believe (LaunchCoin)',
    shortName: 'Believe',
    tag: 'BELIEVE',
    programId: 'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN',
    destinationDex: 'Meteora DAMM v2',
    destinationProgramId: 'cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG',
    graduationThreshold: '$100,000 mcap',
    graduationTargetUsd: 100_000,
    quoteToken: 'SOL',
    lpHandling: 'Locked',
    migrationInstructions: ['initialize_virtual_pool_with_spl_token', 'auto_graduate'],
    curveType: 'Meteora Dynamic Bonding Curve (DBC)',
    badgeBg: 'bg-teal-950/60',
    badgeBorder: 'border-teal-800/80',
    badgeText: 'text-teal-400',
  },
  'virtuals': {
    id: 'virtuals',
    name: 'Virtuals Protocol',
    shortName: 'Virtuals',
    tag: 'VIRTUAL',
    destinationDex: 'Raydium',
    destinationProgramId: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
    graduationThreshold: '42,000 $VIRTUAL',
    graduationTargetQuote: '42,000 $VIRTUAL',
    quoteToken: '$VIRTUAL',
    lpHandling: 'Locked 10Y',
    migrationInstructions: ['graduate', 'initialize_pool'],
    curveType: 'AI Agent Token Bonding Curve',
    badgeBg: 'bg-sky-950/60',
    badgeBorder: 'border-sky-800/80',
    badgeText: 'text-sky-400',
  },
  'boop': {
    id: 'boop',
    name: 'Boop.fun',
    shortName: 'Boop',
    tag: 'BOOP',
    destinationDex: 'Raydium',
    destinationProgramId: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
    graduationThreshold: '~$70K mcap',
    graduationTargetUsd: 70_000,
    quoteToken: 'SOL',
    lpHandling: 'Burned',
    migrationInstructions: ['graduate', 'migrate'],
    curveType: 'Cult Bonding Curve',
    badgeBg: 'bg-pink-950/60',
    badgeBorder: 'border-pink-800/80',
    badgeText: 'text-pink-400',
  },
};

/**
 * Returns true if the string denotes a recognized Solana launchpad.
 */
export function isSupportedLaunchpad(raw?: string | null): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const lower = raw.trim().toLowerCase();
  return (
    lower.includes('pump') ||
    lower.includes('moonshot') ||
    lower.includes('launchlab') ||
    lower.includes('letsbonk') ||
    lower.includes('met-dbc') ||
    lower.includes('believe') ||
    lower.includes('launchcoin') ||
    lower.includes('virtual') ||
    lower.includes('boop') ||
    lower.includes('stonkfun')
  );
}

/**
 * Resolves raw token properties or a launchpad string into a canonical LaunchpadConfig.
 */
export function resolveLaunchpad(
  target?: { launchpad?: string; mint?: string; id?: string } | string | null,
): LaunchpadConfig {
  if (!target) return LAUNCHPAD_CONFIGS['pump.fun'];

  const str =
    typeof target === 'string'
      ? target
      : (target.launchpad || target.mint || target.id || '');

  const lower = str.trim().toLowerCase();

  if (lower.includes('moonshot')) return LAUNCHPAD_CONFIGS.moonshot;
  if (lower.includes('letsbonk')) return LAUNCHPAD_CONFIGS.letsbonk;
  if (lower.includes('launchlab') || lower === 'raydium-launchlab') return LAUNCHPAD_CONFIGS.launchlab;
  if (lower.includes('met-dbc') || lower.includes('believe') || lower.includes('launchcoin')) {
    return LAUNCHPAD_CONFIGS.believe;
  }
  if (lower.includes('virtual')) return LAUNCHPAD_CONFIGS.virtuals;
  if (lower.includes('boop') || lower.includes('stonkfun')) return LAUNCHPAD_CONFIGS.boop;
  if (lower.includes('pump') || lower.endsWith('pump')) return LAUNCHPAD_CONFIGS['pump.fun'];

  return LAUNCHPAD_CONFIGS['pump.fun'];
}

export interface ProgressCalculationInputs {
  /** Invariant or account-level token reserves */
  realTokenReserves?: bigint;
  realSolReserves?: bigint;
  baselineTokenReserves?: bigint;
  /** Current SOL raised or reserves in pool */
  currentSolReserves?: number;
  /** Market cap in USD */
  marketCapUsd?: number;
  /** Virtual quote tokens raised (e.g. for Virtuals protocol) */
  quoteTokensRaised?: number;
  /** SOL price in USD (defaults to ~$140) */
  solPriceUsd?: number;
  complete?: boolean;
}

/**
 * Calculates progress fraction (0-1) towards graduation according to the specific launchpad.
 */
export function calculateLaunchpadProgress(
  launchpadId: LaunchpadId | string,
  inputs: ProgressCalculationInputs,
): number {
  if (inputs.complete) return 1;

  const config = LAUNCHPAD_CONFIGS[launchpadId as LaunchpadId] ?? resolveLaunchpad(launchpadId);

  // 1. If on-chain token reserves are provided and standard constant-product AMM
  if (inputs.realTokenReserves !== undefined && inputs.baselineTokenReserves && inputs.baselineTokenReserves > 0n) {
    const baseline = inputs.baselineTokenReserves;
    const sold = inputs.realTokenReserves >= baseline ? 0n : baseline - inputs.realTokenReserves;
    return Math.min(1, Math.max(0, Number(sold) / Number(baseline)));
  }

  // 2. Launchpad-specific thresholds:
  switch (config.id) {
    case 'moonshot': {
      // 500 SOL threshold
      if (inputs.currentSolReserves !== undefined && Number.isFinite(inputs.currentSolReserves)) {
        return Math.min(1, Math.max(0, inputs.currentSolReserves / 500));
      }
      if (inputs.marketCapUsd !== undefined && Number.isFinite(inputs.marketCapUsd)) {
        return Math.min(1, Math.max(0, inputs.marketCapUsd / (config.graduationTargetUsd || 100_000)));
      }
      break;
    }

    case 'launchlab': {
      // Default 85 SOL target
      const targetSol = config.graduationTargetSol || 85;
      if (inputs.currentSolReserves !== undefined && Number.isFinite(inputs.currentSolReserves)) {
        return Math.min(1, Math.max(0, inputs.currentSolReserves / targetSol));
      }
      if (inputs.marketCapUsd !== undefined && Number.isFinite(inputs.marketCapUsd)) {
        return Math.min(1, Math.max(0, inputs.marketCapUsd / (config.graduationTargetUsd || 69_000)));
      }
      break;
    }

    case 'letsbonk': {
      // ~411 SOL mcap threshold
      const targetSol = config.graduationTargetSol || 411;
      if (inputs.currentSolReserves !== undefined && Number.isFinite(inputs.currentSolReserves)) {
        return Math.min(1, Math.max(0, inputs.currentSolReserves / targetSol));
      }
      if (inputs.marketCapUsd !== undefined && Number.isFinite(inputs.marketCapUsd)) {
        return Math.min(1, Math.max(0, inputs.marketCapUsd / (config.graduationTargetUsd || 100_000)));
      }
      break;
    }

    case 'believe': {
      // $100,000 USD market cap threshold
      if (inputs.marketCapUsd !== undefined && Number.isFinite(inputs.marketCapUsd)) {
        return Math.min(1, Math.max(0, inputs.marketCapUsd / 100_000));
      }
      if (inputs.currentSolReserves !== undefined && Number.isFinite(inputs.currentSolReserves)) {
        const solPrice = inputs.solPriceUsd ?? 140;
        const usdValue = inputs.currentSolReserves * solPrice;
        return Math.min(1, Math.max(0, usdValue / 100_000));
      }
      break;
    }

    case 'virtuals': {
      // 42,000 $VIRTUAL tokens threshold
      if (inputs.quoteTokensRaised !== undefined && Number.isFinite(inputs.quoteTokensRaised)) {
        return Math.min(1, Math.max(0, inputs.quoteTokensRaised / 42_000));
      }
      if (inputs.marketCapUsd !== undefined && Number.isFinite(inputs.marketCapUsd)) {
        return Math.min(1, Math.max(0, inputs.marketCapUsd / 120_000));
      }
      break;
    }

    case 'boop': {
      // ~$70K market cap threshold
      if (inputs.marketCapUsd !== undefined && Number.isFinite(inputs.marketCapUsd)) {
        return Math.min(1, Math.max(0, inputs.marketCapUsd / (config.graduationTargetUsd || 70_000)));
      }
      break;
    }

    case 'pump.fun':
    default: {
      // 85 SOL / ~$69K target
      if (inputs.currentSolReserves !== undefined && Number.isFinite(inputs.currentSolReserves)) {
        return Math.min(1, Math.max(0, inputs.currentSolReserves / 85));
      }
      if (inputs.marketCapUsd !== undefined && Number.isFinite(inputs.marketCapUsd)) {
        return Math.min(1, Math.max(0, inputs.marketCapUsd / 69_000));
      }
      break;
    }
  }

  return 0;
}
