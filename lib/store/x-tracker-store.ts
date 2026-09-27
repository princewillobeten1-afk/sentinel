'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { XCallCategory } from '@/lib/x-tracker/types';

export type XTextSize = 'compact' | 'normal' | 'spacious';

interface XTrackerStoreState {
  isOpen: boolean;
  activeCategory: XCallCategory;
  searchQuery: string;
  soundEnabled: boolean;
  textSize: XTextSize;
  customTrackedHandles: string[];
  unreadCount: number;
  lastViewedAt: number;

  // Actions
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  setActiveCategory: (category: XCallCategory) => void;
  setSearchQuery: (query: string) => void;
  setSoundEnabled: (enabled: boolean) => void;
  toggleSound: () => void;
  cycleTextSize: () => void;
  addTrackedHandle: (handle: string) => void;
  removeTrackedHandle: (handle: string) => void;
  setUnreadCount: (count: number) => void;
  markAsRead: () => void;
}

export const useXTrackerStore = create<XTrackerStoreState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      activeCategory: 'all',
      searchQuery: '',
      soundEnabled: false,
      textSize: 'normal',
      customTrackedHandles: ['@hako99', '@AnonHands', '@BregEgg', '@OG_verified'],
      unreadCount: 3,
      lastViewedAt: Date.now(),

      setOpen: (isOpen) =>
        set((state) => {
          if (isOpen) {
            return { isOpen, unreadCount: 0, lastViewedAt: Date.now() };
          }
          return { isOpen };
        }),

      toggleOpen: () => {
        const next = !get().isOpen;
        get().setOpen(next);
      },

      setActiveCategory: (activeCategory) => set({ activeCategory }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),

      cycleTextSize: () => {
        const sizes: XTextSize[] = ['compact', 'normal', 'spacious'];
        const currentIdx = sizes.indexOf(get().textSize);
        const nextSize = sizes[(currentIdx + 1) % sizes.length];
        set({ textSize: nextSize });
      },

      addTrackedHandle: (rawHandle) => {
        const handle = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`;
        set((state) => {
          if (state.customTrackedHandles.includes(handle)) return state;
          return { customTrackedHandles: [...state.customTrackedHandles, handle] };
        });
      },

      removeTrackedHandle: (rawHandle) => {
        const handle = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`;
        set((state) => ({
          customTrackedHandles: state.customTrackedHandles.filter((h) => h.toLowerCase() !== handle.toLowerCase()),
        }));
      },

      setUnreadCount: (unreadCount) => set({ unreadCount }),
      markAsRead: () => set({ unreadCount: 0, lastViewedAt: Date.now() }),
    }),
    {
      name: 'sentinel_x_tracker_prefs',
      partialize: (state) => ({
        soundEnabled: state.soundEnabled,
        textSize: state.textSize,
        customTrackedHandles: state.customTrackedHandles,
      }),
    }
  )
);
