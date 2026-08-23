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

/**
 * In-app notifications and the execution log.
 *
 * Deliberately in-memory: these are session events, not records. What was wrong
 * was the seed — the store opened with fabricated notifications and execution
 * log lines, so a brand-new session showed alerts that had never fired and
 * trades that had never run. It now starts empty and fills from real activity.
 *
 * Notification *preferences* (which channels, quiet hours) are a different
 * thing and persist server-side via `/api/v1/notification-preferences`.
 */
export function NotificationsStoreProvider({ children }: { children: React.ReactNode }) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([]);

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
