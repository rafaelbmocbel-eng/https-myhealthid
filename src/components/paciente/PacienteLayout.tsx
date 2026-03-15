import { ReactNode, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, CalendarDays, ClipboardList, User, LogOut, Heart, Flame, Dumbbell, Wallet } from 'lucide-react';
import LogoIcon from '@/components/LogoIcon';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/paciente/dashboard', label: 'Início', shortLabel: 'Início', icon: LayoutDashboard },
  { path: '/paciente/diario', label: 'Diário', shortLabel: 'Diário', icon: Heart },
  { path: '/paciente/evolucao', label: 'Evolução e Prontuários', shortLabel: 'Evolução', icon: Flame },
  { path: '/paciente/exercicios', label: 'Treinos', shortLabel: 'Treinos', icon: Dumbbell },
  { path: '/paciente/agenda', label: 'Agenda', shortLabel: 'Agenda', icon: CalendarDays },
  { path: '/paciente/questionarios', label: 'Questionários', shortLabel: 'Quest.', icon: ClipboardList },
  { path: '/paciente/pagamentos', label: 'Pagamentos', shortLabel: 'Pagam.', icon: Wallet },
  { path: '/paciente/perfil', label: 'Perfil', shortLabel: 'Perfil', icon: User },
];

// Show max 5 items in bottom nav (priorizando acesso ao MyID/Questionários)
const MOBILE_NAV_ITEMS = [0, 1, 3, 5, 7]; // Início, Diário, Treinos, Questionários, Perfil

interface Props {
  children: ReactNode;
}

export default function PacienteLayout({ children }: Props) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const mobileItems = useMemo(() => MOBILE_NAV_ITEMS.map(i => navItems[i]), []);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Top header */}
      <header
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{
          background: 'linear-gradient(135deg, hsl(213 55% 18%) 0%, hsl(213 55% 12%) 100%)',
          paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        }}
      >
        <div className="flex items-center gap-2">
          <LogoIcon size={28} />
          <div>
            <span className="text-xs font-black text-white">
              My Health <span style={{ color: 'hsl(40 95% 52%)' }}>ID</span>
            </span>
          </div>
        </div>
        <button
          onClick={async () => { await signOut(); navigate('/paciente/login'); }}
          className="text-white/50 hover:text-white/80 transition-colors p-2 -mr-2 active:scale-95"
          aria-label="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      {/* Desktop/Tablet sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — visible on md+ */}
        <nav className="hidden md:flex flex-col w-56 lg:w-60 border-r border-border bg-card p-3 gap-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98]',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-6">
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
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-2 px-1 transition-all active:scale-95',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <item.icon className={cn('h-5 w-5 shrink-0', active && 'text-primary')} />
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
