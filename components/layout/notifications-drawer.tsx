'use client';

import React from 'react';
import { Bell, ShieldAlert, Zap, CheckCheck, Trash2 } from 'lucide-react';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppState, useAppActions } from '@/lib/store';

export function NotificationsDrawer() {
  const { isNotificationsOpen, notifications } = useAppState();
  const { setNotificationsOpen, clearNotifications } = useAppActions();

  return (
    <Drawer
      isOpen={isNotificationsOpen}
      onClose={() => setNotificationsOpen(false)}
      title={
        <span className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-sky-400" /> Terminal Risk & Intelligence Alerts
        </span>
      }
      subtitle="Real-time threat monitoring stream"
      position="right"
      footer={
        notifications.length > 0 ? (
          <div className="flex items-center justify-between">
            <Button
              onClick={clearNotifications}
              variant="outline"
              size="xs"
              leftIcon={<Trash2 className="h-3 w-3" />}
            >
              Clear All Alerts
            </Button>
            <span className="text-2xs text-slate-500 font-mono">Auto-sync active</span>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs italic">
            <CheckCheck className="h-8 w-8 mx-auto text-slate-600 mb-2" />
            No unread risk warnings or execution alerts.
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className="rounded-xl border border-sentinel-700/80 bg-sentinel-850 p-4 space-y-2 hover:border-sentinel-600 transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {n.type === 'risk' && <ShieldAlert className="h-4 w-4 text-amber-400" />}
                  {n.type === 'execution' && <Zap className="h-4 w-4 text-emerald-400 fill-current" />}
                  {n.type === 'system' && <Bell className="h-4 w-4 text-sky-400" />}
                  <span className="font-semibold text-slate-100 text-xs">{n.title}</span>
                </div>
                <span className="text-2xs text-slate-500 font-mono">{n.timestamp}</span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed font-sans">{n.message}</p>

              <div className="pt-1 flex items-center justify-between">
                <Badge
                  variant={n.type === 'risk' ? 'warning' : n.type === 'execution' ? 'success' : 'info'}
                  size="sm"
                >
                  {n.type}
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </Drawer>
  );
}
