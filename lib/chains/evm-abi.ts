/**
 * Zero-dependency EVM Keccak-256, ABI encoding/decoding, fixed-point unit math,
 * and verified calldata builders for Robinhood Chain protocols (Pons V2,
 * Uniswap UniversalRouter V4/V3, ERC-20, and Permit2).
 */

const KECCAK_ROUNDS = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];

const RHO_OFFSETS = [
  [0, 36, 3, 41, 18],
  [1, 44, 10, 45, 2],
  [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56],
  [27, 20, 39, 8, 14],
];

const MASK64 = (1n << 64n) - 1n;
const MASK256 = (1n << 256n) - 1n;

export const EVM_ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const UNIVERSAL_ROUTER_ADDRESS_THIS = '0x0000000000000000000000000000000000000002';
export const MAX_UINT256 = MASK256;
export const MAX_UINT160 = (1n << 160n) - 1n;
export const MAX_UINT48 = (1n << 48n) - 1n;

function rotl64(x: bigint, n: number): bigint {
  return n === 0 ? x : ((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK64;
}

function keccakF(state: bigint[][]): void {
  const b = Array.from({ length: 5 }, () => new Array<bigint>(5).fill(0n));
  for (let round = 0; round < 24; round++) {
    const c = new Array<bigint>(5).fill(0n);
    for (let x = 0; x < 5; x++) {
      c[x] = state[x][0] ^ state[x][1] ^ state[x][2] ^ state[x][3] ^ state[x][4];
    }
    for (let x = 0; x < 5; x++) {
      const d = c[(x + 4) % 5] ^ rotl64(c[(x + 1) % 5], 1);
      for (let y = 0; y < 5; y++) state[x][y] = (state[x][y] ^ d) & MASK64;
    }
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        b[y][(2 * x + 3 * y) % 5] = rotl64(state[x][y], RHO_OFFSETS[x][y]);
      }
    }
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        state[x][y] = b[x][y] ^ ((~b[(x + 1) % 5][y] & MASK64) & b[(x + 2) % 5][y]);
      }
    }
    state[0][0] ^= KECCAK_ROUNDS[round];
  }
}

export function keccak256Bytes(bytes: Uint8Array): Uint8Array {
  const rate = 136;
  const padLen = rate - (bytes.length % rate);
  const padded = new Uint8Array(bytes.length + padLen);
  padded.set(bytes);
  padded[bytes.length] ^= 0x01;
  padded[padded.length - 1] ^= 0x80;

  const state = Array.from({ length: 5 }, () => new Array<bigint>(5).fill(0n));
  for (let off = 0; off < padded.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) {
      let lane = 0n;
      for (let j = 0; j < 8; j++) {
        lane |= BigInt(padded[off + i * 8 + j]) << BigInt(j * 8);
      }
      state[i % 5][Math.floor(i / 5)] ^= lane;
    }
    keccakF(state);
  }

  const out = new Uint8Array(32);
  let idx = 0;
  for (let y = 0; y < 5 && idx < 32; y++) {
    for (let x = 0; x < 5 && idx < 32; x++) {
      const lane = state[x][y];
      for (let j = 0; j < 8 && idx < 32; j++) {
        out[idx++] = Number((lane >> BigInt(j * 8)) & 0xffn);
      }
    }
  }
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = strip0x(hex);
  const even = clean.length % 2 === 0 ? clean : `0${clean}`;
  const out = new Uint8Array(even.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(even.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return `0x${out}`;
}

export function keccak256Hex(input: Uint8Array | string): string {
  const bytes =
    typeof input === 'string'
      ? input.startsWith('0x')
        ? hexToBytes(input)
        : new TextEncoder().encode(input)
      : input;
  return bytesToHex(keccak256Bytes(bytes));
}

export function strip0x(hex: string): string {
  return hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
}

export function padWord(hexNoPrefix: string): string {
  const clean = strip0x(hexNoPrefix).toLowerCase();
  if (clean.length > 64) return clean.slice(-64);
  return clean.padStart(64, '0');
}

export function encodeAddress(address: string): string {
  return padWord(strip0x(address).slice(-40));
}

export function encodeUint(value: bigint | number): string {
  const big = typeof value === 'bigint' ? value : BigInt(value);
  return (big & MASK256).toString(16).padStart(64, '0');
}

export function encodeInt(value: bigint | number): string {
  const big = typeof value === 'bigint' ? value : BigInt(value);
  const twos = big >= 0n ? big : (1n << 256n) + big;
  return (twos & MASK256).toString(16).padStart(64, '0');
}

export function encodeBool(value: boolean): string {
  return encodeUint(value ? 1n : 0n);
}

export function encodeDynamicBytes(hexData: string): string {
  const clean = strip0x(hexData).toLowerCase();
  const byteLen = clean.length / 2;
  const paddedData = clean.padEnd(Math.ceil(clean.length / 64) * 64, '0');
  return encodeUint(byteLen) + paddedData;
}

export function encodeAbiTuple(words: string[]): string {
  return words.join('');
}

export function encodeBytesArray(hexItems: string[]): string {
  const countWord = encodeUint(hexItems.length);
  const encodedItems = hexItems.map((item) => encodeDynamicBytes(item));
  const offsets: string[] = [];
  let runningBytes = hexItems.length * 32;
  for (const enc of encodedItems) {
    offsets.push(encodeUint(runningBytes));
    runningBytes += enc.length / 2;
  }
  return countWord + offsets.join('') + encodedItems.join('');
}

export function decodeWord(hexResult: string | null | undefined, wordIndex = 0): string {
  if (!hexResult || typeof hexResult !== 'string') return '';
  const clean = strip0x(hexResult);
  return clean.slice(wordIndex * 64, (wordIndex + 1) * 64);
}

export function decodeUint256At(hexResult: string | null | undefined, wordIndex = 0): bigint {
  const word = decodeWord(hexResult, wordIndex);
  if (!word) return 0n;
  return BigInt(`0x${word}`);
}

export function decodeAddressAt(hexResult: string | null | undefined, wordIndex = 0): string | null {
  const word = decodeWord(hexResult, wordIndex);
  if (word.length < 40) return null;
  return `0x${word.slice(-40).toLowerCase()}`;
}

export function parseUnits(amountStr: string, decimals: number): bigint {
  const trimmed = amountStr.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return 0n;
  const [wholePart, fracPart = ''] = trimmed.split('.');
  const paddedFrac = (fracPart + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(`${wholePart}${paddedFrac}`);
}

export function formatUnits(raw: bigint, decimals: number, maxFractionDigits = 8): string {
  const neg = raw < 0n;
  const abs = neg ? -raw : raw;
  const divisor = 10n ** BigInt(decimals);
  const whole = abs / divisor;
  const rem = abs % divisor;
  if (rem === 0n || decimals === 0) return `${neg ? '-' : ''}${whole}`;
  const fracFull = rem.toString().padStart(decimals, '0');
  const sliced = fracFull.slice(0, Math.max(1, maxFractionDigits)).replace(/0+$/, '');
  return sliced ? `${neg ? '-' : ''}${whole}.${sliced}` : `${neg ? '-' : ''}${whole}`;
}

export function encodeErc20BalanceOf(owner: string): string {
  return `0x70a08231${encodeAddress(owner)}`;
}

export function encodeErc20Allowance(owner: string, spender: string): string {
  return `0xdd62ed3e${encodeAddress(owner)}${encodeAddress(spender)}`;
}

export function encodeErc20Approve(spender: string, amount: bigint): string {
  return `0x095ea7b3${encodeAddress(spender)}${encodeUint(amount)}`;
}

export function encodePermit2Allowance(owner: string, token: string, spender: string): string {
  return `0x927da105${encodeAddress(owner)}${encodeAddress(token)}${encodeAddress(spender)}`;
}

export function encodePermit2Approve(
  token: string,
  spender: string,
  amount160: bigint = MAX_UINT160,
  expiration48: bigint = MAX_UINT48,
): string {
  return (
    '0x87517c45' +
    encodeAddress(token) +
    encodeAddress(spender) +
    encodeUint(amount160) +
    encodeUint(expiration48)
  );
}

/**
 * Pons V2 bonding curve direct buy/sell calldata (verified against Robinhood mainnet txs).
 */
export function encodePonsV2Buy(quoteAmountIn: bigint, minTokensOut: bigint, recipient: string): string {
  return (
    '0x59a87bc1' +
    encodeUint(quoteAmountIn) +
    encodeUint(minTokensOut) +
    encodeAddress(recipient)
  );
}

export function encodePonsV2Sell(tokenAmountIn: bigint, minQuoteOut: bigint, recipient: string): string {
  return (
    '0xd04c6983' +
    encodeUint(tokenAmountIn) +
    encodeUint(minQuoteOut) +
    encodeAddress(recipient)
  );
}

export interface UniswapV4PoolKey {
  currency0: string;
  currency1: string;
  fee: number;
  tickSpacing: number;
  hooks: string;
}

export function computeV4PoolId(poolKey: UniswapV4PoolKey): string {
  const encoded =
    encodeAddress(poolKey.currency0) +
    encodeAddress(poolKey.currency1) +
    encodeUint(poolKey.fee) +
    encodeInt(poolKey.tickSpacing) +
    encodeAddress(poolKey.hooks);
  return keccak256Hex(`0x${encoded}`);
}

export function computeV4StateSlot(poolIdHex: string): string {
  const packed = padWord(poolIdHex) + encodeUint(6n);
  return keccak256Hex(`0x${packed}`);
}

/**
 * Encode UniversalRouter.execute(bytes commands, bytes[] inputs, uint256 deadline) -> 0x3593564c.
 */
export function encodeUniversalRouterExecute(
  commandsHex: string,
  inputsHex: string[],
  deadlineSeconds: bigint,
): string {
  const commandsEncoded = encodeDynamicBytes(commandsHex);
  const inputsEncoded = encodeBytesArray(inputsHex);
  const headWords = 3; // offset commands, offset inputs, deadline
  const commandsOffset = headWords * 32;
  const inputsOffset = commandsOffset + commandsEncoded.length / 2;

  return (
    '0x3593564c' +
    encodeUint(commandsOffset) +
    encodeUint(inputsOffset) +
    encodeUint(deadlineSeconds) +
    commandsEncoded +
    inputsEncoded
  );
}

/**
 * Build UniversalRouter V4_SWAP command (verified against mainnet buy 0xefaf9d5d & sell 0x8364dac6).
 */
export function buildUniversalRouterV4SwapInput(params: {
  poolKey: UniswapV4PoolKey;
  zeroForOne: boolean;
  amountIn: bigint;
  amountOutMinimum: bigint;
  isSellErc20: boolean;
  wrapNativeBeforeSwap?: boolean;
}): { commandsHex: string; inputsHex: string[] } {
  const currencyIn = params.zeroForOne ? params.poolKey.currency0 : params.poolKey.currency1;
  const currencyOut = params.zeroForOne ? params.poolKey.currency1 : params.poolKey.currency0;

  // ExactInputSingleParams tuple:
  // offset(0x20) + PoolKey(5 words) + zeroForOne + amountIn + amountOutMinimum + hookDataOffset(0x120) + hookDataLen(0)
  const swapExactInSingle =
    encodeUint(0x20n) +
    encodeAddress(params.poolKey.currency0) +
    encodeAddress(params.poolKey.currency1) +
    encodeUint(params.poolKey.fee) +
    encodeInt(params.poolKey.tickSpacing) +
    encodeAddress(params.poolKey.hooks) +
    encodeBool(params.zeroForOne) +
    encodeUint(params.amountIn) +
    encodeUint(params.amountOutMinimum) +
    encodeUint(0x120n) +
    encodeUint(0n);

  // Actions:
  // Native ETH / wrapped-in router-paid: SWAP_EXACT_IN_SINGLE (0x06), SETTLE (0x0b), TAKE_ALL (0x0f)
  // User ERC-20 via Permit2: SWAP_EXACT_IN_SINGLE (0x06), SETTLE_ALL (0x0c), TAKE_ALL (0x0f)
  const actionsHex = params.isSellErc20 ? '060c0f' : '060b0f';
  const settleParam = params.isSellErc20
    ? encodeAddress(currencyIn) + encodeUint(params.amountIn)
    : encodeAddress(currencyIn) + encodeUint(params.amountIn) + encodeBool(false);
  const takeAllParam = encodeAddress(currencyOut) + encodeUint(params.amountOutMinimum);

  const actionsEncoded = encodeDynamicBytes(actionsHex);
  const paramsEncoded = encodeBytesArray([swapExactInSingle, settleParam, takeAllParam]);
  const v4Input = encodeUint(0x40n) + encodeUint(0x40 + actionsEncoded.length / 2) + actionsEncoded + paramsEncoded;

  if (params.wrapNativeBeforeSwap) {
    // 0x0b = WRAP_ETH(ADDRESS_THIS, amountIn), 0x10 = V4_SWAP
    const wrapInput = encodeAddress(UNIVERSAL_ROUTER_ADDRESS_THIS) + encodeUint(params.amountIn);
    return {
      commandsHex: '0b10',
      inputsHex: [wrapInput, v4Input],
    };
  }

  return {
    commandsHex: '10',
    inputsHex: [v4Input],
  };
}

/**
 * Build UniversalRouter V3_SWAP_EXACT_IN command pair (with WRAP_ETH on buy or UNWRAP_WETH on sell).
 */
export function buildUniversalRouterV3SwapInput(params: {
  tokenIn: string;
  tokenOut: string;
  fee: number;
  amountIn: bigint;
  amountOutMinimum: bigint;
  recipient: string;
  wrapNativeEth: boolean;
  unwrapNativeEth: boolean;
}): { commandsHex: string; inputsHex: string[] } {
  const pathHex =
    strip0x(params.tokenIn).slice(-40).padStart(40, '0') +
    params.fee.toString(16).padStart(6, '0') +
    strip0x(params.tokenOut).slice(-40).padStart(40, '0');

  const pathEncoded = encodeDynamicBytes(pathHex);
  const payerIsUser = !params.wrapNativeEth;
  const swapRecipient = params.unwrapNativeEth ? UNIVERSAL_ROUTER_ADDRESS_THIS : params.recipient;

  // V3_SWAP_EXACT_IN(address recipient, uint256 amountIn, uint256 amountOutMinimum, bytes path, bool payerIsUser)
  const v3Input =
    encodeAddress(swapRecipient) +
    encodeUint(params.amountIn) +
    encodeUint(params.amountOutMinimum) +
    encodeUint(5 * 32) +
    encodeBool(payerIsUser) +
    pathEncoded;

  if (params.wrapNativeEth) {
    const wrapInput = encodeAddress(UNIVERSAL_ROUTER_ADDRESS_THIS) + encodeUint(params.amountIn);
    return { commandsHex: '0b00', inputsHex: [wrapInput, v3Input] };
  }
  if (params.unwrapNativeEth) {
    const unwrapInput = encodeAddress(params.recipient) + encodeUint(params.amountOutMinimum);
    return { commandsHex: '000c', inputsHex: [v3Input, unwrapInput] };
  }
  return { commandsHex: '00', inputsHex: [v3Input] };
}
