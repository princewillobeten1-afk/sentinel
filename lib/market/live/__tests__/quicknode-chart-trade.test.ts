import { describe, expect, it } from 'vitest';
import { isChartSwapLog, parseQuickNodeChartTrade } from '../quicknode-chart-trade';

const mint = 'CzhWkiwzxk6RxcfY5LgzsCvJzfwwP26xxkaU8ouNpump';
const pool = '844a7Qqt5h8La7w3ZBqxUMbC6Hzoan4JWijeLqXJd6tq';
const wallet = '4XBqViD1XYF1qHrErrsXBzDrCapvP9fEFX4LPjXZi9YU';
const usdc = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const sig = '4cNdjMkkA8TAc6HKcSXDywRXxiXVyDSix6dSuLpbgkzEbP7rbF6AEcdCSEXKrNcaqhJDZvmCULPmEd1hncdq2NdC';
const balance = (asset: string, amount: string, decimals: number) => ({ mint: asset, owner: wallet,
  uiTokenAmount: { amount, decimals, uiAmount: amount === '0' ? null : Number(amount) / 10 ** decimals } });

function notification() {
  return { method: 'transactionNotification', params: { result: { context: { slot: 450093523 }, value: {
    slot: 450093523, signature: sig, err: null,
    transaction: { transaction: { message: { accountKeys: [
      { pubkey: wallet, signer: true }, { pubkey: pool, signer: false },
    ] } }, meta: { err: null, logMessages: ['Program log: Instruction: Swap'],
      preTokenBalances: [balance(mint, '0', 6), balance(usdc, '10000000', 6)],
      postTokenBalances: [balance(mint, '1000000', 6), balance(usdc, '9000000', 6)],
    } },
  } } } };
}

describe('QuickNode confirmed chart trades', () => {
  it('fetches transaction details only for likely swap logs', () => {
    expect(isChartSwapLog(['Program log: Instruction: CreateIdempotent'])).toBe(false);
    expect(isChartSwapLog(['Program log: Instruction: Buy'])).toBe(true);
    expect(isChartSwapLog(['Program log: Instruction: Sell'])).toBe(true);
    expect(isChartSwapLog(['Program log: Instruction: SwapBaseInput'])).toBe(true);
    expect(isChartSwapLog(['Program log: Instruction: SwapExactOut2'])).toBe(true);
    expect(isChartSwapLog(null)).toBe(false);
  });
  it('prices a direct pool swap from measured token and stablecoin balance changes', () => {
    expect(parseQuickNodeChartTrade(notification(), mint, pool, usdc, null, 1_780_000_000_000))
      .toMatchObject({ mint, poolAddress: pool, signature: sig, slot: 450093523, priceUsd: 1 });
  });

  it('prices a routed PumpSwap fill only from measured pool-owned token vaults', () => {
    const routed = notification();
    routed.params.result.value.transaction.meta.preTokenBalances = [
      { ...balance(mint, '100000000', 6), owner: pool },
      { ...balance('So11111111111111111111111111111111111111112', '2000000000', 9), owner: pool },
      balance(mint, '0', 6),
    ];
    routed.params.result.value.transaction.meta.postTokenBalances = [
      { ...balance(mint, '90000000', 6), owner: pool },
      { ...balance('So11111111111111111111111111111111111111112', '2100000000', 9), owner: pool },
      balance(mint, '10000000', 6),
    ];
    expect(parseQuickNodeChartTrade(routed, mint, pool,
      'So11111111111111111111111111111111111111112', 100, Date.now())?.priceUsd).toBeCloseTo(1, 10);
    routed.params.result.value.transaction.meta.postTokenBalances[1] = {
      ...balance('So11111111111111111111111111111111111111112', '2100000000', 9), owner: wallet,
    };
    expect(parseQuickNodeChartTrade(routed, mint, pool,
      'So11111111111111111111111111111111111111112', 100, Date.now())).toBeNull();
  });

  it('rejects transactions that do not prove this pool and token', () => {
    const wrongPool = '31p1hptjhFo6ZD8oBqkfutNXQKGGPyi7YcEAfsyKW777';
    expect(parseQuickNodeChartTrade(notification(), mint, wrongPool, usdc, null, Date.now())).toBeNull();
    const otherMint = '5QBxMxRfx6i1pwN1VvjGU2UtxtRdfLGa9QR6NGvApump';
    expect(parseQuickNodeChartTrade(notification(), otherMint, pool, usdc, null, Date.now())).toBeNull();
  });

  it('does not price a failed, creation, or multi-asset route as one pool trade', () => {
    const failed = notification();
    failed.params.result.value.transaction.meta.err = { InstructionError: [0, 'Custom'] } as never;
    expect(parseQuickNodeChartTrade(failed, mint, pool, usdc, null, Date.now())).toBeNull();
    const created = notification();
    created.params.result.value.transaction.meta.logMessages = ['Program log: Instruction: CreateV2'];
    expect(parseQuickNodeChartTrade(created, mint, pool, usdc, null, Date.now())).toBeNull();
    const routed = notification();
    const otherMint = '5QBxMxRfx6i1pwN1VvjGU2UtxtRdfLGa9QR6NGvApump';
    routed.params.result.value.transaction.meta.preTokenBalances.push(balance(otherMint, '5000000', 6));
    routed.params.result.value.transaction.meta.postTokenBalances.push(balance(otherMint, '4000000', 6));
    expect(parseQuickNodeChartTrade(routed, mint, pool, usdc, null, Date.now())).toBeNull();
  });
});
