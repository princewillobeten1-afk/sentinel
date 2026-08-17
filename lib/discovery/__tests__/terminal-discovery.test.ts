import { describe, it, expect } from 'vitest';
import { formatCompactUSD, formatSmartPrice, formatCount } from '@/lib/discovery/formatters';
import { getMockDiscoveryTokens, filterDiscoveryTokens } from '@/lib/discovery/service';
import type { DiscoveryToken, DiscoveryFilter } from '@/lib/discovery/types';

describe('Trenches Terminal Discovery Architecture', () => {
  describe('Compact Price & Metric Formatters', () => {
    it('formats USD amounts in compact human-readable notation', () => {
      expect(formatCompactUSD(0)).toBe('$0');
      expect(formatCompactUSD(0.752)).toBe('$0.752');
      expect(formatCompactUSD(566)).toBe('$566');
      expect(formatCompactUSD(2130)).toBe('$2.1K');
      expect(formatCompactUSD(27000)).toBe('$27K');
      expect(formatCompactUSD(610000)).toBe('$610K');
      expect(formatCompactUSD(1850000)).toBe('$1.85M');
      expect(formatCompactUSD(42500000)).toBe('$42.5M');
    });

    it('formats token prices with adaptive precision and subscript zeros', () => {
      expect(formatSmartPrice(1245.50)).toBe('$1,245.50');
      expect(formatSmartPrice(3.45)).toBe('$3.45');
      expect(formatSmartPrice(0.0412)).toBe('$0.0412');
      expect(formatSmartPrice(0.000495)).toBe('$0.00049');
      // Subscript zeros for tiny meme-coin prices
      expect(formatSmartPrice(0.00002845)).toBe('$0.0₄284');
    });

    it('formats holder and transaction counts cleanly', () => {
      expect(formatCount(1)).toBe('1');
      expect(formatCount(47)).toBe('47');
      expect(formatCount(513)).toBe('513');
      expect(formatCount(1840)).toBe('1.8K');
      expect(formatCount(42100)).toBe('42K');
      expect(formatCount(689000)).toBe('689K');
    });
  });

  describe('Discovery Feeds & Section Sorting', () => {
    it('returns tokens sorted by age for New Launches feed', () => {
      const newTokens = getMockDiscoveryTokens({ section: 'new' });
      expect(newTokens.length).toBeGreaterThan(0);
      for (let i = 0; i < newTokens.length - 1; i++) {
        expect(newTokens[i].ageMinutes).toBeLessThanOrEqual(newTokens[i + 1].ageMinutes);
      }
    });

    it('returns tokens approaching migration threshold for Migrating feed', () => {
      const migratingTokens = getMockDiscoveryTokens({ section: 'migrating' });
      expect(migratingTokens.length).toBeGreaterThan(0);
      migratingTokens.forEach((t) => {
        expect(t.migrationProgress).toBeGreaterThanOrEqual(40);
        expect(t.migrationProgress).toBeLessThan(100);
      });
    });

    it('returns graduated tokens for Graduated feed', () => {
      const graduatedTokens = getMockDiscoveryTokens({ section: 'graduated' });
      expect(graduatedTokens.length).toBeGreaterThan(0);
      graduatedTokens.forEach((t) => {
        expect((t.migrationProgress ?? 0) >= 100 || t.bondingStatus === 'graduated').toBe(true);
      });
    });

    it('returns tokens sorted by smart money count for Smart Money feed', () => {
      const smartMoneyTokens = getMockDiscoveryTokens({ section: 'smart-money' });
      expect(smartMoneyTokens.length).toBeGreaterThan(0);
      for (let i = 0; i < smartMoneyTokens.length - 1; i++) {
        expect(smartMoneyTokens[i].smartMoneyCount ?? 0).toBeGreaterThanOrEqual(smartMoneyTokens[i + 1].smartMoneyCount ?? 0);
      }
    });
  });

  describe('Range & Advanced Safety Filtering', () => {
    const allTokens = getMockDiscoveryTokens();

    it('filters tokens by minimum liquidity and maximum market cap', () => {
      const filter: Partial<DiscoveryFilter> = {
        liquidityMin: 50000,
        marketCapMax: 10000000,
      };
      const result = filterDiscoveryTokens(allTokens, filter);
      result.forEach((t) => {
        expect(parseFloat(t.liquidityUsd)).toBeGreaterThanOrEqual(50000);
        expect(parseFloat(t.marketCapUsd)).toBeLessThanOrEqual(10000000);
      });
    });

    it('filters tokens by maximum top-10 concentration and dev holdings', () => {
      const filter: Partial<DiscoveryFilter> = {
        top10HoldingsMax: 30,
        devHoldingsMax: 5,
      };
      const result = filterDiscoveryTokens(allTokens, filter);
      result.forEach((t) => {
        expect(t.top10HoldingsPct ?? 0).toBeLessThanOrEqual(30);
        expect(t.devHoldingsPct ?? 0).toBeLessThanOrEqual(5);
      });
    });

    it('filters tokens by search query matching symbol or name', () => {
      const result = filterDiscoveryTokens(allTokens, { searchQuery: 'bonk' });
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].symbol).toBe('BONK');
    });
  });
});
