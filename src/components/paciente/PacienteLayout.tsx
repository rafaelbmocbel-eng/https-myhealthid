import { ReactNode, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePacienteNotifications } from '@/hooks/usePacienteNotifications';
import { LayoutDashboard, CalendarDays, ClipboardList, User, LogOut, Heart, Flame, Dumbbell, Wallet, Watch, Ticket, MessageSquare } from 'lucide-react';
import LogoIcon from '@/components/LogoIcon';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/paciente/dashboard', label: 'Início', shortLabel: 'Início', icon: LayoutDashboard, badgeKey: null },
  { path: '/paciente/saude', label: 'Saúde', shortLabel: 'Saúde', icon: Watch, badgeKey: null },
  { path: '/paciente/diario', label: 'Diário', shortLabel: 'Diário', icon: Heart, badgeKey: 'diario' as const },
  { path: '/paciente/evolucao', label: 'Evolução e Prontuários', shortLabel: 'Evolução', icon: Flame, badgeKey: null },
  { path: '/paciente/exercicios', label: 'Treinos', shortLabel: 'Treinos', icon: Dumbbell, badgeKey: null },
  { path: '/paciente/agenda', label: 'Agenda', shortLabel: 'Agenda', icon: CalendarDays, badgeKey: 'agenda' as const },
  { path: '/paciente/questionarios', label: 'Questionários', shortLabel: 'Quest.', icon: ClipboardList, badgeKey: 'questionarios' as const },
  { path: '/paciente/pagamentos', label: 'Pagamentos', shortLabel: 'Pagam.', icon: Wallet, badgeKey: 'pagamentos' as const },
  { path: '/paciente/eventos', label: 'Eventos', shortLabel: 'Eventos', icon: Ticket, badgeKey: null },
  { path: '/paciente/chat', label: 'Mensagens', shortLabel: 'Chat', icon: MessageSquare, badgeKey: null },
  { path: '/paciente/perfil', label: 'Perfil', shortLabel: 'Perfil', icon: User, badgeKey: null },
];

// Show max 5 items in bottom nav: Início, Chat, Agenda, Treinos, Perfil
const MOBILE_NAV_ITEMS = [0, 9, 5, 4, 10];

interface Props {
  children: ReactNode;
}

export default function PacienteLayout({ children }: Props) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notifications = usePacienteNotifications(user?.id);

  const mobileItems = useMemo(() => MOBILE_NAV_ITEMS.map(i => navItems[i]), []);

  const getBadgeCount = (key: string | null): number => {
    if (!key) return 0;
    switch (key) {
      case 'questionarios': return notifications.pendingQuestionarios;
      case 'pagamentos': return notifications.pendingPagamentos;
      case 'agenda': return notifications.proximaConsulta ? 1 : 0;
      case 'diario': return notifications.diarioHoje ? 0 : 1; // show dot if NOT logged today
      default: return 0;
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-background">
      {/* Top header */}
      <header
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{
          background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(213 55% 12%) 100%)',
          paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        }}
      >
        <div className="flex items-center gap-2">
          <LogoIcon size={28} />
          <div>
            <span className="text-xs font-black text-primary-foreground">
              My Health <span style={{ color: 'hsl(var(--accent))' }}>ID</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Streak badge */}
          {notifications.streak > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-sm">
              <span className="text-[10px]">🔥</span>
              <span className="text-[10px] font-bold text-primary-foreground">{notifications.streak}</span>
            </div>
          )}
          <button
            onClick={async () => { await signOut(); navigate('/paciente/login'); }}
            className="text-primary-foreground/50 hover:text-primary-foreground/80 transition-colors p-2 -mr-2 active:scale-95"
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Desktop/Tablet sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — visible on md+ */}
        <nav className="hidden md:flex flex-col w-56 lg:w-60 border-r border-border bg-card p-3 gap-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            const badge = getBadgeCount(item.badgeKey);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98] relative',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate flex-1">{item.label}</span>
                {badge > 0 && (
                  <span className={cn(
                    'min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold',
                    active
                      ? 'bg-primary-foreground text-primary'
                      : 'bg-destructive text-destructive-foreground',
                  )}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation — 5 items max */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border flex items-stretch justify-around z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {mobileItems.map((item) => {
          const active = location.pathname === item.path;
          const badge = getBadgeCount(item.badgeKey);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-2 px-1 transition-all active:scale-95 relative',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <div className="relative">
                <item.icon className={cn('h-5 w-5 shrink-0', active && 'text-primary')} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <span className={cn(
                'text-[9px] font-medium truncate max-w-full',
                active && 'font-bold',
              )}>
                {item.shortLabel}
              </span>
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
