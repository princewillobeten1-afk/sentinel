/**
 * Exitability Pipeline (spec §47)
 *
 * Pool State → Liquidity Engine → Route Engine → Execution Simulator →
 * Exitability Engine → Stress Engine → Alerts / Discovery / UI.
 *
 * Intelligence computation is isolated from execution (spec §57): this pipeline
 * only reads pool/holder state and produces analytics + simulations. It never
 * broadcasts a transaction.
 */

import type {
  ExitabilityContext,
  ExitabilityPipelineResult,
} from './types';
import { analyzeExitability, type ExitabilityEngineOptions } from './exitability-engine';
import { runStressTests } from './stress-engine';
import { buildExitabilityAlertEvents } from './alert-events';

export interface ProcessExitabilityInput extends ExitabilityEngineOptions {
  context: ExitabilityContext;
}

export function processExitabilityPipeline(input: ProcessExitabilityInput): ExitabilityPipelineResult {
  const { context, ...options } = input;

  const exitability = analyzeExitability(context, options);
  const stress = runStressTests({
    context,
    liquidity: exitability.liquidity,
    normalExitability: exitability.score,
  });

  // Fold the stress score back into the report so consumers see one number.
  exitability.stressScore = stress.stressExitability;
  exitability.signals.push(...stress.signals);

  const alertEvents = buildExitabilityAlertEvents(exitability, stress, context.previousExitability);

  return {
    tokenId: context.tokenId,
    chain: context.chain,
    exitability,
    stress,
    liquidity: exitability.liquidity,
    alertEvents,
    processedAt: context.observedAt,
  };
}
