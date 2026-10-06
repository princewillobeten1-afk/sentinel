'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TrendSource, TrendCategory } from '@/lib/trends/types';

interface TrendRadarStoreState {
  isOpen: boolean;
  activeSource: string; // 'all' | 'tiktok' | 'x' | 'news' | 'culture'
  activeCategory: string; // 'all' | 'meme' | 'animals' | 'ai' | ...
  searchQuery: string;
  selectedTrendId: string | null;
  unreadCount: number;
  lastViewedAt: number;

  // Actions
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  setActiveSource: (source: string) => void;
  setActiveCategory: (category: string) => void;
  setSearchQuery: (query: string) => void;
  selectTrend: (id: string | null) => void;
  setUnreadCount: (count: number) => void;
  markAsRead: () => void;
}

export const useTrendRadarStore = create<TrendRadarStoreState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      activeSource: 'all',
      activeCategory: 'all',
      searchQuery: '',
      selectedTrendId: null,
      unreadCount: 4,
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

      setActiveSource: (activeSource) => set({ activeSource }),
      setActiveCategory: (activeCategory) => set({ activeCategory }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      selectTrend: (selectedTrendId) => set({ selectedTrendId }),
      setUnreadCount: (unreadCount) => set({ unreadCount }),
      markAsRead: () => set({ unreadCount: 0, lastViewedAt: Date.now() }),
    }),
    {
      name: 'sentinel_trend_radar_prefs',
      partialize: (state) => ({
        activeSource: state.activeSource,
        activeCategory: state.activeCategory,
      }),
    }
  )
);
