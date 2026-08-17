'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { mockAlerts } from '@/lib/mocks/alerts';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'risk' | 'execution' | 'system';
  timestamp: string;
  read?: boolean;
}

export interface ExecutionLog {
  id: string;
  text: string;
  level: 'info' | 'warn' | 'error' | 'success';
  timestamp: string;
}

const initialNotifications: AppNotification[] = [
  {
    id: 'n1',
    title: 'Coordinated Ownership Alert',
    message: '17 top holder wallets funded by 3 connected addresses within 22 mins on $SOLM',
    type: 'risk',
    timestamp: '2m ago',
    read: false,
  },
  {
    id: 'n2',
    title: 'Insider Liquidity Withdrawal',
    message: 'Creator wallet 7xK9...2mP transferred 12% supply to DEX routing contract',
    type: 'risk',
    timestamp: '14m ago',
    read: false,
  },
];

const initialLogs: ExecutionLog[] = [
  { id: 'l1', text: '[SENTINEL-CORE] Sollet RPC socket connected: mainnet-beta (tps: 2840)', level: 'info', timestamp: '22:54:01' },
  { id: 'l2', text: '[DISCOVERY-ENGINE] Ingested 142 new mints from Raydium / Pump.fun liquidity routers', level: 'info', timestamp: '22:54:12' },
];

interface NotificationsState {
  isNotificationsOpen: boolean;
  notifications: AppNotification[];
  executionLogs: ExecutionLog[];
}

interface NotificationsActions {
  setNotificationsOpen: (open: boolean) => void;
  addNotification: (n: Omit<AppNotification, 'id' | 'timestamp'>) => void;
  clearNotifications: () => void;
  addExecutionLog: (log: Omit<ExecutionLog, 'id' | 'timestamp'>) => void;
}

const NotificationsStateContext = createContext<NotificationsState | undefined>(undefined);
const NotificationsActionsContext = createContext<NotificationsActions | undefined>(undefined);

export function NotificationsStoreProvider({ children }: { children: React.ReactNode }) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>(initialNotifications);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>(initialLogs);

  const addNotification = useCallback((n: Omit<AppNotification, 'id' | 'timestamp'>) => {
    setNotifications((prev) => [{ ...n, id: 'n_' + Date.now(), timestamp: 'Just now', read: false }, ...prev]);
  }, []);

  const clearNotifications = useCallback(() => setNotifications([]), []);

  const addExecutionLog = useCallback((log: Omit<ExecutionLog, 'id' | 'timestamp'>) => {
    const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
    setExecutionLogs((prev) => [{ ...log, id: 'l_' + Date.now(), timestamp: timeStr }, ...prev.slice(0, 49)]);
  }, []);

  return (
    <NotificationsStateContext.Provider value={{ isNotificationsOpen, notifications, executionLogs }}>
      <NotificationsActionsContext.Provider
        value={{
          setNotificationsOpen: setIsNotificationsOpen,
          addNotification,
          clearNotifications,
          addExecutionLog,
        }}
      >
        {children}
      </NotificationsActionsContext.Provider>
    </NotificationsStateContext.Provider>
  );
}

export function useNotificationsState() {
  const context = useContext(NotificationsStateContext);
  if (!context) throw new Error('useNotificationsState must be used within NotificationsStoreProvider');
  return context;
}

export function useNotificationsActions() {
  const context = useContext(NotificationsActionsContext);
  if (!context) throw new Error('useNotificationsActions must be used within NotificationsStoreProvider');
  return context;
}
