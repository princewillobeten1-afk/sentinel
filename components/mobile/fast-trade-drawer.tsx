import React from 'react';

export function MobileFastTradeDrawer({ isOpen, type }: { isOpen: boolean, type: 'BUY' | 'SELL' }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-background/80 backdrop-blur-sm">
      <div className="bg-card rounded-t-2xl p-5 border-t shadow-[0_-10px_40px_rgba(0,0,0,0.3)] animate-in slide-in-from-bottom-full duration-200">
        
        <div className="w-12 h-1.5 bg-muted mx-auto rounded-full mb-6"></div>
        
        <h2 className="text-xl font-bold mb-1">{type} TOKEN X</h2>
        <div className="text-sm font-medium text-muted-foreground mb-6">Available: $1,240.00</div>

        {/* Quick Amount Selectors */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {type === 'BUY' 
            ? ['$10', '$25', '$50', '$100'].map(amt => (
                <button key={amt} className="bg-secondary font-bold py-2 rounded active:bg-primary active:text-primary-foreground transition-colors">{amt}</button>
              ))
            : ['25%', '50%', '75%', 'MAX'].map(amt => (
                <button key={amt} className="bg-secondary font-bold py-2 rounded active:bg-primary active:text-primary-foreground transition-colors">{amt}</button>
              ))
          }
        </div>

        <div className="mb-6 relative">
          <input 
            type="number" 
            placeholder="Custom Amount" 
            className="w-full bg-background border p-4 rounded-lg font-mono text-lg outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Execution Preview */}
        <div className="bg-muted/30 border rounded-lg p-3 space-y-2 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground font-medium">Expected Output</span>
            <span className="font-bold">1,245 TOKEN</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground font-medium">Price Impact</span>
            <span className="font-bold text-yellow-500">0.4%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground font-medium">Network Fee</span>
            <span className="font-bold">$0.42</span>
          </div>
        </div>

        <button className={`w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg active:scale-95 transition-transform ${type === 'BUY' ? 'bg-green-500 shadow-green-500/20' : 'bg-red-500 shadow-red-500/20'}`}>
          REVIEW {type}
        </button>
      </div>
    </div>
  );
}
