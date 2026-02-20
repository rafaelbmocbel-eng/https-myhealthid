import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, AlignCenter, CalendarDays, Users, FileText,
  Settings, LogOut, User, ClipboardList,
} from 'lucide-react';
import LogoIcon from '@/components/LogoIcon';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAgendamentoNotifications } from '@/hooks/useAgendamentoNotifications';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Pacientes', href: '/pacientes', icon: Users },
  { label: 'Método Identidade', href: '/metodo-identidade', icon: ClipboardList },
  { label: 'COB° ZERO', href: '/cob-zero', icon: AlignCenter },
  { label: 'Agenda', href: '/agenda', icon: CalendarDays, hasBadge: true },
  { label: 'Relatórios e Links', href: '/relatorios', icon: FileText },
  { label: 'Configurações', href: '/configuracoes', icon: Settings },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNavClick?: () => void;
}

export default function AppSidebar({ collapsed, onToggle, onNavClick }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { pendingCount, clearCount } = useAgendamentoNotifications();

  const isActive = (href: string) =>
    href === '/' ? location.pathname === '/' : location.pathname.startsWith(href);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen z-40 flex flex-col transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-56',
      )}
      style={{
        background: 'linear-gradient(180deg, hsl(213 55% 18%) 0%, hsl(213 55% 12%) 100%)',
        boxShadow: '4px 0 30px hsl(213 55% 10% / 0.4)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center justify-center h-20 shrink-0 px-3">
        <Link to="/" className="flex items-center gap-3 min-w-0">
          <LogoIcon size={38} />
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-xs font-black leading-none text-white tracking-wide">
                My Health
              </div>
              <div className="text-xs font-black leading-none tracking-wide" style={{ color: 'hsl(40 95% 52%)' }}>
                ID
              </div>
            </div>
          )}
        </Link>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const showBadge = item.hasBadge && pendingCount > 0;

          const handleClick = () => {
            onNavClick?.();
            if (item.hasBadge && active) clearCount();
          };

          const linkEl = (
            <Link
              key={item.href}
              to={item.href}
              onClick={handleClick}
              className={cn(
                'relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 group',
                collapsed ? 'justify-center h-12 w-12 mx-auto' : 'px-4 py-3 w-full',
                active
                  ? 'text-primary-foreground'
                  : 'text-white/60 hover:text-white hover:bg-white/10',
              )}
              style={active ? {
                background: 'linear-gradient(135deg, hsl(40 95% 52%), hsl(35 90% 45%))',
                color: 'hsl(213 55% 14%)',
                fontWeight: 700,
                boxShadow: '0 4px 16px hsl(40 95% 52% / 0.4)',
              } : {}}
            >
              <Icon className={cn('shrink-0', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {showBadge && (
                <span
                  className={cn(
                    'flex items-center justify-center text-[10px] font-bold rounded-full shrink-0 animate-pulse',
                    collapsed
                      ? 'absolute -top-0.5 -right-0.5 h-4 w-4 text-white'
                      : 'ml-auto h-5 min-w-5 px-1 text-white',
                  )}
                  style={{ background: 'hsl(0 85% 55%)' }}
                >
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.label}
                  {showBadge && ` (${pendingCount} pendente${pendingCount > 1 ? 's' : ''})`}
                </TooltipContent>
              </Tooltip>
            );
          }
          return linkEl;
        })}
      </nav>

      {/* Footer */}
      <div className="shrink-0 px-3 pb-5 space-y-1">
        {user && (
          <>
            {!collapsed && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 mb-1">
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, hsl(40 95% 52%), hsl(35 90% 45%))' }}
                >
                  <User className="h-4 w-4" style={{ color: 'hsl(213 55% 14%)' }} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate text-white">{profile?.nome || 'Terapeuta'}</div>
                  <div className="text-[10px] text-white/50 truncate">{user.email}</div>
                </div>
              </div>
            )}
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSignOut}
                  className={cn(
                    'flex items-center gap-2 w-full rounded-xl text-sm font-medium text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200',
                    collapsed ? 'justify-center h-12 w-12 mx-auto' : 'px-4 py-3',
                  )}
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>Sair</span>}
                </button>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">Sair</TooltipContent>}
            </Tooltip>
          </>
        )}
        {!user && !collapsed && (
          <Link
            to="/auth"
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all"
          >
            <User className="h-4 w-4" />
            <span>Entrar</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
