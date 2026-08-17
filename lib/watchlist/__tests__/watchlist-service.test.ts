import { describe, it, expect, beforeEach } from 'vitest';
import { watchlistService } from '../watchlist-service';

describe('Watchlist Service (Sprint 46 §56-58)', () => {
  beforeEach(() => {
    watchlistService.reset();
  });

  it('adds and removes tokens from user watchlist and verifies membership', () => {
    const user = 'user_test_watchlist';
    const token = 'token_test_abc_123';

    expect(watchlistService.isWatchlisted(user, token)).toBe(false);

    const added = watchlistService.addToWatchlist(user, token);
    expect(added).toBe(true);
    expect(watchlistService.isWatchlisted(user, token)).toBe(true);

    const list = watchlistService.getWatchlist(user);
    expect(list.length).toBe(1);
    expect(list[0].tokenId).toBe(token);

    const removed = watchlistService.removeFromWatchlist(user, token);
    expect(removed).toBe(true);
    expect(watchlistService.isWatchlisted(user, token)).toBe(false);
  });
});
