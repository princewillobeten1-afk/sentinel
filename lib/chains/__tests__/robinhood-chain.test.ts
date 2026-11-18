import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import {
  CHAIN_CONFIGS,
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_WETH_ADDRESS,
  ROBINHOOD_USDG_ADDRESS,
  ROBINHOOD_UNISWAP_UNIVERSAL_ROUTER,
  isEvmAddress,
  isSolanaAddress,
  isValidTokenAddressForChain,
  normalizeTokenAddress,
  formatCompositeTokenKey,
  getExplorerTokenUrl,
  getExplorerAddressUrl,
  getExplorerTxUrl,
} from '@/lib/chains/chain-config';
import {
  EVM_ZERO_ADDRESS,
  buildUniversalRouterV3SwapInput,
  buildUniversalRouterV4SwapInput,
  computeV4PoolId,
  encodeErc20Approve,
  encodePermit2Approve,
  encodePonsV2Buy,
  encodePonsV2Sell,
  encodeUniversalRouterExecute,
  keccak256Hex,
} from '@/lib/chains/evm-abi';
import { resolveRobinhoodDex } from '@/lib/chains/robinhood-dex-registry';
import {
  computeConcentratedLiquiditySwap,
  computePonsV2CurveSwap,
} from '@/lib/trading/robinhood-swap';
import {
  analyzePonsLaunchBuys,
  parsePonsCurveBuyLogs,
} from '@/lib/market/enrichment/robinhood-pons-sniper';
import {
  ROBINHOOD_EVENT_TOPICS,
  decodeRobinhoodLog,
} from '@/lib/market/live/robinhood-event-stream';
import { parseDiscoveryQuery } from '@/lib/discovery/query-model';
import {
  mapGeckoPoolToDiscoveryToken,
  applyGoPlusSecurityToToken,
  applyPonsV2StateToToken,
  mergeRobinhoodNewPairs,
  selectFinalStretchRobinhoodTokens,
  selectMigratedRobinhoodTokens,
} from '@/lib/discovery/robinhood-feed';
import { isValidChartAddress } from '@/lib/market/chart-model';
import { isTokenAudit } from '@/lib/trading/audit-model';

const SAMPLE_SOL_MINT = 'So11111111111111111111111111111111111111112';
const SAMPLE_EVM_TOKEN = '0x39dbEd3A2Bd333467115de45665cC57F813C4571';
const SAMPLE_POOL_ADDR = '0x44f4d8b35e9fbcb67f3d5646f21a1d4f4bf925a1';

describe('Robinhood Chain & Multi-Chain Config', () => {
  it('defines Solana and Robinhood Chain configs without dropping Solana', () => {
    expect(CHAIN_CONFIGS.solana.chainType).toBe('solana');
    expect(CHAIN_CONFIGS.solana.supportedFeatures.solanaWallet).toBe(true);
    expect(CHAIN_CONFIGS.solana.supportedFeatures.bondingCurveColumns).toBe(true);

    expect(CHAIN_CONFIGS.robinhood.chainId).toBe(ROBINHOOD_CHAIN_ID);
    expect(CHAIN_CONFIGS.robinhood.chainId).toBe(4663);
    expect(CHAIN_CONFIGS.robinhood.chainType).toBe('evm');
    expect(CHAIN_CONFIGS.robinhood.nativeCurrency.symbol).toBe('ETH');
    expect(CHAIN_CONFIGS.robinhood.supportedFeatures.evmWallet).toBe(true);
    expect(CHAIN_CONFIGS.robinhood.supportedFeatures.bondingCurveColumns).toBe(true);
  });

  it('validates chain-specific token addresses and composite keys', () => {
    expect(isEvmAddress(SAMPLE_EVM_TOKEN)).toBe(true);
    expect(isEvmAddress(SAMPLE_SOL_MINT)).toBe(false);
    expect(isSolanaAddress(SAMPLE_SOL_MINT)).toBe(true);
    expect(isSolanaAddress(SAMPLE_EVM_TOKEN)).toBe(false);

    expect(isValidTokenAddressForChain('robinhood', SAMPLE_EVM_TOKEN)).toBe(true);
    expect(isValidTokenAddressForChain('robinhood', SAMPLE_SOL_MINT)).toBe(false);
    expect(isValidTokenAddressForChain('solana', SAMPLE_SOL_MINT)).toBe(true);
    expect(isValidTokenAddressForChain('solana', SAMPLE_EVM_TOKEN)).toBe(false);

    expect(normalizeTokenAddress('robinhood', SAMPLE_EVM_TOKEN)).toBe(
      SAMPLE_EVM_TOKEN.toLowerCase(),
    );
    expect(formatCompositeTokenKey('robinhood', SAMPLE_EVM_TOKEN)).toBe(
      `robinhood:${SAMPLE_EVM_TOKEN.toLowerCase()}`,
    );
    expect(formatCompositeTokenKey('solana', SAMPLE_SOL_MINT)).toBe(`solana:${SAMPLE_SOL_MINT}`);
  });

  it('builds chain-specific explorer URLs', () => {
    expect(getExplorerTokenUrl('robinhood', SAMPLE_EVM_TOKEN)).toBe(
      `https://robinhoodchain.blockscout.com/token/${SAMPLE_EVM_TOKEN}`,
    );
    expect(getExplorerAddressUrl('robinhood', SAMPLE_EVM_TOKEN)).toBe(
      `https://robinhoodchain.blockscout.com/address/${SAMPLE_EVM_TOKEN}`,
    );
    expect(getExplorerTxUrl('robinhood', '0xabc')).toBe(
      'https://robinhoodchain.blockscout.com/tx/0xabc',
    );
    expect(getExplorerAddressUrl('solana', SAMPLE_SOL_MINT)).toBe(
      `https://solscan.io/account/${SAMPLE_SOL_MINT}`,
    );
  });
});

describe('Robinhood Chain DEX Registry', () => {
  it('resolves known Robinhood DEXs and launchpads accurately', () => {
    const univ3 = resolveRobinhoodDex('uniswap-v3-robinhood');
    expect(univ3.name).toContain('Uniswap');
    expect(univ3.protocol).toBe('uniswap-v3');
    expect(univ3.isLaunchpad).toBe(false);

    const ramses = resolveRobinhoodDex('ramses-v3-robinhood');
    expect(ramses.protocol).toBe('clmm');

    const hoodit = resolveRobinhoodDex('hoodit-robinhood');
    expect(hoodit.isLaunchpad).toBe(true);

    const ponsV2 = resolveRobinhoodDex('pons-v2');
    expect(ponsV2.name).toBe('Pons V2');
    expect(ponsV2.isLaunchpad).toBe(true);

    const ponsV2Dex = resolveRobinhoodDex('pons-v2-dex');
    expect(ponsV2Dex.name).toBe('Pons V2 DEX');
    expect(ponsV2Dex.isLaunchpad).toBe(false);

    const fallback = resolveRobinhoodDex('custom-dex-v4-robinhood');
    expect(fallback.protocol).toBe('uniswap-v4');
  });
});

describe('Discovery Query & Robinhood Feed Normalization', () => {
  it('parses chain=robinhood and chain=solana queries via schema', () => {
    const rhUrl = new URL('http://localhost/api/v1/discovery/new?chain=robinhood&timeWindow=1h');
    const rhParsed = parseDiscoveryQuery(rhUrl);
    expect(rhParsed.chain).toBe('robinhood');
    expect(rhParsed.timeWindow).toBe('1h');

    const solUrl = new URL('http://localhost/api/v1/discovery/new?chain=solana');
    const solParsed = parseDiscoveryQuery(solUrl);
    expect(solParsed.chain).toBe('solana');
  });

  it('maps GeckoTerminal pool & GoPlus security without inventing missing fields', () => {
    const tokenMap = new Map([
      [
        `robinhood_${SAMPLE_EVM_TOKEN.toLowerCase()}`,
        {
          id: `robinhood_${SAMPLE_EVM_TOKEN.toLowerCase()}`,
          type: 'token' as const,
          attributes: {
            address: SAMPLE_EVM_TOKEN.toLowerCase(),
            name: 'Robin Test',
            symbol: 'RTEST',
            decimals: 18,
            image_url: null,
          },
        },
      ],
      [
        `robinhood_${ROBINHOOD_USDG_ADDRESS.toLowerCase()}`,
        {
          id: `robinhood_${ROBINHOOD_USDG_ADDRESS.toLowerCase()}`,
          type: 'token' as const,
          attributes: {
            address: ROBINHOOD_USDG_ADDRESS.toLowerCase(),
            name: 'Global Dollar',
            symbol: 'USDG',
            decimals: 6,
            image_url: null,
          },
        },
      ],
    ]);

    const pool = {
      id: `robinhood_${SAMPLE_POOL_ADDR}`,
      type: 'pool' as const,
      attributes: {
        address: SAMPLE_POOL_ADDR,
        name: 'RTEST / USDG',
        pool_created_at: new Date(Date.now() - 15 * 60_000).toISOString(),
        base_token_price_usd: '0.0125',
        quote_token_price_usd: '1.0',
        market_cap_usd: '125000',
        fdv_usd: '125000',
        reserve_in_usd: '48500',
        price_change_percentage: { m5: '4.2', h1: '18.5' },
        volume_usd: { m5: '1200', h1: '8400', h24: '22000' },
        transactions: {
          m5: { buys: 8, sells: 3 },
          h1: { buys: 42, sells: 19 },
          h24: { buys: 110, sells: 60 },
        },
      },
      relationships: {
        base_token: { data: { id: `robinhood_${SAMPLE_EVM_TOKEN.toLowerCase()}` } },
        quote_token: { data: { id: `robinhood_${ROBINHOOD_USDG_ADDRESS.toLowerCase()}` } },
        dex: { data: { id: 'uniswap-v3-robinhood' } },
      },
    };

    const mapped = mapGeckoPoolToDiscoveryToken(pool, tokenMap);
    expect(mapped).not.toBeNull();
    expect(mapped?.chain).toBe('robinhood');
    expect(mapped?.mint).toBe(SAMPLE_EVM_TOKEN.toLowerCase());
    expect(mapped?.id).toBe(`robinhood:${SAMPLE_EVM_TOKEN.toLowerCase()}`);
    expect(mapped?.liquidityPoolAddress).toBe(SAMPLE_POOL_ADDR);
    expect(mapped?.migratedPool).toBe(SAMPLE_POOL_ADDR);
    expect(mapped?.migratedDex).toContain('Uniswap');
    // Missing GoPlus security should stay pending/undefined, never fabricated
    expect(mapped?.auditPending).toBe(true);
    expect(mapped?.holdersCount).toBeUndefined();

    const secured = applyGoPlusSecurityToToken(mapped!, {
      is_open_source: '1',
      is_mintable: '0',
      is_blacklisted: '0',
      transfer_pausable: '0',
      holder_count: '245',
      creator_address: ROBINHOOD_WETH_ADDRESS,
      creator_percent: '0.035',
      holders: [
        { address: '0x1111111111111111111111111111111111111111', percent: '0.12' },
        { address: '0x2222222222222222222222222222222222222222', percent: '0.08' },
      ],
      lp_holders: [{ address: '0x3333333333333333333333333333333333333333', is_locked: 1, percent: '0.95' }],
    });

    expect(secured.auditPending).toBe(false);
    expect(secured.holdersCount).toBe(245);
    expect(secured.isMintRenounced).toBe(true);
    expect(secured.isFreezeDisabled).toBe(true);
    expect(secured.lpLockedPct).toBeCloseTo(95, 1);
    expect(secured.securityEvidence?.status).toBe('measured');
  });
});

describe('Chart & Audit Multi-Chain Validators', () => {
  it('validates chart addresses separately for robinhood vs solana', () => {
    expect(isValidChartAddress('robinhood', SAMPLE_EVM_TOKEN)).toBe(true);
    expect(isValidChartAddress('robinhood', SAMPLE_SOL_MINT)).toBe(false);
    expect(isValidChartAddress('solana', SAMPLE_SOL_MINT)).toBe(true);
    expect(isValidChartAddress('solana', SAMPLE_EVM_TOKEN)).toBe(false);
  });

  it('accepts valid Robinhood TokenAudit snapshots case-insensitively', () => {
    const sampleAudit = {
      token: SAMPLE_EVM_TOKEN.toLowerCase(),
      chain: 'robinhood',
      symbol: 'RTEST',
      creatorAddress: ROBINHOOD_WETH_ADDRESS.toLowerCase(),
      mintAuthorityDisabled: true,
      freezeAuthorityDisabled: true,
      lpTokensBurned: null,
      liquidityLocked: true,
      honeypotTaxZero: true,
      top10HoldersPct: 24.5,
      devBalancePct: 1.5,
      organicScore: null,
      organicScoreLabel: null,
      devMints: null,
      devMigrations: null,
      migrationRatePct: null,
      snipersPct: null,
      insidersPct: null,
      bundlersPct: null,
      sniperCount: null,
      bundlerCount: null,
      insiderCount: null,
      devCount: null,
      holderTop10Pct: 24.5,
      totalHolders: 120,
      holderAuditPending: false,
      rugRisk: null,
      auditVersion: 'goplus-4663',
      isContractVerified: true,
      isProxy: false,
      buyTaxPct: 0,
      sellTaxPct: 0,
      marketEvidence: { status: 'measured', source: 'geckoterminal', observedAt: '2026-01-01T00:00:00Z' },
      ownershipEvidence: { status: 'measured', source: 'goplus-evm-4663', observedAt: '2026-01-01T00:00:00Z' },
      securityEvidence: { status: 'measured', source: 'goplus-evm-4663', observedAt: '2026-01-01T00:00:00Z' },
      creatorEvidence: { status: 'unavailable', source: 'goplus-evm-4663', observedAt: '2026-01-01T00:00:00Z' },
      lifecycleEvidence: { status: 'unavailable', source: 'geckoterminal', observedAt: '2026-01-01T00:00:00Z' },
      liquidityEvidence: { status: 'measured', source: 'goplus-evm-4663', observedAt: '2026-01-01T00:00:00Z' },
      top10Evidence: { status: 'measured', source: 'goplus-evm-4663', observedAt: '2026-01-01T00:00:00Z' },
      devBalanceEvidence: { status: 'measured', source: 'goplus-evm-4663', observedAt: '2026-01-01T00:00:00Z' },
      mintAuthorityEvidence: { status: 'measured', source: 'goplus-evm-4663', observedAt: '2026-01-01T00:00:00Z' },
      freezeAuthorityEvidence: { status: 'measured', source: 'goplus-evm-4663', observedAt: '2026-01-01T00:00:00Z' },
      organicEvidence: { status: 'unavailable', source: 'goplus-evm-4663', observedAt: '2026-01-01T00:00:00Z' },
      historyEvidence: { status: 'unavailable', source: 'goplus-evm-4663', observedAt: '2026-01-01T00:00:00Z' },
      coverage: 'goplus-4663',
      lastAuditedAt: '2026-01-01T00:00:00Z',
    };
    expect(isTokenAudit(sampleAudit, SAMPLE_EVM_TOKEN)).toBe(true);
  });
});

describe('Robinhood Pons V2 Bonding Curve & Migrated Filtering', () => {
  it('computes real bonding progress and graduation transitions for Pons V2 pools', () => {
    const tokenMap = new Map([
      [
        'robinhood_0x6dbe95076584f869dd09a44131e9a3c13f34d7d6',
        {
          id: 'robinhood_0x6dbe95076584f869dd09a44131e9a3c13f34d7d6',
          type: 'token' as const,
          attributes: {
            address: '0x6dbe95076584f869dd09a44131e9a3c13f34d7d6',
            name: 'MorphToken',
            symbol: 'MORPH',
          },
        },
      ],
      [
        'robinhood_0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        {
          id: 'robinhood_0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          type: 'token' as const,
          attributes: {
            address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
            name: 'Wrapped Ether',
            symbol: 'WETH',
          },
        },
      ],
    ]);

    const mapped = mapGeckoPoolToDiscoveryToken(
      {
        id: 'robinhood_0x612229828e1d55628693b0220b16eaeab8b33572',
        type: 'pool' as const,
        attributes: {
          address: '0x612229828e1d55628693b0220b16eaeab8b33572',
          name: 'MORPH / WETH',
          pool_created_at: new Date(Date.now() - 45 * 60_000).toISOString(),
          base_token_price_usd: '0.000033',
          fdv_usd: '33000',
          reserve_in_usd: '16500',
          volume_usd: { m5: '500', h1: '4200', h24: '9500' },
          transactions: { m5: { buys: 4, sells: 1 }, h1: { buys: 20, sells: 8 }, h24: { buys: 45, sells: 22 } },
        },
        relationships: {
          base_token: { data: { id: 'robinhood_0x6dbe95076584f869dd09a44131e9a3c13f34d7d6' } },
          quote_token: { data: { id: 'robinhood_0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' } },
          dex: { data: { id: 'pons-v2' } },
        },
      },
      tokenMap,
    );

    expect(mapped).not.toBeNull();
    expect(mapped?.launchpad).toBe('pons-v2');
    expect(mapped?.migratedPool).toBeUndefined();
    expect(mapped?.migratedAt).toBeUndefined();
    expect(mapped?.launchpadInfo?.destinationDex).toBe('Uniswap V4');
    expect(mapped?.launchpadInfo?.graduationThreshold).toBe('4.2 ETH');

    const enrichedActive = applyPonsV2StateToToken(mapped!, {
      poolAddress: '0x612229828e1d55628693b0220b16eaeab8b33572',
      graduated: false,
      isNativeQuote: true,
      realQuoteReserveRaw: 2_940_000_000_000_000_000n,
      graduationThresholdRaw: 4_200_000_000_000_000_000n,
      realQuoteEth: 2.94,
      graduationThresholdEth: 4.2,
      progressPct: 70,
    });

    expect(enrichedActive.bondingCurveProgress).toBe(70);
    expect(enrichedActive.bondingStatus).toBe('migrating');
    expect(enrichedActive.lifecycleState).toBe('final_stretch');
    expect(enrichedActive.graduationTarget).toBe('4.2 ETH');

    const enrichedGraduated = applyPonsV2StateToToken(mapped!, {
      poolAddress: '0x612229828e1d55628693b0220b16eaeab8b33572',
      graduated: true,
      isNativeQuote: true,
      realQuoteReserveRaw: 0n,
      graduationThresholdRaw: 4_200_000_000_000_000_000n,
      progressPct: 100,
    });

    expect(enrichedGraduated.bondingStatus).toBe('graduated');
    expect(enrichedGraduated.lifecycleState).toBe('migrated');
    expect(enrichedGraduated.bondingCurveProgress).toBeUndefined();
  });

  it('filters Final Stretch and Migrated columns without returning WETH or stale dead curves', () => {
    const baseToken = {
      id: 'robinhood:0x1',
      name: 'Sample',
      symbol: 'SMP',
      mint: '0x1111111111111111111111111111111111111111',
      chain: 'robinhood',
      source: 'Pons V2',
      ageMinutes: 60,
      ageFormatted: '1h',
      priceUsd: '0.001',
      priceChange1m: 0,
      priceChange5m: 0,
      priceChange15m: 0,
      priceChange1h: 0,
      priceChange24h: 0,
      volume5mUsd: '100',
      volume1hUsd: '500',
      volume24hUsd: '1000',
      volumeChange15mPct: 0,
      liquidityUsd: '12000',
      liquidityChange1hPct: 0,
      marketCapUsd: '20000',
      buysCount: 10,
      sellsCount: 5,
      txCount15m: 5,
      txCount1h: 15,
      buySellImbalancePct: 33,
      buyPressureRatio: 0.66,
      txAccelerationPct: 0,
      isNewToken: false,
      discoveryScore: {} as any,
    };

    const finalStretch = selectFinalStretchRobinhoodTokens([
      { ...baseToken, mint: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', symbol: 'DEAD_OLD', launchpad: 'pons-dot-family', ageMinutes: 150_000, bondingStatus: 'bonding' },
      { ...baseToken, mint: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', symbol: 'ALREADY_GRAD', launchpad: 'pons-v2', bondingStatus: 'graduated', lifecycleState: 'migrated' },
      { ...baseToken, mint: '0xcccccccccccccccccccccccccccccccccccccccc', symbol: 'LOW_PCT', launchpad: 'pons-v2', bondingCurveProgress: 2.5, bondingStatus: 'bonding' },
      { ...baseToken, mint: '0xdddddddddddddddddddddddddddddddddddddddd', symbol: 'MID_PCT', launchpad: 'pons-v2', bondingCurveProgress: 56.2, bondingStatus: 'migrating' },
      { ...baseToken, mint: '0x1111222233334444555566667777888899990001', symbol: 'HIGH_PCT', launchpad: 'pons-v2', bondingCurveProgress: 74.8, bondingStatus: 'migrating' },
      { ...baseToken, mint: '0xffffffffffffffffffffffffffffffffffffffff', symbol: 'SIXTY_PCT', launchpad: 'pons-v2', bondingCurveProgress: 61.1, bondingStatus: 'migrating' },
    ]);

    expect(finalStretch.map((t) => t.symbol)).toEqual(['HIGH_PCT', 'SIXTY_PCT', 'MID_PCT']);

    const migrated = selectMigratedRobinhoodTokens([
      { ...baseToken, mint: '0x0000000000000000000000000000000000000000', symbol: 'WETH', launchpad: undefined, ageMinutes: 180_000, liquidityUsd: '7000000', marketCapUsd: '4800000000', migratedAt: 1000 },
      { ...baseToken, mint: '0x0bd7d308f8e1639fab988df18a8011f41eacad73', symbol: 'WETH', launchpad: undefined, ageMinutes: 120_000, liquidityUsd: '1800000', marketCapUsd: '76000000', migratedAt: 1000 },
      { ...baseToken, mint: '0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec', symbol: 'NVDA', launchpad: undefined, ageMinutes: 140_000, liquidityUsd: '2100000', marketCapUsd: '20000000', migratedAt: 1000 },
      { ...baseToken, mint: '0x1234000000000000000000000000000000000001', symbol: 'ON_CURVE', launchpad: 'pons-v2', ageMinutes: 30, liquidityUsd: '12000', marketCapUsd: '20000', migratedAt: 5000 },
      { ...baseToken, mint: '0x1234000000000000000000000000000000000002', symbol: 'TINY_SEED', launchpad: undefined, ageMinutes: 20, liquidityUsd: '49', marketCapUsd: '32000', migratedAt: 9000 },
      { ...baseToken, mint: '0x1234000000000000000000000000000000000003', symbol: 'OLDER_GRAD', launchpad: undefined, ageMinutes: 900, liquidityUsd: '55000', marketCapUsd: '120000', migratedAt: Date.now() - 900 * 60_000 },
      { ...baseToken, mint: '0x1234000000000000000000000000000000000004', symbol: 'NEW_V4_MEME', launchpad: undefined, ageMinutes: 15, liquidityUsd: '32000', marketCapUsd: '165000', migratedAt: Date.now() - 15 * 60_000 },
    ]);

    expect(migrated.map((t) => t.symbol)).toEqual(['NEW_V4_MEME', 'OLDER_GRAD']);
  });
});

describe('Robinhood EVM ABI, Swap Math, Calldata & Event Decoding', () => {
  it('computes exact Keccak-256 selectors & Uniswap V4 PoolId', () => {
    expect(keccak256Hex(Buffer.from('balanceOf(address)')).slice(0, 10)).toBe('0x70a08231');
    expect(keccak256Hex(Buffer.from('Transfer(address,address,uint256)')).toLowerCase()).toBe(
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    );
    expect(
      keccak256Hex(
        Buffer.from('Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)'),
      ),
    ).toBe('0xdd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438');
    expect(
      keccak256Hex(Buffer.from('Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)')),
    ).toBe('0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f');

    const poolId = computeV4PoolId({
      currency0: ROBINHOOD_USDG_ADDRESS,
      currency1: ROBINHOOD_WETH_ADDRESS,
      fee: 100,
      tickSpacing: 1,
      hooks: EVM_ZERO_ADDRESS,
    });
    expect(poolId).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it('matches live Pons V2 bonding curve constant-product & fee math to exact wei', () => {
    // Verified pre-trade state before live CurveBuy tx on curve 0xef50...
    const buyEst = computePonsV2CurveSwap({
      isBuy: true,
      amountInRaw: 4_190_000_000_000_000n,
      quoteReserveRaw: 1_516_000_000_000_000_000n,
      tokenReserveRaw: 1_000_000_000_000_000_000_000_000_000n,
      feeBps: 100,
      creatorTaxBps: 50,
      snipeTaxBps: 0,
    });
    expect(buyEst.amountOutRaw).toBe(2_715_003_149_572_060_468_757_498n);
    expect(buyEst.priceImpactPct).not.toBeNull();
    expect(buyEst.priceImpactPct!).toBeGreaterThan(0);

    const sellEst = computePonsV2CurveSwap({
      isBuy: false,
      amountInRaw: buyEst.amountOutRaw,
      quoteReserveRaw: 1_520_127_150_000_000_000n,
      tokenReserveRaw: 1_000_000_000_000_000_000_000_000_000n - buyEst.amountOutRaw,
      feeBps: 100,
      creatorTaxBps: 50,
      snipeTaxBps: 0,
    });
    expect(sellEst.amountOutRaw).toBeGreaterThan(0n);
    expect(sellEst.amountOutRaw).toBeLessThan(4_190_000_000_000_000n);
  });

  it('computes single-tick concentrated liquidity swaps for both directions', () => {
    const zeroForOne = computeConcentratedLiquiditySwap({
      sqrtPriceX96: 1n << 96n,
      liquidity: 10n ** 21n,
      feePpm: 3000,
      zeroForOne: true,
      amountInRaw: 10n ** 18n,
    });
    const oneForZero = computeConcentratedLiquiditySwap({
      sqrtPriceX96: 1n << 96n,
      liquidity: 10n ** 21n,
      feePpm: 3000,
      zeroForOne: false,
      amountInRaw: 10n ** 18n,
    });
    expect(zeroForOne.amountOutRaw).toBeGreaterThan(990_000_000_000_000_000n);
    expect(oneForZero.amountOutRaw).toBeGreaterThan(990_000_000_000_000_000n);
    expect(zeroForOne.priceImpactPct).not.toBeNull();
  });

  it('encodes verified calldata for Pons V2, ERC-20/Permit2, and UniversalRouter V4/V3', () => {
    expect(encodePonsV2Buy(10n ** 16n, 1000n, SAMPLE_EVM_TOKEN).slice(0, 10)).toBe('0x59a87bc1');
    expect(encodePonsV2Sell(1000n, 10n, SAMPLE_EVM_TOKEN).slice(0, 10)).toBe('0xd04c6983');
    expect(encodeErc20Approve(ROBINHOOD_UNISWAP_UNIVERSAL_ROUTER, 1000n).slice(0, 10)).toBe(
      '0x095ea7b3',
    );
    expect(
      encodePermit2Approve(SAMPLE_EVM_TOKEN, ROBINHOOD_UNISWAP_UNIVERSAL_ROUTER).slice(0, 10),
    ).toBe('0x87517c45');

    const v4Args = buildUniversalRouterV4SwapInput({
      poolKey: {
        currency0: EVM_ZERO_ADDRESS,
        currency1: SAMPLE_EVM_TOKEN,
        fee: 3000,
        tickSpacing: 60,
        hooks: EVM_ZERO_ADDRESS,
      },
      zeroForOne: true,
      amountIn: 10n ** 16n,
      amountOutMinimum: 1000n,
      isSellErc20: false,
      wrapNativeBeforeSwap: false,
    });
    expect(v4Args.commandsHex).toBe('10');
    const v4Exec = encodeUniversalRouterExecute(
      v4Args.commandsHex,
      v4Args.inputsHex,
      BigInt(Math.floor(Date.now() / 1000) + 600),
    );
    expect(v4Exec.slice(0, 10)).toBe('0x3593564c');

    const v3Args = buildUniversalRouterV3SwapInput({
      tokenIn: ROBINHOOD_WETH_ADDRESS,
      tokenOut: SAMPLE_EVM_TOKEN,
      fee: 3000,
      amountIn: 10n ** 16n,
      amountOutMinimum: 1000n,
      recipient: SAMPLE_EVM_TOKEN,
      wrapNativeEth: true,
      unwrapNativeEth: false,
    });
    expect(v3Args.commandsHex).toBe('0b00');
    expect(v3Args.inputsHex).toHaveLength(2);
  });

  it('decodes Pons V2 and Uniswap V4 RPC event logs accurately', () => {
    const tokenTopic = `0x000000000000000000000000${SAMPLE_EVM_TOKEN.slice(2).toLowerCase()}`;
    const curveTopic = `0x000000000000000000000000${SAMPLE_POOL_ADDR.slice(2).toLowerCase()}`;
    const zeroHash = `0x${'0'.repeat(64)}`;

    const ponsLaunch = decodeRobinhoodLog({
      address: '0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e',
      topics: [ROBINHOOD_EVENT_TOPICS.PONS_V2_TOKEN_LAUNCHED, tokenTopic, curveTopic],
      data: '0x',
      blockNumber: '0x100',
      blockHash: zeroHash,
      transactionHash: `0x${'a'.repeat(64)}`,
      transactionIndex: '0x0',
      logIndex: '0x0',
      removed: false,
    });
    expect(ponsLaunch?.kind).toBe('pool_created');
    expect(ponsLaunch?.poolAddress).toBe(SAMPLE_POOL_ADDR.toLowerCase());
    expect(ponsLaunch?.token1).toBe(SAMPLE_EVM_TOKEN.toLowerCase());

    const v4PoolId = `0x${'b'.repeat(64)}`;
    const v4Init = decodeRobinhoodLog({
      address: '0x8366a39cc670b4001a1121b8f6a443a643e40951',
      topics: [ROBINHOOD_EVENT_TOPICS.UNISWAP_V4_INITIALIZE, v4PoolId, tokenTopic, curveTopic],
      data: '0x',
      blockNumber: '0x101',
      blockHash: zeroHash,
      transactionHash: `0x${'c'.repeat(64)}`,
      transactionIndex: '0x0',
      logIndex: '0x1',
      removed: false,
    });
    expect(v4Init?.kind).toBe('pool_created');
    expect(v4Init?.poolAddress).toBe(v4PoolId);

    const v4Swap = decodeRobinhoodLog({
      address: '0x8366a39cc670b4001a1121b8f6a443a643e40951',
      topics: [ROBINHOOD_EVENT_TOPICS.UNISWAP_V4_SWAP, v4PoolId],
      data: '0x',
      blockNumber: '0x102',
      blockHash: zeroHash,
      transactionHash: `0x${'d'.repeat(64)}`,
      transactionIndex: '0x0',
      logIndex: '0x2',
      removed: false,
    });
    expect(v4Swap?.kind).toBe('swap');
    expect(v4Swap?.poolAddress).toBe(v4PoolId);
  });
});

describe('Robinhood Pons V2 Launch-Block Sniper & Bundler Analyzer', () => {
  const padAddr = (addr: string) => `0x000000000000000000000000${addr.slice(2).toLowerCase()}`;
  const curveBuyTopic = '0xec36bf571f136799e8dc0b0b8bea4b04d8bd3d43de838aab0d5fc21d4cbfc455';

  it('excludes single dev launch buy and scores opening-window snipers and bundlers accurately', () => {
    const tokenAddr = '0x14c0a77e792f6c9818888630e95c50cf3b48c979';
    const curveAddr = '0x808be300da507cfbeeba1362794bbcd17d6b26c6';
    const deployer = '0x2ea951da0cdd767658f2c1d2c6849cd813f91496';
    const sniperA = '0x494f242f146889cb82ce263576d598e290c6701f';
    const sniperB = '0x372dc8d96a0119bd2d52ac48ee41aebd1fd9c129';
    const bundlerC = '0x5136067ccc0065c20ac16cd7191d08564e19d71e';
    const bundlerD = '0x2abdd72b5bb40ba0df894d33d40aee918da551ae';
    const sharedRouter = '0xfabae46a2bb98d6bdfbffe34757f8fb12a461e98';
    const lateBuyer = '0x92475293e578c7d88651d160d2b0e45e04e4528b';

    const launchBlock = 1000;
    const rawLogs = [
      // Single dev initial buy in launchBlock -> NOT a sniper or bundler
      {
        blockNumber: `0x${launchBlock.toString(16)}`,
        transactionHash: `0x${'1'.repeat(64)}`,
        topics: [curveBuyTopic, padAddr(deployer), padAddr(deployer)],
        data: `0x${'0'.repeat(128)}`,
      },
      // Sniper A at delta +17 (holds tokens)
      {
        blockNumber: `0x${(launchBlock + 17).toString(16)}`,
        transactionHash: `0x${'2'.repeat(64)}`,
        topics: [curveBuyTopic, padAddr(sniperA), padAddr(sniperA)],
        data: `0x${'0'.repeat(128)}`,
      },
      // Sniper B at delta +18 (sold all -> balance 0, not counted in holding sniperCount)
      {
        blockNumber: `0x${(launchBlock + 18).toString(16)}`,
        transactionHash: `0x${'3'.repeat(64)}`,
        topics: [curveBuyTopic, padAddr(sniperB), padAddr(sniperB)],
        data: `0x${'0'.repeat(128)}`,
      },
      // Two distinct wallets bundled in the exact same tx via shared router at delta +20
      {
        blockNumber: `0x${(launchBlock + 20).toString(16)}`,
        transactionHash: `0x${'4'.repeat(64)}`,
        topics: [curveBuyTopic, padAddr(sharedRouter), padAddr(bundlerC)],
        data: `0x${'0'.repeat(128)}`,
      },
      {
        blockNumber: `0x${(launchBlock + 20).toString(16)}`,
        transactionHash: `0x${'4'.repeat(64)}`,
        topics: [curveBuyTopic, padAddr(sharedRouter), padAddr(bundlerD)],
        data: `0x${'0'.repeat(128)}`,
      },
      // Late normal buyer outside 25-block opening window -> ignored
      {
        blockNumber: `0x${(launchBlock + 60).toString(16)}`,
        transactionHash: `0x${'5'.repeat(64)}`,
        topics: [curveBuyTopic, padAddr(lateBuyer), padAddr(lateBuyer)],
        data: `0x${'0'.repeat(128)}`,
      },
    ];

    const parsed = parsePonsCurveBuyLogs(rawLogs);
    expect(parsed).toHaveLength(6);

    const totalSupply = 1_000_000_000n * 10n ** 18n;
    const balances = new Map<string, bigint>([
      [deployer, 20_000_000n * 10n ** 18n], // 2% dev
      [sniperA, 50_000_000n * 10n ** 18n], // 5% sniper A
      [sniperB, 0n], // exited
      [bundlerC, 30_000_000n * 10n ** 18n], // 3% bundler C
      [bundlerD, 45_000_000n * 10n ** 18n], // 4.5% bundler D
      [lateBuyer, 100_000_000n * 10n ** 18n], // outside window
    ]);

    const result = analyzePonsLaunchBuys({
      tokenAddress: tokenAddr,
      launchBlock,
      deployerAddress: deployer,
      curveAddress: curveAddr,
      buyLogs: parsed,
      currentBalancesByWallet: balances,
      totalSupplyRaw: totalSupply,
      observedAt: '2026-11-14T12:00:00.000Z',
    });

    expect(result.sniperCount).toBe(3); // sniperA, bundlerC, bundlerD
    expect(result.sniperPercentage).toBeCloseTo(12.5, 2);
    expect(result.bundlerCount).toBe(2); // bundlerC, bundlerD
    expect(result.bundlerPercentage).toBeCloseTo(7.5, 2);
    expect(result.detectedSniperCount).toBe(4);
    expect(result.totalOpeningBuys).toBe(5);
  });

  it('returns measured 0% when there are no non-deployer buys or zero supply', () => {
    const res = analyzePonsLaunchBuys({
      tokenAddress: '0x14c0a77e792f6c9818888630e95c50cf3b48c979',
      launchBlock: 500,
      deployerAddress: '0x2ea951da0cdd767658f2c1d2c6849cd813f91496',
      buyLogs: [],
      currentBalancesByWallet: new Map(),
      totalSupplyRaw: 0n,
      observedAt: '2026-11-14T12:00:00.000Z',
    });
    expect(res.sniperCount).toBe(0);
    expect(res.sniperPercentage).toBe(0);
    expect(res.bundlerCount).toBe(0);
    expect(res.bundlerPercentage).toBe(0);
  });
});

describe('mergeRobinhoodNewPairs', () => {
  const mkToken = (overrides: Record<string, unknown>) =>
    ({
      id: 'robinhood:0x1',
      name: 'Sample',
      symbol: 'SMP',
      mint: '0x1111111111111111111111111111111111111111',
      chain: 'robinhood',
      source: 'Pons V2',
      launchpad: 'pons-v2',
      bondingStatus: 'bonding',
      lifecycleState: 'new_pairs',
      bondingCurveProgress: 2,
      ageMinutes: 10,
      ageFormatted: '10m',
      priceUsd: '0.001',
      priceChange1m: 0,
      priceChange5m: 0,
      priceChange15m: 0,
      priceChange1h: 0,
      priceChange24h: 0,
      volume5mUsd: '500',
      volume1hUsd: '1200',
      volume24hUsd: '3400',
      volumeChange15mPct: 0,
      liquidityUsd: '2500',
      liquidityChange1hPct: 0,
      marketCapUsd: '15000',
      buysCount: 5,
      sellsCount: 1,
      txCount15m: 6,
      txCount1h: 6,
      buySellImbalancePct: 0,
      buyPressureRatio: 0.8,
      txAccelerationPct: 0,
      isNewToken: true,
      auditPending: true,
      discoveryScore: { totalScore: 50 },
      ...overrides,
    }) as unknown as Parameters<typeof mergeRobinhoodNewPairs>[0][number];

  it('places unindexed fresh on-chain Pons V2 launches ahead of older GeckoTerminal pairs and merges fresher curve metrics', () => {
    const gtOverlapMint = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const gtOldMint = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const freshRpcMint = '0xcccccccccccccccccccccccccccccccccccccccc';
    const graduatedRpcMint = '0xdddddddddddddddddddddddddddddddddddddddd';

    const gtTokens = [
      mkToken({
        mint: gtOldMint,
        symbol: 'OLDGT',
        ageMinutes: 25,
        ageFormatted: '25m',
        volume5mUsd: '800',
      }),
      mkToken({
        mint: gtOverlapMint,
        symbol: 'OVERLAP',
        ageMinutes: 8,
        ageFormatted: '8m',
        volume5mUsd: '2400',
        buysCount: 18,
        bondingCurveProgress: 3,
      }),
      mkToken({
        mint: graduatedRpcMint,
        symbol: 'STALEGT',
        ageMinutes: 12,
        bondingStatus: 'bonding',
      }),
    ];

    const onChainTokens = [
      mkToken({
        mint: freshRpcMint,
        symbol: 'FRESH',
        ageMinutes: 0.1,
        ageFormatted: '6s',
        volume5mUsd: 'NaN',
        buysCount: Number.NaN,
        liquidityUsd: '14000',
        bondingCurveProgress: 0.4,
      }),
      mkToken({
        mint: gtOverlapMint,
        symbol: 'OVERLAP',
        ageMinutes: 7.5,
        ageFormatted: '7m',
        volume5mUsd: 'NaN',
        liquidityUsd: '19500',
        bondingCurveProgress: 18.2,
        bondingStatus: 'migrating',
        lifecycleState: 'final_stretch',
      }),
      mkToken({
        mint: graduatedRpcMint,
        symbol: 'STALEGT',
        ageMinutes: 12,
        bondingStatus: 'graduated',
        lifecycleState: 'migrated',
      }),
    ];

    const merged = mergeRobinhoodNewPairs(gtTokens, onChainTokens);

    // Graduated RPC token should be removed even if GT was stale
    expect(merged.map((t) => t.mint)).toEqual([freshRpcMint, gtOverlapMint, gtOldMint]);

    // Brand-new RPC launch sorts first
    expect(merged[0].symbol).toBe('FRESH');

    // Overlapping token keeps GT volume/tx stats while upgrading live RPC curve & liquidity
    expect(merged[1].volume5mUsd).toBe('2400');
    expect(merged[1].buysCount).toBe(18);
    expect(merged[1].liquidityUsd).toBe('19500');
    expect(merged[1].bondingCurveProgress).toBe(18.2);
    expect(merged[1].lifecycleState).toBe('final_stretch');
  });
});
