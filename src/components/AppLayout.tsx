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

  // On mobile sidebar is always collapsed (icon-only 72px), on desktop user toggles
  const sidebarCollapsed = isMobile ? true : collapsed;
  const sidebarW = sidebarCollapsed ? 72 : 224;

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed sidebar — always visible */}
      <AppSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => !isMobile && setCollapsed(c => !c)}
        onNavClick={undefined}
      />

      {/* Main content offset by sidebar width */}
      <div
        className="flex flex-col min-h-screen transition-all duration-300"
        style={{ marginLeft: sidebarW }}
      >
        {/* Desktop collapse toggle */}
        {!isMobile && (
          <header className="sticky top-0 z-20 flex h-14 items-center bg-background/80 backdrop-blur-sm px-6 gap-4 border-b border-border">
            <button
              onClick={() => setCollapsed(c => !c)}
              className="h-9 w-9 rounded-xl bg-card flex items-center justify-center text-muted-foreground hover:text-foreground border border-border transition-all hover:shadow-sm"
            >
              {collapsed
                ? <ChevronRight className="h-4 w-4" />
                : <ChevronLeft className="h-4 w-4" />
              }
            </button>
          </header>
        )}

        <main className={cn('flex-1 px-3 pb-8 pt-2', !isMobile && 'px-6 pt-0')}>
          {children}
        </main>
      </div>
    </div>
  );
}
