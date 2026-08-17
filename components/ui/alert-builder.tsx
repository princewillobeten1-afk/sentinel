import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';

export function AlertBuilder() {
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);

  const templates = [
    { id: 'momentum', name: '🚀 Momentum', desc: 'Price acceleration + volume' },
    { id: 'whale', name: '🐋 Whale', desc: 'Large wallet transfers' },
    { id: 'smart', name: '🧠 Smart Money', desc: 'High-confidence accumulation' },
    { id: 'rug', name: '🚨 Rug Risk', desc: 'Liquidity removal & exitability' },
  ];

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Create Smart Alert</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-sm font-medium mb-3">Templates</h3>
          <div className="grid grid-cols-2 gap-3">
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTemplate(t.id)}
                className={`p-3 text-left border rounded-lg transition-colors ${
                  activeTemplate === t.id ? 'border-primary bg-primary/10' : 'hover:border-primary/50'
                }`}
              >
                <div className="font-semibold">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 border-t pt-4">
          <h3 className="text-sm font-medium">Conditions</h3>
          <div className="bg-muted p-4 rounded-md space-y-3">
            <div className="flex items-center gap-2">
              <select className="bg-background border rounded px-2 py-1 text-sm">
                <option>Price</option>
                <option>Volume</option>
                <option>Exitability</option>
              </select>
              <select className="bg-background border rounded px-2 py-1 text-sm">
                <option>{'>'}</option>
                <option>{'<'}</option>
              </select>
              <input type="text" placeholder="Value" className="bg-background border rounded px-2 py-1 text-sm w-24" />
            </div>
            
            <div className="flex items-center gap-2 text-primary font-bold text-sm px-2">AND</div>
            
            <div className="flex items-center gap-2">
              <select className="bg-background border rounded px-2 py-1 text-sm">
                <option>Exitability</option>
                <option>Volume</option>
              </select>
              <select className="bg-background border rounded px-2 py-1 text-sm">
                <option>{'>'}</option>
                <option>{'<'}</option>
              </select>
              <input type="text" placeholder="70" className="bg-background border rounded px-2 py-1 text-sm w-24" />
            </div>
          </div>
          <button className="text-sm text-primary font-medium hover:underline">
            + Add Condition
          </button>
        </div>

        <div className="space-y-4 border-t pt-4">
          <h3 className="text-sm font-medium">Notification Channels</h3>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" defaultChecked /> Push
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" defaultChecked /> In-App
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" /> Telegram
            </label>
          </div>
        </div>
      </CardContent>
      <CardFooter className="justify-end space-x-2">
        <button className="px-4 py-2 border rounded-md text-sm font-medium">Cancel</button>
        <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium">
          Create Alert
        </button>
      </CardFooter>
    </Card>
  );
}
