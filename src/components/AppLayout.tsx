import { useState, useEffect } from 'react';
import AppSidebar from './AppSidebar';
import { Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setCollapsed(true);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const sidebarW = (collapsed || isMobile) ? 72 : 256;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        isMobile ? 'fixed z-40 h-screen' : 'relative',
        isMobile && !mobileOpen ? '-translate-x-full' : 'translate-x-0',
        'transition-transform duration-300',
      )}>
        <AppSidebar
          collapsed={isMobile ? true : collapsed}
          onToggle={() => isMobile ? setMobileOpen(false) : setCollapsed(c => !c)}
        />
      </div>

      {/* Main content */}
      <div
        className="flex-1 flex flex-col min-w-0 transition-all duration-300"
        style={{ marginLeft: isMobile ? 0 : sidebarW }}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center bg-background px-6 gap-4">
          {/* Collapse toggle (desktop) */}
          {!isMobile && (
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
          )}
          {/* Mobile hamburger */}
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
          )}
          {isMobile && (
            <span className="text-sm font-black text-foreground tracking-wide">
              MÉTODO <span style={{ color: 'hsl(262 83% 58%)' }}>IDENTIDADE</span>
            </span>
          )}
        </header>

        <main className="flex-1 px-6 pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
