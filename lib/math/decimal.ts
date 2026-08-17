export type RoundingMode = 'FLOOR' | 'CEIL' | 'HALF_UP';

/**
 * Fixed-point Decimal precision library for Sentinel financial calculations.
 * Avoids JavaScript floating-point representation loss (e.g. 0.1 * 0.2 = 0.020000000000000004).
 * Uses native BigInt with 18 fixed decimal places.
 */
export class Decimal {
  public static readonly DECIMALS = 18;
  public static readonly SCALE = 10n ** 18n; // 1,000,000,000,000,000,000n

  private readonly rawValue: bigint;

  constructor(value: bigint | string | number) {
    if (typeof value === 'bigint') {
      this.rawValue = value;
    } else if (typeof value === 'string') {
      this.rawValue = Decimal.parseString(value, Decimal.DECIMALS);
    } else if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new Error(`Invalid non-finite number passed to Decimal: ${value}`);
      }
      this.rawValue = Decimal.parseString(value.toFixed(14), Decimal.DECIMALS);
    } else {
      throw new Error('Invalid value type passed to Decimal constructor.');
    }
  }

  public get raw(): bigint {
    return this.rawValue;
  }

  /**
   * Converts string representation (e.g. "142.50") into BigInt base units (18 decimals).
   */
  public static parseString(strVal: string, decimals = 18): bigint {
    const trimmed = strVal.trim();
    if (!trimmed || isNaN(Number(trimmed))) {
      return 0n;
    }

    const parts = trimmed.split('.');
    let integerPart = parts[0] || '0';
    let fractionalPart = parts[1] || '';

    // Pad or truncate fractional part to specified decimals
    if (fractionalPart.length > decimals) {
      fractionalPart = fractionalPart.slice(0, decimals);
    } else {
      fractionalPart = fractionalPart.padEnd(decimals, '0');
    }

    const combined = `${integerPart}${fractionalPart}`;
    return BigInt(combined);
  }

  /**
   * Formats BigInt base units back into a decimal string, rounded/padded to
   * `decimals` fractional digits for display.
   *
   * The raw value is always stored at the fixed `Decimal.DECIMALS` (18)
   * scale (see the constructor / `parseString`) — this must always split on
   * that fixed scale first, then truncate/pad the fractional part to the
   * requested display precision. A previous version split directly on the
   * `decimals` parameter, which silently corrupted the result for any call
   * with `decimals !== 18` (e.g. `toNumber()`'s `toString(6)`): a value like
   * `10` (stored as `10 * 10^18`) would misinterpret its last 6 raw digits
   * as the fractional part, producing something on the order of `10^13`
   * instead of `10`.
   */
  public toString(decimals = 18): string {
    const isNegative = this.rawValue < 0n;
    const absVal = isNegative ? -this.rawValue : this.rawValue;
    const str = absVal.toString().padStart(Decimal.DECIMALS + 1, '0');

    const integerPart = str.slice(0, str.length - Decimal.DECIMALS);
    const fullFractionalPart = str.slice(str.length - Decimal.DECIMALS);
    const fractionalPart =
      decimals >= Decimal.DECIMALS ? fullFractionalPart.padEnd(decimals, '0') : fullFractionalPart.slice(0, decimals);

    const result = decimals > 0 ? `${integerPart}.${fractionalPart}` : integerPart;
    return isNegative ? `-${result}` : result;
  }

  /**
   * Safe fixed-point Addition
   */
  public add(other: Decimal | string | number): Decimal {
    const b = other instanceof Decimal ? other : new Decimal(other);
    return new Decimal(this.rawValue + b.rawValue);
  }

  /**
   * Safe fixed-point Subtraction
   */
  public sub(other: Decimal | string | number): Decimal {
    const b = other instanceof Decimal ? other : new Decimal(other);
    return new Decimal(this.rawValue - b.rawValue);
  }

  /**
   * Safe fixed-point Multiplication (amount * price)
   */
  public mul(other: Decimal | string | number): Decimal {
    const b = other instanceof Decimal ? other : new Decimal(other);
    // (a * b) / SCALE
    const product = (this.rawValue * b.rawValue) / Decimal.SCALE;
    return new Decimal(product);
  }

  /**
   * Safe fixed-point Division
   */
  public div(other: Decimal | string | number, mode: RoundingMode = 'HALF_UP'): Decimal {
    const b = other instanceof Decimal ? other : new Decimal(other);
    if (b.rawValue === 0n) {
      throw new Error('Division by zero in Decimal operation.');
    }

    // (a * SCALE) / b
    const numerator = this.rawValue * Decimal.SCALE;
    let quotient = numerator / b.rawValue;
    const remainder = numerator % b.rawValue;

    if (remainder !== 0n) {
      if (mode === 'CEIL' && remainder > 0n) {
        quotient += 1n;
      } else if (mode === 'HALF_UP') {
        const doubleRemainder = remainder * 2n;
        if (doubleRemainder >= b.rawValue) {
          quotient += 1n;
        }
      }
    }

    return new Decimal(quotient);
  }

  /**
   * Convert to Javascript number safely for UI charts (not for calculations)
   */
  public toNumber(): number {
    return parseFloat(this.toString(6));
  }

  /**
   * Convert standard token amount (e.g. "1.5" SOL) to atomic base units (e.g. 1500000000n lamports for 9 decimals)
   */
  public static toBaseUnits(amountStr: string, tokenDecimals = 9): bigint {
    return Decimal.parseString(amountStr, tokenDecimals);
  }

  /**
   * Convert atomic base units (e.g. 1500000000n lamports) to standard token amount string ("1.500000000")
   */
  public static fromBaseUnits(baseUnits: bigint, tokenDecimals = 9): string {
    const isNegative = baseUnits < 0n;
    const absVal = isNegative ? -baseUnits : baseUnits;
    const str = absVal.toString().padStart(tokenDecimals + 1, '0');

    const integerPart = str.slice(0, str.length - tokenDecimals);
    const fractionalPart = str.slice(str.length - tokenDecimals);

    const result = `${integerPart}.${fractionalPart}`;
    return isNegative ? `-${result}` : result;
  }

  /**
   * Format USD currency with comma grouping and 2-4 decimal places
   */
  public formatUSD(decimals = 2): string {
    const num = this.toNumber();
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  }

  /**
   * Format Token balance formatted cleanly
   */
  public formatToken(decimals = 4): string {
    const num = this.toNumber();
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  }
}
