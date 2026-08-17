/**
 * Formats user input as the plain decimal strings the order API requires.
 *
 * `POST /api/v1/orders` validates `quantity`, `limitPrice`, `stopPrice` and
 * `slippageLimit` against `/^\d+(\.\d+)?$/` and stores them in NUMERIC columns.
 * Strings, not numbers, are deliberate: the whole point of the Phase 3 money
 * design is that a value never round-trips through a JS float, where
 * 1234.567890123456789 quietly becomes 1234.5678901234568.
 *
 * That regex is stricter than `String(someNumber)` in three ways this module
 * has to handle, each of which produces a 422 rather than a wrong number:
 *   - no exponent notation, and `String(1e-7)` is `"1e-7"`;
 *   - a leading digit is required, so `".5"` is rejected;
 *   - no sign, so a negative value must be caught before it is sent.
 */

/** Thrown when input cannot be expressed as a valid decimal for the API. */
export class DecimalInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecimalInputError';
  }
}

const PLAIN_DECIMAL = /^\d+(\.\d+)?$/;

/**
 * Normalises a user-typed amount into an API-acceptable decimal string.
 *
 * Takes the typed text rather than a parsed number wherever possible, so the
 * digits the user entered are the digits that are sent.
 */
export function toDecimalString(input: string | number): string {
  let text = typeof input === 'number' ? formatNumber(input) : input.trim();

  if (!text) throw new DecimalInputError('Enter an amount.');

  // Tolerate the shapes people actually type.
  if (text.startsWith('+')) text = text.slice(1);
  if (text.startsWith('.')) text = `0${text}`;
  if (text.endsWith('.')) text = text.slice(0, -1);

  if (text.startsWith('-')) {
    throw new DecimalInputError('Amount cannot be negative.');
  }

  if (!PLAIN_DECIMAL.test(text)) {
    throw new DecimalInputError(`"${input}" is not a valid amount.`);
  }

  return text;
}

/**
 * Converts a percentage (as typed, e.g. "1.0" for 1%) into the fractional
 * decimal string the API stores (0.01).
 *
 * Done by shifting the decimal point in the string rather than dividing a
 * float: `0.3 / 100` is `0.003000000000000000...` in binary floating point, and
 * `String(1e-7)` is exponent notation the endpoint rejects outright.
 */
export function percentToDecimalString(percent: string | number): string {
  const text = toDecimalString(percent);
  const [whole, frac = ''] = text.split('.');
  const digits = `${whole}${frac}`;
  const pointFromRight = frac.length + 2; // ÷100 moves the point two places

  const padded = digits.padStart(pointFromRight + 1, '0');
  const cut = padded.length - pointFromRight;
  const result = `${padded.slice(0, cut)}.${padded.slice(cut)}`;

  // Trim trailing zeros for readability, but never leave a bare "0." or "".
  return result.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) throw new DecimalInputError('Amount must be a finite number.');
  // toFixed avoids exponent notation for the small magnitudes seen here; the
  // trailing-zero trim keeps the result tidy.
  return value.toFixed(18).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}
