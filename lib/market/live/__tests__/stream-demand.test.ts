import { describe, it, expect, beforeEach } from 'vitest';
import {
  noteClientConnected,
  noteClientDisconnected,
  getLiveClientCount,
  onDemandChange,
  noteMintsWanted,
  noteMintsReleased,
  getWatchedMints,
  onWatchedMintsChange,
  __resetDemand,
} from '../stream-demand';

describe('stream demand — connections', () => {
  beforeEach(() => __resetDemand());

  it('starts at zero, so a booting server watches nothing', () => {
    expect(getLiveClientCount()).toBe(0);
    expect(getWatchedMints()).toEqual([]);
  });

  it('counts connects and disconnects', () => {
    noteClientConnected();
    noteClientConnected();
    expect(getLiveClientCount()).toBe(2);
    noteClientDisconnected();
    expect(getLiveClientCount()).toBe(1);
  });

  it('never goes negative', () => {
    noteClientDisconnected();
    noteClientDisconnected();
    expect(getLiveClientCount()).toBe(0);
    noteClientConnected();
    expect(getLiveClientCount()).toBe(1);
  });

  it('notifies listeners on every change, and not on a clamped no-op', () => {
    const seen: number[] = [];
    onDemandChange((count) => seen.push(count));
    noteClientDisconnected();
    noteClientConnected();
    noteClientConnected();
    noteClientDisconnected();
    expect(seen).toEqual([1, 2, 1]);
  });

  it('keeps delivering to other listeners when one throws', () => {
    const seen: number[] = [];
    onDemandChange(() => {
      throw new Error('listener blew up');
    });
    onDemandChange((count) => seen.push(count));
    expect(() => noteClientConnected()).not.toThrow();
    expect(seen).toEqual([1]);
  });
});

describe('stream demand — watched mints', () => {
  beforeEach(() => __resetDemand());

  it('watches a mint while any topic names it', () => {
    // One client holding price and trade topics for the same token: two
    // references, and the mint must survive the first release.
    noteMintsWanted(['A', 'A']);
    noteMintsReleased(['A']);
    expect(getWatchedMints()).toEqual(['A']);
    noteMintsReleased(['A']);
    expect(getWatchedMints()).toEqual([]);
  });

  it('keeps a mint watched while another client still holds it', () => {
    noteMintsWanted(['A']); // client 1
    noteMintsWanted(['A', 'B']); // client 2
    noteMintsReleased(['A']); // client 1 leaves
    expect(getWatchedMints().sort()).toEqual(['A', 'B']);
  });

  it('never goes negative, so a stray release cannot drain real demand', () => {
    noteMintsReleased(['A']);
    noteMintsWanted(['A']);
    expect(getWatchedMints()).toEqual(['A']);
  });

  it('notifies on set changes only, not on reference changes', () => {
    const seen: string[][] = [];
    onWatchedMintsChange((mints) => seen.push([...mints].sort()));

    noteMintsWanted(['A']); // A appears
    noteMintsWanted(['A']); // second reference — set unchanged
    noteMintsWanted(['B']); // B appears
    noteMintsReleased(['A']); // A still has one reference
    noteMintsReleased(['A']); // A gone

    expect(seen).toEqual([['A'], ['A', 'B'], ['B']]);
  });

  it('ignores empty mints', () => {
    noteMintsWanted(['']);
    expect(getWatchedMints()).toEqual([]);
  });

  it('stops notifying after unsubscribe', () => {
    const seen: string[][] = [];
    const off = onWatchedMintsChange((mints) => seen.push(mints));
    noteMintsWanted(['A']);
    off();
    noteMintsWanted(['B']);
    expect(seen).toEqual([['A']]);
  });
});
