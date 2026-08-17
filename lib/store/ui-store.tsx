'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AppView, DensityMode, NetworkId } from '@/lib/store';
import {
  UI_SCALE_MIN,
  UI_SCALE_MAX,
  UI_SCALE_DEFAULT,
  UI_SCALE_STORAGE_KEY,
  clampUiScale,
  rootFontSizeFor,
} from './ui-scale';

export type ThemeMode = 'dark' | 'light';

export { UI_SCALE_MIN, UI_SCALE_MAX, UI_SCALE_DEFAULT, clampUiScale } from './ui-scale';

interface UIState {
  activeView: AppView;
  activeNetwork: NetworkId;
  density: DensityMode;
  theme: ThemeMode;
  uiScale: number;
  isSidebarCollapsed: boolean;
  isMobileNavOpen: boolean;
  isCommandPaletteOpen: boolean;
  isHotkeysOpen: boolean;
  isConsoleOpen: boolean;
}

interface UIActions {
  setActiveView: (view: AppView) => void;
  setActiveNetwork: (network: NetworkId) => void;
  setDensity: (density: DensityMode) => void;
  setTheme: (theme: ThemeMode) => void;
  /** Clamped to 10–200. */
  setUiScale: (scale: number) => void;
  adjustUiScale: (delta: number) => void;
  resetUiScale: () => void;
  toggleSidebar: () => void;
  setMobileNavOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setHotkeysOpen: (open: boolean) => void;
  setConsoleOpen: (open: boolean) => void;
}

const UIStateContext = createContext<UIState | undefined>(undefined);
const UIActionsContext = createContext<UIActions | undefined>(undefined);

export function UIStoreProvider({ children }: { children: React.ReactNode }) {
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [activeNetwork, setActiveNetwork] = useState<NetworkId>('mainnet');
  const [density, setDensity] = useState<DensityMode>('standard');
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isHotkeysOpen, setIsHotkeysOpen] = useState(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [uiScale, setUiScaleState] = useState<number>(UI_SCALE_DEFAULT);

  // Restore the saved scale once on mount. Deliberately not part of the
  // initial useState: reading localStorage during render would differ between
  // server and client and trip hydration.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(UI_SCALE_STORAGE_KEY);
      if (saved !== null) setUiScaleState(clampUiScale(Number(saved)));
    } catch {
      // Private mode or storage disabled — the default is fine.
    }
  }, []);

  useEffect(() => {
    document.documentElement.style.fontSize = `${rootFontSizeFor(uiScale)}px`;
    try {
      window.localStorage.setItem(UI_SCALE_STORAGE_KEY, String(uiScale));
    } catch {
      // Non-fatal: the scale still applies for this session.
    }
  }, [uiScale]);

  const setUiScale = useCallback((scale: number) => setUiScaleState(clampUiScale(scale)), []);
  const adjustUiScale = useCallback((delta: number) => setUiScaleState((prev) => clampUiScale(prev + delta)), []);
  const resetUiScale = useCallback(() => setUiScaleState(UI_SCALE_DEFAULT), []);

  /**
   * Keyboard control — and the escape hatch.
   *
   * At the low end of the range the interface becomes genuinely too small to
   * operate, which would otherwise strand someone who scaled down past the
   * point of being able to click the control that scales back up. Ctrl/Cmd+0
   * always restores 100%, so there is a way out that doesn't depend on being
   * able to see anything.
   */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === '0') {
        e.preventDefault();
        resetUiScale();
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        adjustUiScale(10);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        adjustUiScale(-10);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [adjustUiScale, resetUiScale]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleSidebar = useCallback(() => setIsSidebarCollapsed((prev) => !prev), []);

  return (
    <UIStateContext.Provider
      value={{
        activeView,
        activeNetwork,
        density,
        theme,
        uiScale,
        isSidebarCollapsed,
        isMobileNavOpen,
        isCommandPaletteOpen,
        isHotkeysOpen,
        isConsoleOpen,
      }}
    >
      <UIActionsContext.Provider
        value={{
          setActiveView,
          setActiveNetwork,
          setDensity,
          setTheme,
          setUiScale,
          adjustUiScale,
          resetUiScale,
          toggleSidebar,
          setMobileNavOpen: setIsMobileNavOpen,
          setCommandPaletteOpen: setIsCommandPaletteOpen,
          setHotkeysOpen: setIsHotkeysOpen,
          setConsoleOpen: setIsConsoleOpen,
        }}
      >
        {children}
      </UIActionsContext.Provider>
    </UIStateContext.Provider>
  );
}

export function useUIState() {
  const context = useContext(UIStateContext);
  if (!context) throw new Error('useUIState must be used within UIStoreProvider');
  return context;
}

export function useUIActions() {
  const context = useContext(UIActionsContext);
  if (!context) throw new Error('useUIActions must be used within UIStoreProvider');
  return context;
}
