import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Users, Settings, Zap, Wallet, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAgendamentoNotifications } from '@/hooks/useAgendamentoNotifications';
import { useServicosAtivos } from '@/hooks/useServicosAtivos';
import { useHaptics } from '@/hooks/useHaptics';

type ServiceKey = 'identidade' | 'cob_zero' | 'eventos';

const NAV_ITEMS: { label: string; href: string; icon: LucideIcon; hasBadge?: boolean; serviceKey?: ServiceKey }[] = [
  { label: 'Agenda', href: '/agenda', icon: CalendarDays, hasBadge: true },
  { label: 'Pacientes', href: '/pacientes', icon: Users },
  { label: 'Início', href: '/', icon: LayoutDashboard },
  { label: 'Zap', href: '/crm/inbox', icon: Zap },
  { label: 'Financeiro', href: '/financeiro', icon: Wallet },
  { label: 'Config', href: '/configuracoes', icon: Settings },
];

export default function MobileBottomNav() {
  const location = useLocation();
  const { pendingCount } = useAgendamentoNotifications();
  const { servicos } = useServicosAtivos();
  const { vibrate } = useHaptics();

  const visibleItems = NAV_ITEMS.filter(item => !item.serviceKey || servicos[item.serviceKey]);

  const isActive = (href: string) =>
    href === '/' ? location.pathname === '/' : location.pathname.startsWith(href);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background/95 backdrop-blur-xl border-t border-border shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.08)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex items-stretch justify-around px-1 pt-1.5 pb-1.5">
        {visibleItems.map(item => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const showBadge = item.hasBadge && pendingCount > 0;

          return (
            <li key={item.href} className="flex-1">
              <Link
                to={item.href}
                onClick={() => { if (!active) vibrate('tick'); }}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl tap-pop',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {active && (
                  <span
                    className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-1 w-8 rounded-full"
                    style={{ background: 'var(--gradient-gold)' }}
                  />
                )}
                <div className={cn(
                  'relative flex items-center justify-center transition-all',
                  active && 'bg-primary/10 rounded-full px-3 py-0.5'
                )}>
                  <Icon
                    className={cn('h-5 w-5 transition-transform', active && 'scale-110')}
                    fill={active ? 'currentColor' : 'none'}
                    fillOpacity={active ? 0.15 : 0}
                  />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-2 flex items-center justify-center h-4 min-w-4 px-1 text-[9px] font-bold rounded-full bg-destructive text-destructive-foreground animate-pulse">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </div>
                <span className={cn('text-[10px] leading-none font-medium', active && 'font-semibold')}>
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
