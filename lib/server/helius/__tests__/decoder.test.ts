import { describe, expect, it } from 'vitest';
import { BlockchainDecoder } from '../decoder';

describe('BlockchainDecoder token transfers', () => {
  it('extracts sender, recipient, mint and token amount from a logged transfer', () => {
    const events = BlockchainDecoder.decodeTransaction({
      signature: 'transfer-signature',
      slot: 123,
      meta: {
        logMessages: ['Program log: Instruction: TransferChecked'],
        preTokenBalances: [
          { mint: 'TokenMint111111111111111111111111111111111', owner: 'sender', uiTokenAmount: { uiAmount: 25 } },
          { mint: 'TokenMint111111111111111111111111111111111', owner: 'recipient', uiTokenAmount: { uiAmount: 2 } },
        ],
        postTokenBalances: [
          { mint: 'TokenMint111111111111111111111111111111111', owner: 'sender', uiTokenAmount: { uiAmount: 15 } },
          { mint: 'TokenMint111111111111111111111111111111111', owner: 'recipient', uiTokenAmount: { uiAmount: 12 } },
        ],
      },
    });

    expect(events).toContainEqual(expect.objectContaining({
      type: 'TRANSFER',
      mint: 'TokenMint111111111111111111111111111111111',
      fromWallet: 'sender',
      toWallet: 'recipient',
      tokenAmount: 10,
    }));
  });

  it('does not infer a transfer from balance changes without a transfer instruction', () => {
    const events = BlockchainDecoder.decodeTransaction({
      signature: 'swap-signature',
      meta: {
        logMessages: ['Program log: Instruction: Swap'],
        preTokenBalances: [
          { mint: 'TokenMint111111111111111111111111111111111', owner: 'sender', uiTokenAmount: { uiAmount: 25 } },
        ],
        postTokenBalances: [
          { mint: 'TokenMint111111111111111111111111111111111', owner: 'sender', uiTokenAmount: { uiAmount: 15 } },
        ],
      },
    });

    expect(events.some((event) => event.type === 'TRANSFER')).toBe(false);
  });
});
