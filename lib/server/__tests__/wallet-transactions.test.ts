import { describe, expect, it } from 'vitest';
import { serverStore } from '../store';

describe('ServerStore wallet transactions', () => {
  it('records a transaction and returns it with a generated id and timestamp', async () => {
    const record = await serverStore.recordWalletTransaction('user_wtx_1', {
      walletId: 'w_wtx_1',
      direction: 'SEND',
      asset: 'SOL',
      amount: 1.5,
      destinationAddress: 'DestAddrAAA111111111111111111111111111111',
      signature: 'sig_wtx_1_'.padEnd(64, 'a'),
      network: 'solana:devnet',
    });

    expect(record.id).toBeTruthy();
    expect(record.userId).toBe('user_wtx_1');
    expect(record.createdAt).toBeTruthy();
  });

  it('getWalletTransactions returns only the requesting user\'s own transactions, newest first', async () => {
    await serverStore.recordWalletTransaction('user_wtx_2', {
      walletId: 'w_wtx_2',
      direction: 'SEND',
      asset: 'SOL',
      amount: 1,
      destinationAddress: 'DestAddrBBB111111111111111111111111111111',
      signature: 'sig_wtx_2a_'.padEnd(64, 'a'),
      network: 'solana:devnet',
    });
    // Someone else's transaction — must never leak into user_wtx_2's history.
    await serverStore.recordWalletTransaction('user_wtx_other', {
      walletId: 'w_wtx_other',
      direction: 'SEND',
      asset: 'SOL',
      amount: 99,
      destinationAddress: 'DestAddrCCC111111111111111111111111111111',
      signature: 'sig_wtx_other_'.padEnd(64, 'a'),
      network: 'solana:devnet',
    });
    const second = await serverStore.recordWalletTransaction('user_wtx_2', {
      walletId: 'w_wtx_2',
      direction: 'SEND',
      asset: 'USDC',
      amount: 50,
      destinationAddress: 'DestAddrDDD111111111111111111111111111111',
      signature: 'sig_wtx_2b_'.padEnd(64, 'a'),
      network: 'solana:devnet',
    });

    const history = await serverStore.getWalletTransactions('user_wtx_2');
    expect(history).toHaveLength(2);
    expect(history.every((t) => t.userId === 'user_wtx_2')).toBe(true);
    expect(history[0].id).toBe(second.id); // newest first
  });

  it('getWalletTransactions filters by walletId when given', async () => {
    await serverStore.recordWalletTransaction('user_wtx_3', {
      walletId: 'w_wtx_3a',
      direction: 'SEND',
      asset: 'SOL',
      amount: 1,
      destinationAddress: 'DestAddrEEE111111111111111111111111111111',
      signature: 'sig_wtx_3a_'.padEnd(64, 'a'),
      network: 'solana:devnet',
    });
    await serverStore.recordWalletTransaction('user_wtx_3', {
      walletId: 'w_wtx_3b',
      direction: 'SEND',
      asset: 'SOL',
      amount: 1,
      destinationAddress: 'DestAddrFFF111111111111111111111111111111',
      signature: 'sig_wtx_3b_'.padEnd(64, 'a'),
      network: 'solana:devnet',
    });

    const onlyA = await serverStore.getWalletTransactions('user_wtx_3', 'w_wtx_3a');
    expect(onlyA).toHaveLength(1);
    expect(onlyA[0].walletId).toBe('w_wtx_3a');
  });

  it('hasSentToAddress is true only after a matching transaction is recorded for that user', async () => {
    const destination = 'DestAddrGGG111111111111111111111111111111';
    expect(await serverStore.hasSentToAddress('user_wtx_4', destination)).toBe(false);

    await serverStore.recordWalletTransaction('user_wtx_4', {
      walletId: 'w_wtx_4',
      direction: 'SEND',
      asset: 'SOL',
      amount: 1,
      destinationAddress: destination,
      signature: 'sig_wtx_4_'.padEnd(64, 'a'),
      network: 'solana:devnet',
    });

    expect(await serverStore.hasSentToAddress('user_wtx_4', destination)).toBe(true);
    // A different user sending to the same address doesn't count as "this user" having sent there.
    expect(await serverStore.hasSentToAddress('user_wtx_5', destination)).toBe(false);
  });
});
