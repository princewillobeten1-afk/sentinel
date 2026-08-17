import { describe, it, expect } from 'vitest';
import {
  matchRaydiumAmmV4Logs,
  matchOrcaWhirlpoolLogs,
  matchPumpFunLogs,
  matchLogsForProgram,
} from '../live/helius-log-matchers';

describe('matchRaydiumAmmV4Logs', () => {
  it('classifies a swap instruction', () => {
    const logs = ['Program 675k... invoke [1]', 'Program log: Instruction: Swap', 'Program 675k... success'];
    expect(matchRaydiumAmmV4Logs(logs)).toEqual({ eventType: 'SWAP' });
  });

  it('classifies a deposit as LIQUIDITY_ADD', () => {
    const logs = ['Program log: Instruction: Deposit'];
    expect(matchRaydiumAmmV4Logs(logs)).toEqual({ eventType: 'LIQUIDITY_ADD' });
  });

  it('classifies a withdraw as LIQUIDITY_REMOVE', () => {
    const logs = ['Program log: Instruction: Withdraw'];
    expect(matchRaydiumAmmV4Logs(logs)).toEqual({ eventType: 'LIQUIDITY_REMOVE' });
  });

  it('falls back to a low-confidence SWAP when only ray_log is present', () => {
    const logs = ['Program log: ray_log', 'Program log: <base64 payload>'];
    expect(matchRaydiumAmmV4Logs(logs)).toEqual({ eventType: 'SWAP' });
  });

  it('returns null for unrelated logs', () => {
    const logs = ['Program 675k... invoke [1]', 'Program log: Instruction: Initialize', 'Program 675k... success'];
    expect(matchRaydiumAmmV4Logs(logs)).toBeNull();
  });
});

describe('matchOrcaWhirlpoolLogs', () => {
  it('classifies swap and twoHopSwap as SWAP', () => {
    expect(matchOrcaWhirlpoolLogs(['Program log: Instruction: Swap'])).toEqual({ eventType: 'SWAP' });
    expect(matchOrcaWhirlpoolLogs(['Program log: Instruction: TwoHopSwap'])).toEqual({ eventType: 'SWAP' });
  });

  it('classifies increaseLiquidity/openPosition as LIQUIDITY_ADD', () => {
    expect(matchOrcaWhirlpoolLogs(['Program log: Instruction: IncreaseLiquidity'])).toEqual({ eventType: 'LIQUIDITY_ADD' });
    expect(matchOrcaWhirlpoolLogs(['Program log: Instruction: OpenPosition'])).toEqual({ eventType: 'LIQUIDITY_ADD' });
  });

  it('classifies decreaseLiquidity/closePosition as LIQUIDITY_REMOVE', () => {
    expect(matchOrcaWhirlpoolLogs(['Program log: Instruction: DecreaseLiquidity'])).toEqual({ eventType: 'LIQUIDITY_REMOVE' });
  });

  it('returns null for noise', () => {
    expect(matchOrcaWhirlpoolLogs(['Program log: Instruction: CollectFees'])).toBeNull();
  });
});

describe('matchPumpFunLogs', () => {
  it('classifies buy/sell as SWAP', () => {
    expect(matchPumpFunLogs(['Program log: Instruction: Buy'])).toEqual({ eventType: 'SWAP' });
    expect(matchPumpFunLogs(['Program log: Instruction: Sell'])).toEqual({ eventType: 'SWAP' });
  });

  it('returns null for unrelated instructions (no liquidity concept on the bonding curve)', () => {
    expect(matchPumpFunLogs(['Program log: Instruction: CreatePool'])).toBeNull();
  });
});

describe('matchLogsForProgram', () => {
  it('dispatches to the correct matcher by label', () => {
    expect(matchLogsForProgram('pumpfun', ['Program log: Instruction: Buy'])).toEqual({ eventType: 'SWAP' });
  });

  it('returns null for an unknown label', () => {
    expect(matchLogsForProgram('unknown_program', ['Program log: Instruction: Swap'])).toBeNull();
  });
});
