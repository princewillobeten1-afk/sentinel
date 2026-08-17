'use client';

import React, { useState } from 'react';
import {
  Sliders,
  Flag,
  Settings,
  History,
  RotateCcw,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AdminRole, FeatureFlag, ConfigSetting } from '@/lib/admin/types';

interface AdminFlagsConfigTabProps {
  currentRole: AdminRole;
  flags: FeatureFlag[];
  settings: ConfigSetting[];
  onToggleFlag: (key: string, enabled: boolean) => void;
  onUpdateRollout: (key: string, pct: number) => void;
  onUpdateSetting: (key: string, value: any, reason: string) => void;
}

export function AdminFlagsConfigTab({
  currentRole,
  flags,
  settings,
  onToggleFlag,
  onUpdateRollout,
  onUpdateSetting,
}: AdminFlagsConfigTabProps) {
  const [activeSection, setActiveSection] = useState<'flags' | 'config'>('flags');

  return (
    <div className="space-y-6">
      {/* Section Switcher */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
        <button
          onClick={() => setActiveSection('flags')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
            activeSection === 'flags'
              ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
              : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
          }`}
        >
          <Flag className="h-3.5 w-3.5" />
          <span>Dynamic Feature Flags ({flags.length})</span>
        </button>

        <button
          onClick={() => setActiveSection('config')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
            activeSection === 'config'
              ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
              : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
          }`}
        >
          <Settings className="h-3.5 w-3.5" />
          <span>Platform & Risk Configuration ({settings.length})</span>
        </button>
      </div>

      {/* Feature Flags Section */}
      {activeSection === 'flags' && (
        <Panel className="p-0 bg-sentinel-900/40 border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02] text-slate-400 font-mono text-2xs uppercase">
                  <th className="p-3.5">Feature Flag</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Rollout Percentage</th>
                  <th className="p-3.5">Target Roles / Users</th>
                  <th className="p-3.5 text-right">Quick Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {flags.map((flag) => (
                  <tr key={flag.key} className="hover:bg-white/[0.02] transition">
                    <td className="p-3.5">
                      <div>
                        <p className="font-bold text-white">{flag.name}</p>
                        <p className="text-2xs text-slate-500 font-mono">{flag.key} • {flag.description}</p>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <Badge variant={flag.enabled ? 'success' : 'neutral'} size="sm">
                        {flag.enabled ? 'ENABLED' : 'DISABLED'}
                      </Badge>
                    </td>
                    <td className="p-3.5 font-mono">
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={flag.rolloutPct}
                          onChange={(e) => onUpdateRollout(flag.key, parseInt(e.target.value))}
                          disabled={!flag.enabled}
                          className="w-20 accent-sky-400"
                        />
                        <span className="text-slate-200">{flag.rolloutPct}%</span>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-400">
                      {flag.targetRoles.length > 0
                        ? flag.targetRoles.join(', ')
                        : flag.targetUsers.length > 0
                        ? `${flag.targetUsers.length} specific users`
                        : 'All Users'}
                    </td>
                    <td className="p-3.5 text-right">
                      <Button
                        variant={flag.enabled ? 'outline' : 'primary'}
                        size="sm"
                        onClick={() => onToggleFlag(flag.key, !flag.enabled)}
                        className={`text-2xs h-7 ${!flag.enabled ? 'bg-sky-600 hover:bg-sky-500' : ''}`}
                      >
                        {flag.enabled ? 'Disable' : 'Enable'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* System Configuration Section */}
      {activeSection === 'config' && (
        <div className="space-y-3">
          {settings.map((setting) => (
            <div
              key={setting.key}
              className="p-4 rounded-xl bg-sentinel-900/50 border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="neutral" size="sm" className="font-mono text-2xs">
                    {setting.group}
                  </Badge>
                  <span className="text-xs font-bold text-white font-mono">{setting.key}</span>
                  <span className="text-2xs text-slate-500 font-mono">v{setting.version}</span>
                </div>
                <p className="text-xs text-slate-400">{setting.reason}</p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <span className="text-xs font-bold font-mono text-sky-400 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
                  {typeof setting.value === 'object' ? JSON.stringify(setting.value) : String(setting.value)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const val = prompt(`Edit value for ${setting.key}:`, String(setting.value));
                    if (val !== null) {
                      const parsed = isNaN(Number(val)) ? val : Number(val);
                      onUpdateSetting(setting.key, parsed, 'Manual admin config adjustment');
                    }
                  }}
                  className="text-2xs h-7"
                >
                  Edit
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
