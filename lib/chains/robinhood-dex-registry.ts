import { CHAIN_CONFIGS, type DexConfig } from './chain-config';

export interface ResolvedRobinhoodDex {
  id: string;
  name: string;
  protocol: DexConfig['protocol'];
  factoryAddress?: string;
  routerAddress?: string;
  poolManagerAddress?: string;
  isLaunchpad: boolean;
}

const REGISTRY_BY_ID = new Map<string, DexConfig>(
  CHAIN_CONFIGS.robinhood.supportedDexes.map((d) => [d.id.toLowerCase(), d]),
);

const LAUNCHPAD_KEYWORDS = [
  'hoodit',
  'clanker',
  'virtuals',
  'bankr',
  'pons',
  'frontier',
  'o1',
  'mint-club',
  'kickstart',
  'clank',
  'long',
];

export function resolveRobinhoodDex(dexId?: string | null): ResolvedRobinhoodDex {
  const raw = (dexId || '').trim().toLowerCase();
  if (!raw) {
    return {
      id: 'robinhood-dex',
      name: 'Robinhood DEX',
      protocol: 'amm',
      isLaunchpad: false,
    };
  }

  const exact = REGISTRY_BY_ID.get(raw);
  if (exact) {
    return {
      id: exact.id,
      name: exact.name,
      protocol: exact.protocol,
      factoryAddress: exact.factoryAddress,
      routerAddress: exact.routerAddress,
      poolManagerAddress: exact.poolManagerAddress,
      isLaunchpad: Boolean(exact.isLaunchpad),
    };
  }

  const normalized = raw.replace(/-robinhood$/, '').replace(/-/g, ' ');
  const isLaunchpad = LAUNCHPAD_KEYWORDS.some((kw) => raw.includes(kw));
  let protocol: DexConfig['protocol'] = isLaunchpad ? 'launchpad' : 'amm';
  if (raw.includes('v4')) protocol = 'uniswap-v4';
  else if (raw.includes('v3') || raw.includes('clmm') || raw.includes('dlmm')) protocol = 'uniswap-v3';
  else if (raw.includes('v2')) protocol = 'uniswap-v2';

  const friendlyName = normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.startsWith('v') && /^v\d/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');

  return {
    id: raw,
    name: friendlyName || 'Robinhood DEX',
    protocol,
    isLaunchpad,
  };
}

export function getRobinhoodDexRegistry(): DexConfig[] {
  return [...CHAIN_CONFIGS.robinhood.supportedDexes];
}

