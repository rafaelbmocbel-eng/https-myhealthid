import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, CalendarDays, ClipboardList, User, LogOut } from 'lucide-react';
import LogoIcon from '@/components/LogoIcon';

const navItems = [
  { path: '/paciente/dashboard', label: 'Início', icon: LayoutDashboard },
  { path: '/paciente/agenda', label: 'Agenda', icon: CalendarDays },
  { path: '/paciente/questionarios', label: 'Questionários', icon: ClipboardList },
  { path: '/paciente/perfil', label: 'Perfil', icon: User },
];

interface Props {
  children: ReactNode;
}

export default function PacienteLayout({ children }: Props) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top header - always visible */}
      <header
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ background: 'linear-gradient(135deg, hsl(213 55% 18%) 0%, hsl(213 55% 12%) 100%)' }}
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
          className="text-white/50 hover:text-white/80 transition-colors"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      {/* Desktop sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <nav className="hidden md:flex flex-col w-56 border-r border-border bg-card p-4 gap-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex items-center justify-around py-2 px-2 z-50">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
                active
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              <item.icon className={`h-5 w-5 ${active ? 'text-primary' : ''}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
