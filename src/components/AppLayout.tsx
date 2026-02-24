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
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-[50vw] h-[50vh] bg-primary/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[30vw] h-[30vh] bg-accent/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      {/* Fixed sidebar — always visible */}
      <AppSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => !isMobile && setCollapsed(c => !c)}
        onNavClick={undefined}
      />

      {/* Main content offset by sidebar width */}
      <div
        className="flex flex-col min-h-screen transition-all duration-500 ease-in-out relative z-10"
        style={{ marginLeft: sidebarW }}
      >
        {/* Desktop collapse toggle */}
        {!isMobile && (
          <header className="sticky top-0 z-20 flex h-16 items-center bg-background/60 backdrop-blur-md px-8 gap-4 border-b border-border/50">
            <button
              onClick={() => setCollapsed(c => !c)}
              className="h-10 w-10 rounded-xl bg-card/80 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/5 border border-border/50 transition-all hover:shadow-md active:scale-95"
            >
              {collapsed
                ? <ChevronRight className="h-5 w-5" />
                : <ChevronLeft className="h-5 w-5" />
              }
            </button>
            <div className="ml-auto flex items-center gap-4">
              {/* Add any global header actions here if needed */}
            </div>
          </header>
        )}

        <main className={cn('flex-1 px-4 pb-12 pt-4 transition-all duration-500', !isMobile && 'px-8 pt-6')}>
          {children}
        </main>
      </div>
    </div>
  );
}
