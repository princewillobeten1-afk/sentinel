import React from 'react';
import Link from 'next/link';

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen bg-background text-foreground md:hidden">
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-16">
        {children}
      </main>

      {/* Persistent Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t flex justify-around items-center z-50 px-2 shadow-[0_-4px_12px_rgba(0,0,0,0.1)]">
        <Link href="/m" className="flex flex-col items-center justify-center w-full h-full text-muted-foreground hover:text-primary transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span className="text-2xs mt-1 font-medium">Home</span>
        </Link>
        <Link href="/m/discover" className="flex flex-col items-center justify-center w-full h-full text-muted-foreground hover:text-primary transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <span className="text-2xs mt-1 font-medium">Discover</span>
        </Link>
        <Link href="/m/trade" className="flex flex-col items-center justify-center w-full h-full text-muted-foreground hover:text-primary transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          <span className="text-2xs mt-1 font-medium">Trade</span>
        </Link>
        <Link href="/m/portfolio" className="flex flex-col items-center justify-center w-full h-full text-muted-foreground hover:text-primary transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
          <span className="text-2xs mt-1 font-medium">Portfolio</span>
        </Link>
        <Link href="/m/alerts" className="flex flex-col items-center justify-center w-full h-full text-muted-foreground hover:text-primary transition-colors relative">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          <span className="absolute top-2 right-4 w-2 h-2 bg-red-500 rounded-full"></span>
          <span className="text-2xs mt-1 font-medium">Alerts</span>
        </Link>
      </nav>
    </div>
  );
}
