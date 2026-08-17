import type { DiscoveryFilter } from './types';

export interface FilterPreset {
  id: string;
  name: string;
  description: string;
  icon: string; // Emoji or icon identifier
  filters: Partial<DiscoveryFilter>;
}

/**
 * Predefined filter presets for quick discovery.
 * These are presets — NOT investment recommendations.
 */
export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'fresh_launches',
    name: 'Fresh Launches',
    description: 'Tokens under 60 minutes old',
    icon: '🆕',
    filters: {
      ageMinutesMax: 60,
    },
  },
  {
    id: 'early_momentum',
    name: 'Early Momentum',
    description: 'Strong price and volume acceleration',
    icon: '🚀',
    filters: {
      priceChangeMin: 20,
      volumeChangeMin: 100,
    },
  },
  {
    id: 'high_liquidity',
    name: 'High Liquidity',
    description: 'Pools with $1M+ liquidity depth',
    icon: '💧',
    filters: {
      liquidityMin: 1_000_000,
    },
  },
  {
    id: 'high_volume',
    name: 'High Volume',
    description: '24h volume exceeding $500K',
    icon: '📊',
    filters: {
      volumeMin: 500_000,
    },
  },
  {
    id: 'low_market_cap',
    name: 'Low Market Cap',
    description: 'Market cap under $5M',
    icon: '🔬',
    filters: {
      marketCapMax: 5_000_000,
    },
  },
  {
    id: 'conservative',
    name: 'Conservative',
    description: 'High liquidity, established holder base',
    icon: '🛡️',
    filters: {
      liquidityMin: 5_000_000,
      holdersMin: 10_000,
      priceChangeMin: -10,
      priceChangeMax: 30,
    },
  },
  {
    id: 'high_activity',
    name: 'High Activity',
    description: 'Elevated trade count and buy pressure',
    icon: '⚡',
    filters: {
      volumeChangeMin: 200,
      discoveryScoreMin: 50,
    },
  },
];

/**
 * Get a preset by its ID.
 */
export function getPresetById(id: string): FilterPreset | undefined {
  return FILTER_PRESETS.find((p) => p.id === id);
}
