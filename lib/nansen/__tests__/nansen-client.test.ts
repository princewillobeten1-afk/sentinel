import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EVM_NATIVE_PLACEHOLDER,
  EVM_ZERO_ADDRESS,
  SOLANA_NATIVE_MINT,
  SOLANA_USDC_MINT,
  isNansenNativeToken,
  isNansenTgmDexTradesRestricted,
  toNansenChain,
} from '../chains';
import {
  fetchNansenAccount,
  fetchNansenSmartMoneyDexTrades,
  fetchNansenSmartMoneyHoldings,
  fetchNansenSmartMoneyLeaderboard,
  fetchNansenSmartMoneyNetflow,
  fetchNansenSmartMoneyScreener,
  fetchNansenTgmFlowIntelligence,
  fetchNansenTgmSmartHolders,
  fetchNansenTokenSmartMoney,
  getNansenRateLimitStatus,
  isNansenConfigured,
  resetNansenClientStateForTests,
} from '../client';
import { formatDisplaySource } from '@/lib/discovery/format';

describe('Nansen API v1 integration', () => {
  const originalKey = process.env.NANSEN_API_KEY;
  const originalBase = process.env.NANSEN_API_BASE_URL;

  beforeEach(() => {
    resetNansenClientStateForTests();
    delete process.env.NANSEN_API_KEY;
    delete process.env.NANSEN_API_BASE_URL;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    resetNansenClientStateForTests();
    if (originalKey === undefined) delete process.env.NANSEN_API_KEY;
    else process.env.NANSEN_API_KEY = originalKey;

    if (originalBase === undefined) delete process.env.NANSEN_API_BASE_URL;
    else process.env.NANSEN_API_BASE_URL = originalBase;
  });

  it('maps chain identifiers and enforces native/USDC endpoint guards', () => {
    expect(toNansenChain('solana')).toBe('solana');
    expect(toNansenChain('SOL')).toBe('solana');
    expect(toNansenChain('robinhood')).toBe('robinhood');
    expect(toNansenChain('4663')).toBe('robinhood');
    expect(toNansenChain('bsc')).toBe('bnb');
    expect(toNansenChain('eth')).toBe('ethereum');
    expect(toNansenChain('arb')).toBe('arbitrum');
    expect(toNansenChain('all')).toBe('all');

    expect(isNansenNativeToken('solana', SOLANA_NATIVE_MINT)).toBe(true);
    expect(isNansenNativeToken('solana', SOLANA_NATIVE_MINT.toLowerCase())).toBe(false);
    expect(isNansenNativeToken('robinhood', EVM_NATIVE_PLACEHOLDER)).toBe(true);
    expect(isNansenNativeToken('robinhood', EVM_ZERO_ADDRESS)).toBe(true);
    expect(isNansenNativeToken('solana', SOLANA_USDC_MINT)).toBe(false);

    expect(isNansenTgmDexTradesRestricted('solana', SOLANA_NATIVE_MINT)).toBe(true);
    expect(isNansenTgmDexTradesRestricted('solana', SOLANA_USDC_MINT)).toBe(true);
    expect(isNansenTgmDexTradesRestricted('robinhood', '0x4200000000000000000000000000000000000006')).toBe(false);
  });

  it('skips network calls and fails soft when NANSEN_API_KEY is unset', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(isNansenConfigured()).toBe(false);

    const tokenRes = await fetchNansenTokenSmartMoney(
      'solana',
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    );
    expect(tokenRes.configured).toBe(false);
    expect(tokenRes.flowIntelligence).toBeNull();
    expect(tokenRes.smartBuyers).toEqual([]);
    expect(await fetchNansenSmartMoneyScreener({ chains: ['solana'] })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends apikey header, strict snake_case payloads, Smart Trader label only, and tracks credits/rate headers', async () => {
    process.env.NANSEN_API_KEY = 'nansen-test-key';

    const capturedBodies: Record<string, Record<string, unknown>> = {};
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      expect(headers.get('apikey')).toBe('nansen-test-key');

      const parsedBody = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      const pathname = new URL(url).pathname;
      capturedBodies[pathname] = parsedBody;

      const bodyString = JSON.stringify(parsedBody);
      expect(bodyString).not.toContain('"Fund"');
      expect(bodyString).not.toContain('30D Smart Trader');

      const respHeaders = {
        'content-type': 'application/json',
        'X-Nansen-Credits-Remaining': '995',
        'X-Nansen-Credits-Cost': '5',
        'X-Nansen-Credits-Used': '5',
        'RateLimit-Remaining': '280',
        'X-RateLimit-Remaining': '14',
      };

      if (pathname === '/api/v1/account') {
        return new Response(JSON.stringify({ plan: 'free', credits_remaining: 995 }), {
          status: 200,
          headers: respHeaders,
        });
      }
      if (pathname === '/api/v1/token-screener') {
        return new Response(
          JSON.stringify({
            data: [{ chain: 'solana', token_address: 'BONK', token_symbol: 'BONK', netflow: 120000, nof_traders: 8 }],
            pagination: { page: 1, per_page: 20, is_last_page: true },
          }),
          { status: 200, headers: respHeaders },
        );
      }
      if (pathname === '/api/v1/smart-money/netflow') {
        return new Response(
          JSON.stringify({ data: [{ token_address: 'Mint1', token_symbol: 'M1', net_flow_24h_usd: 50000 }] }),
          { status: 200, headers: respHeaders },
        );
      }
      if (pathname === '/api/v1/smart-money/holdings') {
        return new Response(
          JSON.stringify({ data: [{ chain: 'robinhood', token_address: '0x1', token_symbol: 'WETH', value_usd: 42000, holders_count: 3 }] }),
          { status: 200, headers: respHeaders },
        );
      }
      if (pathname === '/api/v1/smart-money/dex-trades') {
        return new Response(
          JSON.stringify({ data: [{ transaction_hash: 'tx1', trader_address: 'w1', trader_address_label: 'SM Alpha', trade_value_usd: 15000 }] }),
          { status: 200, headers: respHeaders },
        );
      }
      if (pathname === '/api/v1/smart-money/pnl-leaderboard') {
        return new Response(
          JSON.stringify({ data: [{ address: 'w1', address_label: 'SM Alpha', total_pnl_usd: 90000, win_rate: 0.72, n_trades: 40 }] }),
          { status: 200, headers: respHeaders },
        );
      }
      if (pathname === '/api/v1/tgm/holders') {
        return new Response(
          JSON.stringify({ data: [{ address: 'h1', address_label: 'Smart Trader', value_usd: 25000, ownership_percentage: 1.5 }] }),
          { status: 200, headers: respHeaders },
        );
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200, headers: respHeaders });
    });

    const account = await fetchNansenAccount();
    expect(account?.plan).toBe('free');

    const screener = await fetchNansenSmartMoneyScreener({ chains: ['all'], timeframe: '24h' });
    expect(screener?.data).toHaveLength(1);
    expect((capturedBodies['/api/v1/token-screener'].chains as string[]).length).toBeLessThanOrEqual(5);
    expect(capturedBodies['/api/v1/token-screener'].chains).not.toContain('all');
    expect((capturedBodies['/api/v1/token-screener'].filters as { trader_type?: string }).trader_type).toBe('sm');

    await fetchNansenSmartMoneyNetflow({ chains: ['solana'] });
    await fetchNansenSmartMoneyHoldings({ chains: ['robinhood'] });
    await fetchNansenSmartMoneyDexTrades({ chains: ['solana'] });
    await fetchNansenSmartMoneyLeaderboard({ chains: ['robinhood'] });
    const holders = await fetchNansenTgmSmartHolders({ chain: 'solana', tokenAddress: 'MintXYZ' });

    expect(holders).toHaveLength(1);
    expect(capturedBodies['/api/v1/tgm/holders'].aggregate_by_entity).toBe(false);
    expect(capturedBodies['/api/v1/tgm/holders'].label_type).toBe('smart_money');
    expect(capturedBodies['/api/v1/tgm/holders'].premium_labels).toBe(false);

    // Repeating same query hits in-memory cache
    await fetchNansenSmartMoneyNetflow({ chains: ['solana'] });
    expect(fetchSpy).toHaveBeenCalledTimes(7);

    expect(getNansenRateLimitStatus()).toEqual({
      creditsRemaining: 995,
      creditsLastCost: 5,
      creditsLastUsed: 5,
      rateLimitRemaining: 14,
      coolingDown: false,
      insufficientCredits: false,
      authFailed: false,
    });
  });

  it('routes core, trades, and holders detail levels with minimal credits and skips restricted dex-trades', async () => {
    process.env.NANSEN_API_KEY = 'nansen-detail-key';

    const calls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const pathname = new URL(String(input)).pathname;
      calls.push(pathname);

      if (pathname === '/api/v1/tgm/flow-intelligence') {
        return new Response(
          JSON.stringify({ data: [{ smart_trader_net_flow_usd: 88000, smart_trader_wallet_count: 6 }] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (pathname === '/api/v1/tgm/who-bought-sold') {
        return new Response(
          JSON.stringify({ data: [{ address: 'Buyer1', net_volume_usd: 22000 }] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (pathname === '/api/v1/tgm/dex-trades') {
        return new Response(
          JSON.stringify({ data: [{ transaction_hash: 'swap1', action: 'BUY', estimated_value_usd: 5000 }] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (pathname === '/api/v1/tgm/holders') {
        return new Response(
          JSON.stringify({ data: [{ address: 'Holder1', value_usd: 99000 }] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    });

    const core = await fetchNansenTokenSmartMoney('solana', 'BONKMint', { detail: 'core' });
    expect(calls).toEqual(['/api/v1/tgm/flow-intelligence', '/api/v1/tgm/who-bought-sold']);
    expect(core.flowIntelligence?.smart_trader_net_flow_usd).toBe(88000);
    expect(core.smartBuyers).toHaveLength(1);

    calls.length = 0;
    const trades = await fetchNansenTokenSmartMoney('robinhood', '0x4200000000000000000000000000000000000006', {
      detail: 'trades',
    });
    expect(calls).toEqual(['/api/v1/tgm/who-bought-sold', '/api/v1/tgm/dex-trades']);
    expect(trades.dexTrades).toHaveLength(1);

    // Solana USDC should skip /api/v1/tgm/dex-trades automatically
    calls.length = 0;
    const usdcTrades = await fetchNansenTokenSmartMoney('solana', SOLANA_USDC_MINT, { detail: 'trades' });
    expect(usdcTrades.dexTradesRestricted).toBe(true);
    expect(calls).toEqual(['/api/v1/tgm/who-bought-sold']);

    calls.length = 0;
    const holders = await fetchNansenTokenSmartMoney('solana', 'BONKMint', { detail: 'holders' });
    expect(calls).toEqual(['/api/v1/tgm/holders']);
    expect(holders.smartHolders).toHaveLength(1);
  });

  it('handles 401, 403 insufficient_credits, 429 cache-preserving cooldown, and 514 non-auth refusal cleanly', async () => {
    // 1. 401 Auth failure
    process.env.NANSEN_API_KEY = 'bad-nansen-key';
    const spy401 = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Invalid API key' }), { status: 401 }));

    expect(await fetchNansenTgmFlowIntelligence('solana', 'MintA', '1d')).toBeNull();
    expect(getNansenRateLimitStatus().authFailed).toBe(true);
    expect(await fetchNansenTgmFlowIntelligence('solana', 'MintB', '1d')).toBeNull();
    expect(spy401).toHaveBeenCalledTimes(1);
    spy401.mockRestore();

    // 2. 429 Cooldown still serves cached results
    resetNansenClientStateForTests();
    process.env.NANSEN_API_KEY = 'rate-nansen-key';
    const spy429 = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ smart_trader_net_flow_usd: 12345 }] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 'rate_limit_exceeded' }), {
          status: 429,
          headers: { 'Retry-After': '15' },
        }),
      );

    expect((await fetchNansenTgmFlowIntelligence('solana', 'CachedMint', '1d'))?.smart_trader_net_flow_usd).toBe(12345);
    expect(await fetchNansenTgmFlowIntelligence('solana', 'UncachedMint', '1d')).toBeNull();
    expect(getNansenRateLimitStatus().coolingDown).toBe(true);
    // Cached entry returns cleanly during 429 cooldown with no extra fetch!
    expect((await fetchNansenTgmFlowIntelligence('solana', 'CachedMint', '1d'))?.smart_trader_net_flow_usd).toBe(12345);
    expect(spy429).toHaveBeenCalledTimes(2);
    spy429.mockRestore();

    // 3. 403 insufficient_credits sets insufficientCredits=true and keeps serving cached responses
    resetNansenClientStateForTests();
    process.env.NANSEN_API_KEY = 'empty-credits-key';
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ smart_trader_net_flow_usd: 999 }] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 'insufficient_credits' }), {
          status: 403,
          headers: { 'X-Nansen-Credits-Remaining': '0' },
        }),
      );

    expect((await fetchNansenTgmFlowIntelligence('solana', 'MintKeep', '1d'))?.smart_trader_net_flow_usd).toBe(999);
    expect(await fetchNansenTgmFlowIntelligence('solana', 'MintBlocked', '1d')).toBeNull();
    expect(getNansenRateLimitStatus().insufficientCredits).toBe(true);
    expect(getNansenRateLimitStatus().creditsRemaining).toBe(0);
    expect((await fetchNansenTgmFlowIntelligence('solana', 'MintKeep', '1d'))?.smart_trader_net_flow_usd).toBe(999);
    vi.restoreAllMocks();

    // 4. 514 backend refusal is NOT treated as an auth error
    resetNansenClientStateForTests();
    process.env.NANSEN_API_KEY = 'valid-key-native-refusal';
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('Refused native token', { status: 514 }));
    expect(await fetchNansenTgmFlowIntelligence('solana', SOLANA_NATIVE_MINT, '1d')).toBeNull();
    expect(getNansenRateLimitStatus().authFailed).toBe(false);
    expect(getNansenRateLimitStatus().insufficientCredits).toBe(false);

    expect(formatDisplaySource('nansen+insightx')).toBe('Nansen + InsightX');
  });
});
