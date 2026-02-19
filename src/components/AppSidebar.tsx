import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, AlignCenter, CalendarDays, Users, FileText,
  Settings, LogOut, User, ClipboardList, Dumbbell,
} from 'lucide-react';
import logoMetodo from '@/assets/logo-metodo-identidade.jpg';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Pacientes', href: '/pacientes', icon: Users },
  { label: 'Método Identidade', href: '/metodo-identidade', icon: ClipboardList },
  { label: 'COB° ZERO', href: '/cob-zero', icon: AlignCenter },
  { label: 'Protocolos', href: '/protocolos', icon: Dumbbell },
  { label: 'Agenda', href: '/agenda', icon: CalendarDays },
  { label: 'Relatórios e Links', href: '/relatorios', icon: FileText },
  { label: 'Configurações', href: '/configuracoes', icon: Settings },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

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
        'bg-card border-r border-border',
        collapsed ? 'w-[72px]' : 'w-64',
      )}
      style={{ boxShadow: '4px 0 24px hsl(240 10% 75% / 0.35)' }}
    >
      {/* Logo */}
      <div className="flex items-center justify-center h-20 shrink-0 px-3">
        <Link to="/" className="flex items-center gap-3 min-w-0">
          <img
            src={logoMetodo}
            alt="Logo"
            className="h-10 w-10 rounded-2xl object-cover shrink-0 shadow-sm"
          />
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-xs font-black leading-none text-foreground truncate tracking-wide">
                MÉTODO
              </div>
              <div className="text-xs font-black leading-none truncate" style={{ color: 'hsl(262 83% 58%)' }}>
                IDENTIDADE
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 truncate">COB° ZERO v9.0</div>
            </div>
          )}
        </Link>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const active = isActive(item.href);

          const linkEl = (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-2xl text-sm font-semibold transition-all duration-200 group',
                collapsed ? 'justify-center h-12 w-12 mx-auto' : 'px-4 py-3 w-full',
                active
                  ? 'text-primary-foreground shadow-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
              )}
              style={active ? {
                background: 'linear-gradient(135deg, hsl(262 83% 58%), hsl(280 70% 65%))',
                boxShadow: '0 6px 20px hsl(262 83% 58% / 0.4)',
              } : {}}
            >
              <Icon className={cn('shrink-0', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                <TooltipContent side="right" className="font-medium">{item.label}</TooltipContent>
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
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-secondary mb-1">
                <div
                  className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, hsl(262 83% 58%), hsl(280 70% 65%))' }}
                >
                  <User className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate text-foreground">{profile?.nome || 'Terapeuta'}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>
                </div>
              </div>
            )}
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSignOut}
                  className={cn(
                    'flex items-center gap-2 w-full rounded-2xl text-sm font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200',
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
            className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            <User className="h-4 w-4" />
            <span>Entrar</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
