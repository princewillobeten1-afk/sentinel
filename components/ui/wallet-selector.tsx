import React, { useEffect, useState } from 'react';
import { Wallet, LogOut, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { endpoints, apiUrl } from '@/lib/api/endpoints';
import { readApiData } from '@/lib/api/response';

/** The wallet DTO returned by `/api/v1/wallets`. */
interface LinkedWallet {
  id: string;
  chainId: string;
  address: string;
  label?: string | null;
  isPrimary: boolean;
  status: string;
}

/**
 * Wallet picker, reading the caller's linked wallets from `/api/v1/wallets`.
 *
 * Previously read `/api/wallets`, which constructed a fresh in-memory
 * `WalletSystemEngine` per request and returned its demo wallets to anyone,
 * authenticated or not. That engine's `WalletRecord` carried balances, gas
 * status and permission flags; the real wallets table stores identity only, so
 * those displays are gone rather than reproduced with invented values. Balance
 * belongs to `/api/v1/user/wallets/:id/balance` and is a separate read.
 */
export function WalletSelector() {
  const [wallets, setWallets] = useState<LinkedWallet[]>([]);
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl(endpoints.wallets.list), { credentials: 'include' })
      .then(res => readApiData<{ wallets: LinkedWallet[] }>(res))
      .then(data => {
        const list: LinkedWallet[] = data?.wallets ?? [];
        setWallets(list);
        const primary = list.find(w => w.isPrimary) ?? list[0];
        if (primary) setActiveWalletId(primary.id);
      })
      .catch(console.error);
  }, []);

  const activeWallet = wallets.find(w => w.id === activeWalletId);

  if (!activeWallet) {
    return <Button variant="outline" className="gap-2"><Wallet className="w-4 h-4"/> Connect Wallet</Button>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-3 h-auto py-2 px-4 justify-start text-left min-w-[220px]">
          <div className="p-1.5 rounded-full bg-primary/10">
            <Wallet className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 flex flex-col items-start overflow-hidden">
            <span className="font-semibold text-sm truncate w-full">
              {activeWallet.label || `${activeWallet.chainId} wallet`}
            </span>
            <span className="text-2xs text-muted-foreground font-mono truncate w-full">{activeWallet.address}</span>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b bg-muted/20">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-muted-foreground">Active Wallet</span>
            <Badge
              variant="outline"
              className={
                activeWallet.status === 'ACTIVE'
                  ? 'text-emerald-500 border-emerald-500/50'
                  : 'text-amber-500 border-amber-500/50'
              }
            >
              {activeWallet.status}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground font-mono mt-2 break-all">
            {activeWallet.address}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span className="text-muted-foreground uppercase">{activeWallet.chainId}</span>
            {activeWallet.isPrimary && <span className="text-primary ml-auto">Primary</span>}
          </div>
        </div>

        <div className="p-2">
          {wallets.map(w => (
            <Button 
              key={w.id} 
              variant="ghost" 
              className="w-full justify-start py-6 gap-3 mb-1 relative"
              onClick={() => setActiveWalletId(w.id)}
            >
              <div className={`p-2 rounded-full ${w.id === activeWalletId ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                <Wallet className="w-4 h-4" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-semibold flex items-center gap-2">
                  {w.label || `${w.chainId} wallet`}
                  {w.isPrimary && <span className="text-2xs px-1 border border-primary/50 text-primary rounded uppercase">Primary</span>}
                </div>
                <div className="text-xs text-muted-foreground font-mono">{w.address}</div>
              </div>
              {w.id === activeWalletId && <Check className="w-4 h-4 text-primary" />}
            </Button>
          ))}
        </div>

        <div className="p-2 border-t grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="w-full text-xs">Add Wallet</Button>
          <Button variant="outline" size="sm" className="w-full text-xs text-red-500 hover:text-red-600 gap-1"><LogOut className="w-3 h-3"/> Disconnect</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
