export type SupportedChainKey = 'solana' | 'robinhood';
export type ChainType = 'solana' | 'evm';

export interface DexConfig {
  id: string;
  name: string;
  protocol: 'uniswap-v2' | 'uniswap-v3' | 'uniswap-v4' | 'clmm' | 'amm' | 'launchpad';
  factoryAddress?: string;
  routerAddress?: string;
  poolManagerAddress?: string;
  isLaunchpad?: boolean;
}

export interface ChainConfig {
  key: SupportedChainKey;
  chainId: string | number;
  chainIdHex?: string;
  chainName: string;
  shortName: string;
  chainType: ChainType;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
    wrappedAddress: string;
  };
  stablecoinAddress?: string;
  rpcUrl: string;
  testnetRpcUrl?: string;
  websocketUrl?: string;
  explorerUrl: string;
  testnetExplorerUrl?: string;
  supportedDexes: DexConfig[];
  supportedFeatures: {
    discovery: boolean;
    chart: boolean;
    liveTrades: boolean;
    audit: boolean;
    holders: boolean;
    evmWallet: boolean;
    solanaWallet: boolean;
    swapExecution: 'enabled' | 'router-dependent' | 'unavailable';
    bondingCurveColumns: boolean;
  };
  providerConfiguration: {
    geckoterminalNetwork?: string;
    dexscreenerChainId: string;
    goplusChainId?: string;
    birdeyeSupported: boolean;
    jupiterSupported: boolean;
  };
}

export const SOLANA_MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export const ROBINHOOD_CHAIN_ID = 4663;
export const ROBINHOOD_CHAIN_ID_HEX = '0x1237';
export const ROBINHOOD_TESTNET_CHAIN_ID = 46630;
export const ROBINHOOD_TESTNET_CHAIN_ID_HEX = '0xb626';

export const ROBINHOOD_WETH_ADDRESS = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73';
export const ROBINHOOD_USDG_ADDRESS = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168';
export const ROBINHOOD_L2_GATEWAY_ROUTER = '0x1E324B9316138CA9a73F960213621AD1aaf01B89';
export const ROBINHOOD_L2_ERC20_GATEWAY = '0xfd9b17206278C16DdaacF6AC8f05dBf97EdCb31e';
export const ROBINHOOD_PONS_V2_FACTORY = '0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e';
export const ROBINHOOD_PONS_V2_LAUNCH_FORWARDER = '0xe33e9e479df8802cb0866d5d05258bec4cf62948';
export const ROBINHOOD_PONS_V2_LOCKER = '0x267444d099b10fb5ed7c3cc7b7c767adca574952';
export const ROBINHOOD_PONS_V2_MEME_HOOK = '0xe5e702641ea86f4ae6cc3cdaed2b886f976be044';
export const ROBINHOOD_UNISWAP_V3_FACTORY = '0x1F7d7550B1B028f7571e69A784071F0205fD2efA';
export const ROBINHOOD_UNISWAP_V4_POOL_MANAGER = '0x8366a39CC670B4001A1121B8F6A443A643e40951';
export const ROBINHOOD_UNISWAP_V4_POSITION_MANAGER = '0x58daec3116aae6d93017baaea7749052e8a04fa7';
export const ROBINHOOD_UNISWAP_UNIVERSAL_ROUTER = '0x8876789976decbfcbbbe364623c63652db8c0904';
export const ROBINHOOD_PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

export const CHAIN_CONFIGS: Record<SupportedChainKey, ChainConfig> = {
  solana: {
    key: 'solana',
    chainId: 'solana-mainnet',
    chainName: 'Solana',
    shortName: 'SOL',
    chainType: 'solana',
    nativeCurrency: {
      name: 'Solana',
      symbol: 'SOL',
      decimals: 9,
      wrappedAddress: 'So11111111111111111111111111111111111111112',
    },
    rpcUrl:
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
      'https://api.mainnet-beta.solana.com',
    explorerUrl: 'https://solscan.io',
    supportedDexes: [
      { id: 'pumpfun', name: 'Pump.fun', protocol: 'launchpad', isLaunchpad: true },
      { id: 'pumpswap', name: 'PumpSwap', protocol: 'amm' },
      { id: 'raydium', name: 'Raydium', protocol: 'amm' },
      { id: 'meteora', name: 'Meteora', protocol: 'clmm' },
      { id: 'orca', name: 'Orca', protocol: 'clmm' },
    ],
    supportedFeatures: {
      discovery: true,
      chart: true,
      liveTrades: true,
      audit: true,
      holders: true,
      evmWallet: false,
      solanaWallet: true,
      swapExecution: 'enabled',
      bondingCurveColumns: true,
    },
    providerConfiguration: {
      dexscreenerChainId: 'solana',
      birdeyeSupported: true,
      jupiterSupported: true,
    },
  },
  robinhood: {
    key: 'robinhood',
    chainId: ROBINHOOD_CHAIN_ID,
    chainIdHex: ROBINHOOD_CHAIN_ID_HEX,
    chainName: 'Robinhood Chain',
    shortName: 'ROBINHOOD',
    chainType: 'evm',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
      wrappedAddress: ROBINHOOD_WETH_ADDRESS,
    },
    stablecoinAddress: ROBINHOOD_USDG_ADDRESS,
    rpcUrl:
      process.env.ROBINHOOD_RPC_URL ||
      process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL ||
      'https://rpc.mainnet.chain.robinhood.com',
    testnetRpcUrl:
      process.env.ROBINHOOD_TESTNET_RPC_URL ||
      'https://rpc.testnet.chain.robinhood.com',
    websocketUrl: process.env.ROBINHOOD_WS_URL || undefined,
    explorerUrl: 'https://robinhoodchain.blockscout.com',
    testnetExplorerUrl: 'https://explorer.testnet.chain.robinhood.com',
    supportedDexes: [
      {
        id: 'uniswap-v2-robinhood',
        name: 'Uniswap V2',
        protocol: 'uniswap-v2',
        factoryAddress: '0x8bCEaa40B9ACDFAEDf85adf4ff01F5Ad6517937F',
      },
      {
        id: 'uniswap-v3-robinhood',
        name: 'Uniswap V3',
        protocol: 'uniswap-v3',
        factoryAddress: ROBINHOOD_UNISWAP_V3_FACTORY,
        routerAddress: ROBINHOOD_UNISWAP_UNIVERSAL_ROUTER,
      },
      {
        id: 'uniswap-v4-robinhood',
        name: 'Uniswap V4',
        protocol: 'uniswap-v4',
        poolManagerAddress: ROBINHOOD_UNISWAP_V4_POOL_MANAGER,
        routerAddress: ROBINHOOD_UNISWAP_UNIVERSAL_ROUTER,
      },
      {
        id: 'ramses-v3-robinhood',
        name: 'Ramses V3',
        protocol: 'clmm',
        factoryAddress: '0xe0C4cEB92d08Ca985bB70fE0a22feb121a9854a8',
      },
      { id: 'robinswap', name: 'RobinSwap', protocol: 'amm' },
      { id: 'swaphood-finance-v2', name: 'SwapHood Finance', protocol: 'amm' },
      { id: 'pancakeswap-v3-robinhood', name: 'PancakeSwap V3', protocol: 'clmm' },
      { id: 'sushiswap-v3-robinhood', name: 'SushiSwap V3', protocol: 'clmm' },
      { id: 'aero-slipstream-robinhood', name: 'Aero Slipstream', protocol: 'clmm', isLaunchpad: false },
      { id: 'ramses-v3-robinhood', name: 'Ramses V3', protocol: 'clmm', isLaunchpad: false },
      { id: 'uniswap-pools-trade', name: 'Uniswap Pools', protocol: 'amm', isLaunchpad: false },
      { id: 'pons-v2-dex', name: 'Pons V2 DEX', protocol: 'amm', isLaunchpad: false },
      {
        id: 'pons-v2',
        name: 'Pons V2',
        protocol: 'launchpad',
        factoryAddress: '0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e',
        isLaunchpad: true,
      },
      { id: 'hoodit', name: 'Hoodit', protocol: 'launchpad', isLaunchpad: true },
      { id: 'clanker-robinhood', name: 'Clanker', protocol: 'launchpad', isLaunchpad: true },
      { id: 'virtuals-robinhood', name: 'Virtuals', protocol: 'launchpad', isLaunchpad: true },
      { id: 'bankr-robinhood', name: 'Bankr', protocol: 'launchpad', isLaunchpad: true },
      { id: 'pons-dot-family', name: 'Pons V1', protocol: 'launchpad', isLaunchpad: true },
      { id: 'easya-kickstart-robinhood', name: 'EasyA Kickstart', protocol: 'launchpad', isLaunchpad: true },
      { id: 'clank-trade', name: 'Clank.trade', protocol: 'launchpad', isLaunchpad: true },
      { id: 'long-xyz', name: 'Long.xyz', protocol: 'launchpad', isLaunchpad: true },
      { id: 'frontier-fun', name: 'Frontier.fun', protocol: 'launchpad', isLaunchpad: true },
      { id: 'o1-launchpad-robinhood', name: 'o1 Launchpad', protocol: 'launchpad', isLaunchpad: true },
      { id: 'mint-club-robinhood', name: 'Mint Club', protocol: 'launchpad', isLaunchpad: true },
    ],
    supportedFeatures: {
      discovery: true,
      chart: true,
      liveTrades: true,
      audit: true,
      holders: true,
      evmWallet: true,
      solanaWallet: false,
      swapExecution: 'router-dependent',
      bondingCurveColumns: true,
    },
    providerConfiguration: {
      geckoterminalNetwork: 'robinhood',
      dexscreenerChainId: 'robinhood',
      goplusChainId: '4663',
      birdeyeSupported: false,
      jupiterSupported: false,
    },
  },
};

export function isSupportedChain(chain?: string | null): chain is SupportedChainKey {
  if (!chain) return false;
  const lower = chain.toLowerCase();
  return lower === 'solana' || lower === 'robinhood';
}

export function normalizeChainKey(chain?: string | null): SupportedChainKey {
  if (chain && chain.toLowerCase() === 'robinhood') return 'robinhood';
  return 'solana';
}

export function getChainConfig(chain?: string | null): ChainConfig {
  return CHAIN_CONFIGS[normalizeChainKey(chain)];
}

export function isEvmAddress(value?: string | null): boolean {
  return typeof value === 'string' && EVM_ADDRESS_RE.test(value.trim());
}

export function isSolanaAddress(value?: string | null): boolean {
  return typeof value === 'string' && SOLANA_MINT_RE.test(value.trim());
}

export function isValidTokenAddressForChain(chain?: string | null, address?: string | null): boolean {
  if (!address) return false;
  const key = normalizeChainKey(chain);
  return key === 'robinhood' ? isEvmAddress(address) : isSolanaAddress(address);
}

export function normalizeTokenAddress(chain: string | null | undefined, address: string): string {
  const key = normalizeChainKey(chain);
  const trimmed = address.trim();
  return key === 'robinhood' ? trimmed.toLowerCase() : trimmed;
}

export function formatCompositeTokenKey(chain: string | null | undefined, address: string): string {
  const key = normalizeChainKey(chain);
  return `${key}:${normalizeTokenAddress(key, address)}`;
}

export function getExplorerTokenUrl(chain: string | null | undefined, address: string): string {
  const cfg = getChainConfig(chain);
  if (cfg.key === 'robinhood') {
    return `${cfg.explorerUrl}/token/${address}`;
  }
  return `${cfg.explorerUrl}/token/${address}`;
}

export function getExplorerAddressUrl(chain: string | null | undefined, address: string): string {
  const cfg = getChainConfig(chain);
  if (cfg.key === 'robinhood') {
    return `${cfg.explorerUrl}/address/${address}`;
  }
  return `${cfg.explorerUrl}/account/${address}`;
}

export function getExplorerTxUrl(chain: string | null | undefined, txHash: string): string {
  const cfg = getChainConfig(chain);
  return `${cfg.explorerUrl}/tx/${txHash}`;
}

