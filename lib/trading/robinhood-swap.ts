import {
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_PERMIT2,
  ROBINHOOD_UNISWAP_UNIVERSAL_ROUTER,
  ROBINHOOD_WETH_ADDRESS,
  isEvmAddress,
} from '@/lib/chains/chain-config';
import {
  EVM_ZERO_ADDRESS,
  buildUniversalRouterV3SwapInput,
  buildUniversalRouterV4SwapInput,
  encodePonsV2Buy,
  encodePonsV2Sell,
  encodeUniversalRouterExecute,
  formatUnits,
  parseUnits,
} from '@/lib/chains/evm-abi';
import { resolveRobinhoodDex } from '@/lib/chains/robinhood-dex-registry';
import {
  readOnChainEthUsdPrice,
  readPonsV2FullCurveState,
  readPonsV2LaunchedCurveByToken,
  readUniswapV3LiveState,
  readUniswapV4LiveState,
} from '@/lib/blockchain/robinhood-rpc-protocols';

const Q96 = 1n << 96n;
const FEE_DENOM = 1_000_000n;

export interface EvmSwapApprovalPlan {
  kind: 'erc20' | 'permit2';
  tokenAddress: string;
  spender: string;
  permit2Address?: string;
  amountRaw: string;
}

export interface EvmSwapTransactionPlan {
  chainId: number;
  to: string;
  data: string;
  value: string;
  approval?: EvmSwapApprovalPlan;
}

export interface RobinhoodSwapQuoteResult {
  chain: 'robinhood';
  poolAddress: string;
  dexName: string;
  protocol: string;
  routerAddress: string | null;
  executionSupported: boolean;
  unavailableReason?: string;
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  inputAmountRaw: string;
  outputAmount: string;
  outputAmountRaw: string;
  minimumReceived: string;
  minimumReceivedRaw: string;
  priceImpactPct: number | null;
  estimatedRate: string;
  ethPriceUsd: number | null;
  tokenPriceUsd: number | null;
  evmTx?: EvmSwapTransactionPlan;
}

interface ConcentratedSwapEstimate {
  amountOutRaw: bigint;
  priceImpactPct: number | null;
}

/**
 * Compute single-tick constant-liquidity concentrated swap output (Uniswap V3 & V4).
 * Follows exact X96 arithmetic: zeroForOne pushes sqrtPrice down, !zeroForOne pushes sqrtPrice up.
 */
export function computeConcentratedLiquiditySwap(params: {
  sqrtPriceX96: bigint;
  liquidity: bigint;
  feePpm: number;
  zeroForOne: boolean;
  amountInRaw: bigint;
}): ConcentratedSwapEstimate {
  const { sqrtPriceX96, liquidity, feePpm, zeroForOne, amountInRaw } = params;
  if (sqrtPriceX96 <= 0n || amountInRaw <= 0n) {
    return { amountOutRaw: 0n, priceImpactPct: null };
  }

  const effectiveFeePpm =
    feePpm > 0 && feePpm < 1_000_000 ? BigInt(feePpm) : 3000n;
  const netIn = (amountInRaw * (FEE_DENOM - effectiveFeePpm)) / FEE_DENOM;
  if (netIn <= 0n) {
    return { amountOutRaw: 0n, priceImpactPct: null };
  }

  // Spot price (currency1/currency0) = (sqrtPriceX96 / 2^96)^2
  const sqrtFloat = Number(sqrtPriceX96) / Number(Q96);
  const price1Per0 = sqrtFloat * sqrtFloat;

  if (liquidity <= 0n) {
    // Fallback to spot ratio if current tick is out of range (priceImpact cannot be measured locally)
    if (!Number.isFinite(price1Per0) || price1Per0 <= 0) {
      return { amountOutRaw: 0n, priceImpactPct: null };
    }
    const rawSpot = zeroForOne
      ? BigInt(Math.floor(Number(netIn) * price1Per0))
      : BigInt(Math.floor(Number(netIn) / price1Per0));
    return {
      amountOutRaw: rawSpot > 0n ? rawSpot : 0n,
      priceImpactPct: null,
    };
  }

  let amountOutRaw = 0n;
  if (zeroForOne) {
    // sqrtP_next = (L * Q96 * sqrtP) / (L * Q96 + netIn * sqrtP)
    const num = liquidity * Q96;
    const denom = num + (netIn * sqrtPriceX96) / 1n;
    if (denom <= 0n) return { amountOutRaw: 0n, priceImpactPct: null };
    const sqrtPNext = (num * sqrtPriceX96) / denom;
    const deltaSqrt = sqrtPriceX96 > sqrtPNext ? sqrtPriceX96 - sqrtPNext : 0n;
    amountOutRaw = (liquidity * deltaSqrt) / Q96;
  } else {
    // sqrtP_next = sqrtP + (netIn * Q96) / L
    const deltaSqrt = (netIn * Q96) / liquidity;
    const sqrtPNext = sqrtPriceX96 + deltaSqrt;
    if (sqrtPNext <= 0n) return { amountOutRaw: 0n, priceImpactPct: null };
    amountOutRaw = (liquidity * deltaSqrt * Q96) / (sqrtPriceX96 * sqrtPNext);
  }

  let priceImpactPct: number | null = null;
  if (amountOutRaw > 0n && Number.isFinite(price1Per0) && price1Per0 > 0) {
    const spotExpectedOut = zeroForOne
      ? Number(netIn) * price1Per0
      : Number(netIn) / price1Per0;
    if (spotExpectedOut > 0 && Number.isFinite(spotExpectedOut)) {
      const pct = Math.max(0, ((spotExpectedOut - Number(amountOutRaw)) / spotExpectedOut) * 100);
      if (Number.isFinite(pct) && pct < 100) {
        priceImpactPct = Number(pct.toFixed(3));
      }
    }
  }

  return { amountOutRaw, priceImpactPct };
}

/**
 * Pure constant-product & fee quote for Pons V2 bonding curves (verified to 1 wei vs live Chain events).
 */
export function computePonsV2CurveSwap(params: {
  isBuy: boolean;
  amountInRaw: bigint;
  quoteReserveRaw: bigint;
  tokenReserveRaw: bigint;
  feeBps: number;
  creatorTaxBps: number;
  snipeTaxBps?: number;
}): {
  amountOutRaw: bigint;
  priceImpactPct: number | null;
} {
  const {
    isBuy,
    amountInRaw,
    quoteReserveRaw,
    tokenReserveRaw,
    feeBps,
    creatorTaxBps,
    snipeTaxBps = 0,
  } = params;

  if (amountInRaw <= 0n || quoteReserveRaw <= 0n || tokenReserveRaw <= 0n) {
    return { amountOutRaw: 0n, priceImpactPct: null };
  }

  if (isBuy) {
    const f1 = (amountInRaw * BigInt(feeBps)) / 10_000n;
    const f2 = (amountInRaw * BigInt(creatorTaxBps)) / 10_000n;
    const f3 = (amountInRaw * BigInt(snipeTaxBps)) / 10_000n;
    const netQuoteIn = amountInRaw - f1 - f2 - f3;
    if (netQuoteIn <= 0n) return { amountOutRaw: 0n, priceImpactPct: null };

    const amountOutRaw = (tokenReserveRaw * netQuoteIn) / (quoteReserveRaw + netQuoteIn);
    const impact = Number((netQuoteIn * 10_000n) / (quoteReserveRaw + netQuoteIn)) / 100;
    return {
      amountOutRaw,
      priceImpactPct: Number.isFinite(impact) ? Number(impact.toFixed(3)) : null,
    };
  }

  const grossQuoteOut = (quoteReserveRaw * amountInRaw) / (tokenReserveRaw + amountInRaw);
  const f1 = (grossQuoteOut * BigInt(feeBps)) / 10_000n;
  const f2 = (grossQuoteOut * BigInt(creatorTaxBps)) / 10_000n;
  const amountOutRaw = grossQuoteOut - f1 - f2;
  const impact = Number((amountInRaw * 10_000n) / (tokenReserveRaw + amountInRaw)) / 100;

  return {
    amountOutRaw: amountOutRaw > 0n ? amountOutRaw : 0n,
    priceImpactPct: Number.isFinite(impact) ? Number(impact.toFixed(3)) : null,
  };
}

function applySlippageRaw(amountOutRaw: bigint, slippagePct: number): bigint {
  const clampedBps = Math.min(9_500, Math.max(1, Math.round(slippagePct * 100)));
  return (amountOutRaw * BigInt(10_000 - clampedBps)) / 10_000n;
}

function toWeiHex(amount: bigint): string {
  return `0x${amount.toString(16)}`;
}

export async function quoteAndBuildRobinhoodSwap(params: {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippage: number;
  walletAddress?: string;
  poolAddress?: string | null;
  dexId?: string;
  tokenDecimals?: number;
  fallbackPriceUsd?: number;
  fallbackEthUsd?: number;
}): Promise<RobinhoodSwapQuoteResult> {
  const wethLower = ROBINHOOD_WETH_ADDRESS.toLowerCase();
  const inLower = params.inputMint.toLowerCase();
  const outLower = params.outputMint.toLowerCase();
  const isBuy = inLower === wethLower || inLower === EVM_ZERO_ADDRESS;
  const isSell = outLower === wethLower || outLower === EVM_ZERO_ADDRESS;

  if (!isBuy && !isSell) {
    throw new Error('Robinhood quotes must trade against native ETH / WETH on one side.');
  }

  const tokenAddress = isBuy ? outLower : inLower;
  if (!isEvmAddress(tokenAddress) || tokenAddress === wethLower) {
    throw new Error('Specify a valid Robinhood Chain token contract address.');
  }

  const inputNum = Number(params.amount);
  if (!Number.isFinite(inputNum) || inputNum <= 0) {
    throw new Error('Amount must be positive.');
  }

  const recipient =
    params.walletAddress && isEvmAddress(params.walletAddress)
      ? params.walletAddress.toLowerCase()
      : EVM_ZERO_ADDRESS;
  const hasConnectedWallet = recipient !== EVM_ZERO_ADDRESS;

  const ethUsd = params.fallbackEthUsd ?? (await readOnChainEthUsdPrice());
  let resolvedPool = params.poolAddress?.toLowerCase() ?? null;
  let dexId = params.dexId;

  // 1. Try Pons V2 bonding curve first when ungraduated (direct RPC verification)
  const ponsCurveAddr = await readPonsV2LaunchedCurveByToken(tokenAddress);
  if (ponsCurveAddr) {
    const curveState = await readPonsV2FullCurveState(
      ponsCurveAddr,
      hasConnectedWallet ? recipient : undefined,
    );
    if (curveState && !curveState.graduated && curveState.isNativeQuote) {
      const inDecimals = isBuy ? 18 : curveState.tokenDecimals;
      const outDecimals = isBuy ? curveState.tokenDecimals : 18;
      const amountInRaw = parseUnits(params.amount, inDecimals);
      if (amountInRaw <= 0n) throw new Error('Input amount rounds to zero base units.');

      const { amountOutRaw, priceImpactPct } = computePonsV2CurveSwap({
        isBuy,
        amountInRaw,
        quoteReserveRaw: curveState.quoteReserveRaw,
        tokenReserveRaw: curveState.tokenReserveRaw,
        feeBps: curveState.feeBps,
        creatorTaxBps: curveState.creatorTaxBps,
        snipeTaxBps: isBuy ? curveState.snipeTaxBps : 0,
      });
      if (amountOutRaw <= 0n) {
        throw new Error('Pons V2 curve returned zero output for this trade size.');
      }

      const minOutRaw = applySlippageRaw(amountOutRaw, params.slippage);
      const outputAmount = formatUnits(amountOutRaw, outDecimals, 8);
      const minimumReceived = formatUnits(minOutRaw, outDecimals, 8);
      const outNum = Number(outputAmount);

      const evmTx: EvmSwapTransactionPlan = {
        chainId: ROBINHOOD_CHAIN_ID,
        to: ponsCurveAddr,
        value: isBuy ? toWeiHex(amountInRaw) : '0x0',
        data: isBuy
          ? encodePonsV2Buy(amountInRaw, minOutRaw, recipient)
          : encodePonsV2Sell(amountInRaw, minOutRaw, recipient),
        ...(isBuy
          ? {}
          : {
              approval: {
                kind: 'erc20',
                tokenAddress,
                spender: ponsCurveAddr,
                amountRaw: amountInRaw.toString(),
              },
            }),
      };

      const spotTokenUsd =
        ethUsd && curveState.spotPriceInQuote > 0
          ? curveState.spotPriceInQuote * ethUsd
          : params.fallbackPriceUsd ?? null;

      return {
        chain: 'robinhood',
        poolAddress: ponsCurveAddr,
        dexName: 'Pons V2 Bonding Curve',
        protocol: 'launchpad',
        routerAddress: ponsCurveAddr,
        executionSupported: true,
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        inputAmount: params.amount,
        inputAmountRaw: amountInRaw.toString(),
        outputAmount,
        outputAmountRaw: amountOutRaw.toString(),
        minimumReceived,
        minimumReceivedRaw: minOutRaw.toString(),
        priceImpactPct,
        estimatedRate: inputNum > 0 && Number.isFinite(outNum) ? String(outNum / inputNum) : '0',
        ethPriceUsd: ethUsd,
        tokenPriceUsd: spotTokenUsd,
        evmTx,
      };
    }
  }

  // 2. Uniswap V4 Pool (32-byte poolId via UniversalRouter)
  const isV4PoolId = Boolean(resolvedPool && /^0x[a-f0-9]{64}$/.test(resolvedPool));
  if (resolvedPool && (isV4PoolId || dexId === 'uniswap-v4-robinhood')) {
    const v4State = await readUniswapV4LiveState(resolvedPool);
    if (v4State) {
      const c0 = v4State.poolKey.currency0.toLowerCase();
      const c1 = v4State.poolKey.currency1.toLowerCase();
      const quoteCurrency = c0 === tokenAddress ? c1 : c1 === tokenAddress ? c0 : null;
      const isNativeQuote = quoteCurrency === EVM_ZERO_ADDRESS;
      const isWethQuote = quoteCurrency === wethLower;

      if (quoteCurrency && (isNativeQuote || isWethQuote)) {
        const tokenDecimals = params.tokenDecimals ?? 18;
        const inDecimals = isBuy ? 18 : tokenDecimals;
        const outDecimals = isBuy ? tokenDecimals : 18;
        const amountInRaw = parseUnits(params.amount, inDecimals);
        const tokenIsCurrency0 = c0 === tokenAddress;
        const zeroForOne = isBuy ? !tokenIsCurrency0 : tokenIsCurrency0;

        const effectiveFeePpm =
          v4State.lpFee > 0 && v4State.lpFee < 1_000_000
            ? v4State.lpFee
            : v4State.poolKey.fee >= 0x800000
              ? 3000
              : v4State.poolKey.fee;

        const { amountOutRaw, priceImpactPct } = computeConcentratedLiquiditySwap({
          sqrtPriceX96: v4State.sqrtPriceX96,
          liquidity: v4State.liquidity,
          feePpm: effectiveFeePpm,
          zeroForOne,
          amountInRaw,
        });

        if (amountOutRaw > 0n) {
          const minOutRaw = applySlippageRaw(amountOutRaw, params.slippage);
          const outputAmount = formatUnits(amountOutRaw, outDecimals, 8);
          const minimumReceived = formatUnits(minOutRaw, outDecimals, 8);
          const outNum = Number(outputAmount);

          const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
          const urArgs = buildUniversalRouterV4SwapInput({
            poolKey: v4State.poolKey,
            zeroForOne,
            amountIn: amountInRaw,
            amountOutMinimum: minOutRaw,
            isSellErc20: !isBuy,
            wrapNativeBeforeSwap: isBuy && isWethQuote,
          });
          const data = encodeUniversalRouterExecute(
            urArgs.commandsHex,
            urArgs.inputsHex,
            deadline,
          );

          return {
            chain: 'robinhood',
            poolAddress: resolvedPool,
            dexName: 'Uniswap V4',
            protocol: 'uniswap-v4',
            routerAddress: ROBINHOOD_UNISWAP_UNIVERSAL_ROUTER,
            executionSupported: true,
            inputMint: params.inputMint,
            outputMint: params.outputMint,
            inputAmount: params.amount,
            inputAmountRaw: amountInRaw.toString(),
            outputAmount,
            outputAmountRaw: amountOutRaw.toString(),
            minimumReceived,
            minimumReceivedRaw: minOutRaw.toString(),
            priceImpactPct,
            estimatedRate: inputNum > 0 && Number.isFinite(outNum) ? String(outNum / inputNum) : '0',
            ethPriceUsd: ethUsd,
            tokenPriceUsd: params.fallbackPriceUsd ?? null,
            evmTx: {
              chainId: ROBINHOOD_CHAIN_ID,
              to: ROBINHOOD_UNISWAP_UNIVERSAL_ROUTER,
              value: isBuy ? toWeiHex(amountInRaw) : '0x0',
              data,
              ...(isBuy
                ? {}
                : {
                    approval: {
                      kind: 'permit2',
                      tokenAddress,
                      spender: ROBINHOOD_UNISWAP_UNIVERSAL_ROUTER,
                      permit2Address: ROBINHOOD_PERMIT2,
                      amountRaw: amountInRaw.toString(),
                    },
                  }),
            },
          };
        }
      }
    }
  }

  // 3. Uniswap V3 Pool (20-byte pool address via UniversalRouter)
  if (resolvedPool && isEvmAddress(resolvedPool) && dexId === 'uniswap-v3-robinhood') {
    const v3State = await readUniswapV3LiveState(resolvedPool);
    if (v3State) {
      const t0 = v3State.token0.toLowerCase();
      const t1 = v3State.token1.toLowerCase();
      const pairsWithWeth =
        (t0 === tokenAddress && t1 === wethLower) ||
        (t1 === tokenAddress && t0 === wethLower);

      if (pairsWithWeth) {
        const tokenDecimals = params.tokenDecimals ?? 18;
        const inDecimals = isBuy ? 18 : tokenDecimals;
        const outDecimals = isBuy ? tokenDecimals : 18;
        const amountInRaw = parseUnits(params.amount, inDecimals);
        const tokenIs0 = t0 === tokenAddress;
        const zeroForOne = isBuy ? !tokenIs0 : tokenIs0;

        const { amountOutRaw, priceImpactPct } = computeConcentratedLiquiditySwap({
          sqrtPriceX96: v3State.sqrtPriceX96,
          liquidity: v3State.liquidity,
          feePpm: v3State.fee,
          zeroForOne,
          amountInRaw,
        });

        if (amountOutRaw > 0n) {
          const minOutRaw = applySlippageRaw(amountOutRaw, params.slippage);
          const outputAmount = formatUnits(amountOutRaw, outDecimals, 8);
          const minimumReceived = formatUnits(minOutRaw, outDecimals, 8);
          const outNum = Number(outputAmount);

          const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
          const urArgs = buildUniversalRouterV3SwapInput({
            tokenIn: isBuy ? ROBINHOOD_WETH_ADDRESS : tokenAddress,
            tokenOut: isBuy ? tokenAddress : ROBINHOOD_WETH_ADDRESS,
            fee: v3State.fee,
            amountIn: amountInRaw,
            amountOutMinimum: minOutRaw,
            recipient,
            wrapNativeEth: isBuy,
            unwrapNativeEth: !isBuy,
          });
          const data = encodeUniversalRouterExecute(
            urArgs.commandsHex,
            urArgs.inputsHex,
            deadline,
          );

          return {
            chain: 'robinhood',
            poolAddress: resolvedPool,
            dexName: 'Uniswap V3',
            protocol: 'uniswap-v3',
            routerAddress: ROBINHOOD_UNISWAP_UNIVERSAL_ROUTER,
            executionSupported: true,
            inputMint: params.inputMint,
            outputMint: params.outputMint,
            inputAmount: params.amount,
            inputAmountRaw: amountInRaw.toString(),
            outputAmount,
            outputAmountRaw: amountOutRaw.toString(),
            minimumReceived,
            minimumReceivedRaw: minOutRaw.toString(),
            priceImpactPct,
            estimatedRate: inputNum > 0 && Number.isFinite(outNum) ? String(outNum / inputNum) : '0',
            ethPriceUsd: ethUsd,
            tokenPriceUsd: params.fallbackPriceUsd ?? null,
            evmTx: {
              chainId: ROBINHOOD_CHAIN_ID,
              to: ROBINHOOD_UNISWAP_UNIVERSAL_ROUTER,
              value: isBuy ? toWeiHex(amountInRaw) : '0x0',
              data,
              ...(isBuy
                ? {}
                : {
                    approval: {
                      kind: 'permit2',
                      tokenAddress,
                      spender: ROBINHOOD_UNISWAP_UNIVERSAL_ROUTER,
                      permit2Address: ROBINHOOD_PERMIT2,
                      amountRaw: amountInRaw.toString(),
                    },
                  }),
            },
          };
        }
      }
    }
  }

  // 4. Honest display-only fallback when pool venue is unverified / non-ETH paired
  const dexInfo = resolveRobinhoodDex(dexId);
  const tokenPriceUsd = params.fallbackPriceUsd ?? null;
  if (!ethUsd || !tokenPriceUsd || ethUsd <= 0 || tokenPriceUsd <= 0) {
    throw new Error('Live Robinhood pool liquidity or price is unavailable for this pair.');
  }

  const inDecimals = isBuy ? 18 : (params.tokenDecimals ?? 18);
  const outDecimals = isBuy ? (params.tokenDecimals ?? 18) : 18;
  const ratioTokenPerEth = ethUsd / tokenPriceUsd;
  const rawOutputNum = isBuy ? inputNum * ratioTokenPerEth : inputNum / ratioTokenPerEth;
  const minReceivedNum = rawOutputNum * (1 - params.slippage / 100);
  const outputAmount = rawOutputNum.toFixed(isBuy ? 4 : 6);
  const minimumReceived = minReceivedNum.toFixed(isBuy ? 4 : 6);

  return {
    chain: 'robinhood',
    poolAddress: resolvedPool || tokenAddress,
    dexName: dexInfo.name,
    protocol: dexInfo.protocol,
    routerAddress: dexInfo.routerAddress ?? null,
    executionSupported: false,
    unavailableReason: `Direct swap execution is not yet verified for ${dexInfo.name} on this pair. Live spot quote is shown above.`,
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    inputAmount: params.amount,
    inputAmountRaw: parseUnits(params.amount, inDecimals).toString(),
    outputAmount,
    outputAmountRaw: parseUnits(outputAmount, outDecimals).toString(),
    minimumReceived,
    minimumReceivedRaw: parseUnits(minimumReceived, outDecimals).toString(),
    priceImpactPct: null,
    estimatedRate: String(rawOutputNum / inputNum),
    ethPriceUsd: ethUsd,
    tokenPriceUsd,
  };
}
