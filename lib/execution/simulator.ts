/**
 * Pre-Flight Transaction Simulator (Sprint 47 §28-30, §68).
 */

import { routeEngine } from './route-engine';
import {
  UnsignedTransactionPayload,
  SimulationResult,
  SwapRouteOption,
} from './types';

export class Simulator {
  private static instance: Simulator;

  private constructor() {}

  public static getInstance(): Simulator {
    if (!Simulator.instance) {
      Simulator.instance = new Simulator();
    }
    return Simulator.instance;
  }

  /**
   * Dry-runs a swap transaction payload before user signature
   */
  public async simulate(
    chainId: string,
    payload: UnsignedTransactionPayload,
    route: SwapRouteOption
  ): Promise<SimulationResult> {
    const adapter = routeEngine.getAdapterForChain(chainId);

    try {
      const simResult = await adapter.simulateSwap(
        payload,
        route.minimumReceived,
        route.expectedOutput
      );

      const outNum = parseFloat(simResult.expectedTokenOutput || '0');
      const minNum = parseFloat(route.minimumReceived);

      if (!simResult.success || outNum < minNum) {
        return {
          success: false,
          expectedTokenOutput: simResult.expectedTokenOutput,
          minimumOutputVerified: false,
          estimatedGasUsage: simResult.estimatedGasUsage,
          estimatedGasCostUsd: simResult.estimatedGasCostUsd,
          revertReason: simResult.revertReason || `Output amount (${outNum}) is less than enforced minimum (${minNum})`,
          warnings: ['Slippage threshold violated in simulation'],
        };
      }

      return {
        ...simResult,
        minimumOutputVerified: true,
      };
    } catch (err: any) {
      return {
        success: false,
        expectedTokenOutput: '0',
        minimumOutputVerified: false,
        estimatedGasUsage: 0,
        estimatedGasCostUsd: 0,
        revertReason: err.message || 'Execution simulation reverted on-chain.',
        warnings: ['Pre-flight RPC simulation call failed.'],
      };
    }
  }
}

export const simulator = Simulator.getInstance();
