import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTrackedWalletsManager,
  INITIAL_TRACKED_WALLETS,
  INITIAL_LIVE_TRADES,
} from '../tracked-wallets-store';

describe('TrackedWallets Manager & Logic', () => {
  it('initializes with default seed smart-money wallets', () => {
    const manager = createTrackedWalletsManager();
    const wallets = manager.getWallets();
    expect(wallets.length).toBeGreaterThanOrEqual(1);
    expect(wallets[0].address).toBe(INITIAL_TRACKED_WALLETS[0].address);
    expect(INITIAL_LIVE_TRADES.length).toBeGreaterThanOrEqual(1);
  });

  it('adds a new tracked wallet', () => {
    const manager = createTrackedWalletsManager();

    const newWallet = {
      address: 'TestAddress111111111111111111111111111111111',
      label: 'Whale Tester',
      category: 'WHALE' as const,
      notes: 'Testing add wallet functionality',
    };

    const added = manager.add(newWallet);
    expect(added.address).toBe(newWallet.address);
    expect(manager.isTracked(newWallet.address)).toBe(true);

    const list = manager.getWallets();
    expect(list.some((w) => w.address === newWallet.address)).toBe(true);
  });

  it('removes a tracked wallet successfully', () => {
    const manager = createTrackedWalletsManager();
    const targetAddr = INITIAL_TRACKED_WALLETS[0].address;

    expect(manager.isTracked(targetAddr)).toBe(true);
    const removed = manager.remove(targetAddr);
    expect(removed).toBe(true);
    expect(manager.isTracked(targetAddr)).toBe(false);
  });

  it('updates a tracked wallet nickname and category', () => {
    const manager = createTrackedWalletsManager();
    const targetAddr = INITIAL_TRACKED_WALLETS[0].address;

    const updated = manager.update(targetAddr, {
      label: 'Renamed Alpha Master',
      category: 'KOL',
    });

    expect(updated?.label).toBe('Renamed Alpha Master');
    expect(updated?.category).toBe('KOL');

    const wallet = manager.getWallets().find((w) => w.address === targetAddr);
    expect(wallet?.label).toBe('Renamed Alpha Master');
    expect(wallet?.category).toBe('KOL');
  });

  it('correctly reports isTracked for case-insensitive addresses', () => {
    const manager = createTrackedWalletsManager();
    const targetAddr = INITIAL_TRACKED_WALLETS[0].address;
    expect(manager.isTracked(targetAddr.toLowerCase())).toBe(true);
    expect(manager.isTracked('unknown_address_999')).toBe(false);
  });
});
