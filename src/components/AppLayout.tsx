import { useState, useEffect } from 'react';
import AppSidebar from './AppSidebar';
import { Menu } from 'lucide-react';
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

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        isMobile && !mobileOpen && '-translate-x-full',
        isMobile && 'transition-transform duration-300'
      )}>
        <AppSidebar
          collapsed={isMobile ? false : collapsed}
          onToggle={() => isMobile ? setMobileOpen(false) : setCollapsed(c => !c)}
        />
      </div>

      {/* Main content */}
      <div
        className={cn(
          'flex-1 flex flex-col min-w-0 transition-all duration-300',
          !isMobile && (collapsed ? 'ml-16' : 'ml-60')
        )}
      >
        {/* Mobile top bar */}
        {isMobile && (
          <header className="sticky top-0 z-20 flex h-14 items-center border-b bg-card/95 backdrop-blur px-4 gap-3 shadow-sm">
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <span className="text-sm font-bold text-foreground">
              MÉTODO <span className="text-gradient-primary">IDENTIDADE</span>
            </span>
          </header>
        )}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
