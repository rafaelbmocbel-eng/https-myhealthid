import { useState, useLayoutEffect, useCallback } from 'react';
import AppSidebar from './AppSidebar';
import MobileBottomNav from './MobileBottomNav';
import GlobalSearch from './GlobalSearch';
import QuickActions from './QuickActions';
import ThemeToggle from './ThemeToggle';
import NotificationCenter from './NotificationCenter';
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useLayoutEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      const tablet = window.innerWidth >= 768 && window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setCollapsed(true);
        setMobileOpen(false);
      } else if (tablet) {
        setCollapsed(true);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleNavClick = useCallback(() => {
    if (isMobile) setMobileOpen(false);
  }, [isMobile]);

  const sidebarCollapsed = isMobile ? true : collapsed;
  const sidebarW = isMobile ? 0 : sidebarCollapsed ? 72 : 224;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background relative overflow-x-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-[50vw] h-[50vh] bg-primary/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[30vw] h-[30vh] bg-accent/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      {/* Desktop sidebar — always visible */}
      {!isMobile && (
        <AppSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setCollapsed(c => !c)}
          onNavClick={undefined}
        />
      )}

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {isMobile && mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed left-0 top-0 h-screen z-50"
            >
              <AppSidebar
                collapsed={false}
                onToggle={() => setMobileOpen(false)}
                onNavClick={handleNavClick}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content offset by sidebar width */}
      <div
        className="flex flex-col min-h-[100dvh] transition-all duration-500 ease-in-out relative z-10"
        style={{ marginLeft: sidebarW }}
      >
        {/* Header */}
        <header
          className="sticky top-0 z-20 flex h-14 md:h-16 items-center bg-background/60 backdrop-blur-md px-4 md:px-8 gap-4 border-b border-border/50"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          {isMobile ? (
            <button
              onClick={() => setMobileOpen(true)}
              className="h-10 w-10 rounded-xl bg-card/80 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/5 border border-border/50 transition-all hover:shadow-md active:scale-95"
            >
              <Menu className="h-5 w-5" />
            </button>
          ) : (
            <button
              onClick={() => setCollapsed(c => !c)}
              className="h-10 w-10 rounded-xl bg-card/80 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/5 border border-border/50 transition-all hover:shadow-md active:scale-95"
            >
              {collapsed
                ? <ChevronRight className="h-5 w-5" />
                : <ChevronLeft className="h-5 w-5" />
              }
            </button>
          )}
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-1 md:gap-2">
            <NotificationCenter />
            <QuickActions />
            <ThemeToggle />
          </div>
        </header>

        <main className={cn(
          'flex-1 px-2 pt-3 transition-all duration-500 overflow-x-hidden',
          'sm:px-4',
          isMobile ? 'pb-24' : 'pb-12 px-6 lg:px-8 pt-6',
        )}>
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      {isMobile && !mobileOpen && <MobileBottomNav />}
    </div>
  );
}
