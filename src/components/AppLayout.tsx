import { useState, useLayoutEffect } from 'react';
import AppSidebar from './AppSidebar';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // useLayoutEffect runs synchronously before paint — avoids flash
  useLayoutEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setCollapsed(true);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const sidebarW = (collapsed || isMobile) ? 72 : 224;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar — always visible, collapsed (icon-only) on mobile */}
      <div className={cn('relative shrink-0', isMobile ? 'w-[72px]' : '')}>
        <AppSidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(c => !c)}
          onNavClick={undefined}
        />
      </div>

      {/* Main content */}
      <div
        className="flex-1 flex flex-col min-w-0 transition-all duration-300"
        style={{ marginLeft: isMobile ? 0 : sidebarW - (isMobile ? 72 : sidebarW) }}
      >
        {/* Top bar — desktop only collapse toggle */}
        {!isMobile && (
          <header className="sticky top-0 z-20 flex h-16 items-center bg-background px-6 gap-4">
            <button
              onClick={() => setCollapsed(c => !c)}
              className="h-9 w-9 rounded-xl bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
              style={{ boxShadow: '3px 3px 8px hsl(240 10% 75% / 0.5), -2px -2px 6px hsl(0 0% 100% / 0.9)' }}
            >
              {collapsed
                ? <ChevronRight className="h-4 w-4" />
                : <ChevronLeft className="h-4 w-4" />
              }
            </button>
          </header>
        )}

        <main className={cn('flex-1 px-4 pb-8', !isMobile && 'px-6')}>
          {children}
        </main>
      </div>
    </div>
  );
}

