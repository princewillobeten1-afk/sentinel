import { describe, it, expect } from 'vitest';
import { mapJupiterTx, mapGeckoTrade } from '../trade-history-mappers';

const MINT = '836mp67zxnxobaV4gSe1yNeSJHgTJB2AhxJvff5pump';
const WSOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SIG = '56zmo13cNLt1DobS8oP9KbpkAVSDfuiNYS9TjtXGcwCg9CVzYhc2SmxmEkoj46x4RJCz1Fd884s63c3Vf4knBhnu';

describe('mapJupiterTx', () => {
  // Shape taken from a live datapi.jup.ag response.
  const live = {
    type: 'sell',
    usdVolume: 0.3626147102923171,
    traderAddress: 'FHpcNSe6tb2n15bAdq4BkeYWGyZKFD7yLYrH92ng7wCT',
    txHash: SIG,
    isMev: false,
    isValidPrice: true,
    nativeVolume: 0.003519109,
    timestamp: '2026-09-11T14:50:49.000Z',
    usdPrice: 7.998633517981063e-6,
    amount: 45334.582398,
  };

  it('maps every field the tape renders', () => {
    expect(mapJupiterTx(live)).toEqual({
      signature: SIG,
      side: 'SELL',
      wallet: 'FHpcNSe6tb2n15bAdq4BkeYWGyZKFD7yLYrH92ng7wCT',
      amountUsd: 0.3626147102923171,
      amountSol: 0.003519109,
      amountTokens: 45334.582398,
      priceUsd: 7.998633517981063e-6,
      timestamp: '2026-09-11T14:50:49.000Z',
      isMev: false,
      source: 'jupiter',
    });
  });

  it('drops a price the source marks invalid instead of showing it', () => {
    expect(mapJupiterTx({ ...live, isValidPrice: false })?.priceUsd).toBeNull();
  });

  it('keeps the MEV flag', () => {
    expect(mapJupiterTx({ ...live, isMev: true })?.isMev).toBe(true);
  });

  it('rejects rows that are not a buy or sell, or lack a signature', () => {
    expect(mapJupiterTx({ ...live, type: 'transfer' })).toBeNull();
    expect(mapJupiterTx({ ...live, txHash: undefined })).toBeNull();
  });
});

describe('mapGeckoTrade', () => {
  // A live GeckoTerminal sell: token in `from`, SOL in `to`.
  const sell = {
    attributes: {
      kind: 'sell',
      tx_hash: SIG,
      tx_from_address: '51ZouffuWg8ykTJDANbsVrzd3139fzhwyN63MTE95kk4',
      block_timestamp: '2026-09-11T14:47:29Z',
      volume_in_usd: '15.4346089606584953',
      from_token_address: MINT,
      to_token_address: WSOL,
      from_token_amount: '250545.474306',
      to_token_amount: '0.149456926',
      price_from_in_usd: '0.0000616040221976137',
      price_to_in_usd: '103.271286073811634',
    },
  };

  it('reads the token side of a sell from the addresses', () => {
    const t = mapGeckoTrade(sell, MINT)!;
    expect(t.side).toBe('SELL');
    expect(t.amountTokens).toBeCloseTo(250545.474306, 6);
    expect(t.amountSol).toBeCloseTo(0.149456926, 9);
    // The token's price, not SOL's $103.
    expect(t.priceUsd).toBeCloseTo(0.0000616040221976137, 18);
  });

  it('reads the token side of a buy, where it is in `to`', () => {
    const buy = {
      attributes: {
        ...sell.attributes,
        kind: 'buy',
        from_token_address: WSOL,
        to_token_address: MINT,
        from_token_amount: '1.444262585',
        to_token_amount: '2983955.853301',
        price_from_in_usd: '103.27',
        price_to_in_usd: '0.00004996',
      },
    };
    const t = mapGeckoTrade(buy, MINT)!;
    expect(t.side).toBe('BUY');
    expect(t.amountTokens).toBeCloseTo(2983955.853301, 6);
    expect(t.amountSol).toBeCloseTo(1.444262585, 9);
    expect(t.priceUsd).toBeCloseTo(0.00004996, 12);
  });

  it('leaves the SOL amount unknown on a USDC-quoted pool', () => {
    const usdc = { attributes: { ...sell.attributes, to_token_address: USDC } };
    expect(mapGeckoTrade(usdc, MINT)?.amountSol).toBeNull();
  });

  it('rejects a trade in a pool that does not contain the token', () => {
    const other = { attributes: { ...sell.attributes, from_token_address: USDC, to_token_address: WSOL } };
    expect(mapGeckoTrade(other, MINT)).toBeNull();
  });
});
