/**
 * Gas & Network Fee Estimator (Sprint 47 §19-21).
 */

import { masterWalletProvider } from '../wallet/wallet-provider';
import { GasEstimateResult } from './types';

export class GasEstimator {
  private static instance: GasEstimator;
  private bufferMultiplier = 1.20; // 20% bounded buffer
  private maxGasCeiling = 500000; // 500k units max

  private constructor() {}

  public static getInstance(): GasEstimator {
    if (!GasEstimator.instance) {
      GasEstimator.instance = new GasEstimator();
    }
    return GasEstimator.instance;
  }

  /**
   * Estimates gas limits, fees, and checks native balance
   */
  public async estimateGas(
    chainId: string,
    rawEstimatedUnits: number,
    networkFeeUsd: number
  ): Promise<GasEstimateResult> {
    const bufferedGas = Math.min(
      Math.round(rawEstimatedUnits * this.bufferMultiplier),
      this.maxGasCeiling
    );

    const nativeBalance = masterWalletProvider.getBalance('native').amount;
    const requiredNative = networkFeeUsd / 150;

    return {
      estimatedGas: rawEstimatedUnits,
      gasLimit: bufferedGas,
      baseFeeGwei: chainId === 'ethereum' ? 25 : 0.1,
      priorityFeeGwei: chainId === 'ethereum' ? 1.5 : 0.01,
      maxFeeGwei: chainId === 'ethereum' ? 30 : 0.15,
      estimatedNetworkFeeUsd: networkFeeUsd,
      sufficientNativeBalance: nativeBalance >= requiredNative,
    };
  }
}

export const gasEstimator = GasEstimator.getInstance();
