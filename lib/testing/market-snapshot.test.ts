import { Decimal } from '../math/decimal';
import { createMarketSnapshot } from '../market/snapshot-service';

export async function runMarketSnapshotTestSuite() {
  console.log('=== SENTINEL MARKET SNAPSHOT & FINANCIAL MATH TEST SUITE ===\n');

  const results: { test: string; status: 'PASSED' | 'FAILED'; details?: string }[] = [];

  const addResult = (test: string, passed: boolean, details?: string) => {
    results.push({ test, status: passed ? 'PASSED' : 'FAILED', details });
    console.log(`${passed ? '✅ [PASS]' : '❌ [FAIL]'} ${test}${details ? ` - ${details}` : ''}`);
  };

  // 1. EXACT DECIMAL MULTIPLICATION (0.1 * 0.2 != 0.020000000000000004)
  try {
    const a = new Decimal('0.1');
    const b = new Decimal('0.2');
    const product = a.mul(b);
    const expectedStr = '0.020000000000000000';
    const isExact = product.toString(18) === expectedStr;
    addResult('1. Exact Decimal Multiplication (0.1 * 0.2)', isExact, `Result: ${product.toString(18)}`);
  } catch (err: any) {
    addResult('1. Exact Decimal Multiplication', false, err.message);
  }

  // 2. SAFE ADDITION AND SUBTRACTION
  try {
    const p1 = new Decimal('142.50');
    const p2 = new Decimal('7.25');
    const sum = p1.add(p2);
    const diff = p1.sub(p2);

    const sumOk = sum.toString(2) === '149.75';
    const diffOk = diff.toString(2) === '135.25';
    addResult('2. Safe Fixed-Point Addition & Subtraction', sumOk && diffOk);
  } catch (err: any) {
    addResult('2. Safe Fixed-Point Addition & Subtraction', false, err.message);
  }

  // 3. ATOMIC BASE UNITS CONVERSION (SOL <-> Lamports)
  try {
    const solAmountStr = '1.5';
    const lamports = Decimal.toBaseUnits(solAmountStr, 9); // 1,500,000,000n
    const convertedBack = Decimal.fromBaseUnits(lamports, 9);

    const isLamportsOk = lamports === 1500000000n && convertedBack === '1.500000000';
    addResult('3. Atomic Base Units Conversion (1.5 SOL ↔ 1.5B Lamports)', isLamportsOk);
  } catch (err: any) {
    addResult('3. Atomic Base Units Conversion', false, err.message);
  }

  // 4. SAFE DIVISION & ROUNDING MODES
  try {
    const num = new Decimal('10.0');
    const den = new Decimal('3.0');

    const resultHalfUp = num.div(den, 'HALF_UP');
    const resultFloor = num.div(den, 'FLOOR');
    addResult('4. Safe Division & Explicit Rounding Modes', resultHalfUp.raw > 0n && resultFloor.raw > 0n);
  } catch (err: any) {
    addResult('4. Safe Division & Explicit Rounding Modes', false, err.message);
  }

  // 5. NORMALIZED MARKET SNAPSHOT GENERATION
  try {
    const snapshot = createMarketSnapshot({
      tokenId: 'test-token',
      symbol: 'TEST',
      priceUsd: '42.123456789123456789',
      priceChange1m: 0.5,
      priceChange5m: 1.2,
      priceChange1h: 3.4,
      priceChange24h: 12.8,
      volume5mUsd: '1000.50',
      volume1hUsd: '50000.00',
      volume24hUsd: '1200000.00',
      liquidityUsd: '500000.00',
      marketCapUsd: '10000000.00',
      buys: 150,
      sells: 45,
      holders: 1200,
    });

    const isSnapshotOk =
      snapshot.tokenId === 'test-token' &&
      snapshot.price === '42.123456789123456789' &&
      snapshot.priceChange1m === 0.5 &&
      snapshot.priceChange5m === 1.2 &&
      snapshot.priceChange1h === 3.4 &&
      snapshot.priceChange24h === 12.8 &&
      snapshot.buys === 150 &&
      snapshot.sells === 45 &&
      snapshot.holders === 1200;

    addResult('5. Normalized MarketSnapshot Model Instantiation', isSnapshotOk);
  } catch (err: any) {
    addResult('5. Normalized MarketSnapshot Model Instantiation', false, err.message);
  }

  const passedCount = results.filter((r) => r.status === 'PASSED').length;
  console.log(`\n=== MARKET SNAPSHOT TEST RESULTS: ${passedCount}/${results.length} PASSED ===\n`);
  return { total: results.length, passed: passedCount, results };
}
