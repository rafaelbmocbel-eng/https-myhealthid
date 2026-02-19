import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, AlignCenter, CalendarDays, Users, FileText,
  Settings, ChevronLeft, ChevronRight, LogOut, User, ClipboardList, Dumbbell,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoMetodo from '@/assets/logo-metodo-identidade.jpg';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Pacientes', href: '/pacientes', icon: Users },
  { label: 'Método Identidade', href: '/metodo-identidade', icon: ClipboardList },
  { label: 'COB° ZERO', href: '/cob-zero', icon: AlignCenter },
  { label: 'Protocolos', href: '/protocolos', icon: Dumbbell },
  { label: 'Agenda', href: '/agenda', icon: CalendarDays },
  { label: 'Relatórios', href: '/relatorios', icon: FileText },
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
        'fixed left-0 top-0 h-screen z-40 flex flex-col border-r bg-card transition-all duration-300 shadow-lg',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Header / Logo */}
      <div className={cn(
        'flex items-center border-b h-16 px-3 gap-3 shrink-0',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        {!collapsed && (
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <img src={logoMetodo} alt="Logo" className="h-9 w-9 rounded-lg object-cover shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold leading-none text-foreground truncate">
                MÉTODO <span className="text-gradient-primary">IDENTIDADE</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 truncate">+ COB° ZERO v9.0</div>
            </div>
          </Link>
        )}
        {collapsed && (
          <Link to="/">
            <img src={logoMetodo} alt="Logo" className="h-9 w-9 rounded-lg object-cover" />
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className={cn('shrink-0 h-7 w-7', collapsed && 'hidden')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <button
          onClick={onToggle}
          className="mx-auto mt-2 flex h-7 w-7 items-center justify-center rounded-md border bg-background hover:bg-accent transition-colors"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium transition-all group relative',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40',
                collapsed && 'justify-center px-2'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {active && !collapsed && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-foreground/60 rounded-r-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer – user + signout */}
      <div className="border-t p-2 space-y-1 shrink-0">
        {user && (
          <>
            <div
              className={cn(
                'flex items-center gap-2 px-2.5 py-2 rounded-lg',
                collapsed && 'justify-center'
              )}
            >
              <div className="h-7 w-7 rounded-full bg-gradient-primary flex items-center justify-center shrink-0">
                <User className="h-3.5 w-3.5 text-white" />
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate">{profile?.nome || 'Terapeuta'}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>
                </div>
              )}
            </div>
            <button
              onClick={handleSignOut}
              title={collapsed ? 'Sair' : undefined}
              className={cn(
                'flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all',
                collapsed && 'justify-center'
              )}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Sair</span>}
            </button>
          </>
        )}
        {!user && !collapsed && (
          <Link
            to="/auth"
            className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-all"
          >
            <User className="h-4 w-4" />
            <span>Entrar</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
