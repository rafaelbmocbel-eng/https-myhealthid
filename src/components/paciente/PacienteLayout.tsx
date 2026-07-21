import { Fragment, ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePacienteNotifications } from '@/hooks/usePacienteNotifications';
import {
  LayoutDashboard, CalendarDays, ClipboardList, User, LogOut, Heart, TrendingUp,
  Wallet, Watch, Ticket, MessageSquare, MoreHorizontal, X,
  ChevronRight, Lock, Users, Activity, Sparkles, Lightbulb, ArrowLeft, LayoutGrid,
} from 'lucide-react';
import LogoIcon from '@/components/LogoIcon';
import PortalOfflineBanner from './PortalOfflineBanner';
import { useWellnessAccess } from '@/hooks/useWellnessAccess';
import { cn } from '@/lib/utils';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { getPatientBreadcrumbs } from '@/lib/breadcrumbs';

const navItems = [
  { path: '/paciente/dashboard', label: 'Início',                shortLabel: 'Início',   icon: LayoutDashboard, badgeKey: null, premium: false },
  { path: '/paciente/saude',     label: 'Saúde',                 shortLabel: 'Saúde',    icon: Watch,           badgeKey: null, premium: false },
  { path: '/paciente/diario',    label: 'Diário',                shortLabel: 'Diário',   icon: Heart,           badgeKey: 'diario' as const, premium: false },
  { path: '/paciente/evolucao',  label: 'Evolução e Prontuários',shortLabel: 'Evolução', icon: TrendingUp,      badgeKey: null, premium: false },
  { path: '/paciente/exercicios',label: 'Acesso rápido',         shortLabel: 'Acesso',   icon: LayoutGrid,      badgeKey: null, premium: false },
  { path: '/paciente/agenda',    label: 'Agenda',                shortLabel: 'Agenda',   icon: CalendarDays,    badgeKey: 'agenda' as const, premium: false },
  { path: '/paciente/questionarios',label:'Questionários',       shortLabel: 'Quest.',   icon: ClipboardList,   badgeKey: 'questionarios' as const, premium: false },
  { path: '/paciente/pagamentos',label: 'Pagamentos',            shortLabel: 'Pagam.',   icon: Wallet,          badgeKey: 'pagamentos' as const, premium: false },
  { path: '/paciente/eventos',   label: 'Eventos',               shortLabel: 'Eventos',  icon: Ticket,          badgeKey: null, premium: false },
  { path: '/paciente/perfil',    label: 'Perfil',                shortLabel: 'Perfil',   icon: User,            badgeKey: null, premium: false },
  { path: '/paciente/profissionais', label: 'Encontrar profissional', shortLabel: 'Profiss.', icon: Users,          badgeKey: null, premium: false },
  { path: '/paciente/avatar',        label: 'Avatar clínico',       shortLabel: 'Avatar',   icon: Activity,        badgeKey: null, premium: false },
  { path: '/paciente/plano-ia',      label: 'Meu plano',            shortLabel: 'Plano',    icon: Sparkles,        badgeKey: null, premium: false },
  { path: '/paciente/exames',        label: 'Exames',               shortLabel: 'Exames',   icon: ClipboardList,   badgeKey: null, premium: false },
];

// Bottom nav: Início, Agenda, Treinos, Diário, +Mais
const MOBILE_PRIMARY = [0, 5, 4, 2]; // indices in navItems
// Items in "Mais" sheet (all others) — avatar is index 12, exames index 13
const MOBILE_SECONDARY = [1, 3, 6, 7, 8, 9, 10, 11, 12, 13];
// Agrupamento do sheet "Mais": saúde em cima, conta embaixo — menos carga visual
const GRUPO_SAUDE = new Set(['/paciente/saude', '/paciente/evolucao', '/paciente/questionarios', '/paciente/avatar', '/paciente/plano-ia', '/paciente/exames']);

interface Props {
  children: ReactNode;
}

export default function PacienteLayout({ children }: Props) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notifications = usePacienteNotifications(user?.id);
  const { isFree } = useWellnessAccess();
  const [maisOpen, setMaisOpen] = useState(false);

  const primaryItems = useMemo(() => MOBILE_PRIMARY.map(i => navItems[i]), []);
  const secondaryItems = useMemo(() => MOBILE_SECONDARY.map(i => navItems[i]), []);
  const breadcrumbs = useMemo(() => getPatientBreadcrumbs(location.pathname), [location.pathname]);

  // Fecha o drawer ao navegar
  useEffect(() => { setMaisOpen(false); }, [location.pathname]);

  const getBadgeCount = (key: string | null): number => {
    if (!key) return 0;
    switch (key) {
      case 'questionarios': return notifications.pendingQuestionarios;
      case 'pagamentos':    return notifications.pendingPagamentos;
      case 'agenda':        return notifications.proximaConsulta ? 1 : 0;
      case 'diario':        return notifications.diarioHoje ? 0 : 1;
      default:              return 0;
    }
  };

  const totalSecondaryBadge = MOBILE_SECONDARY.reduce((sum, i) => sum + getBadgeCount(navItems[i].badgeKey), 0);
  const isMaisActive = MOBILE_SECONDARY.some(i => location.pathname === navItems[i].path);

  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      <PortalOfflineBanner />

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
          <span className="text-xs font-black text-primary-foreground">
            My Health <span style={{ color: 'hsl(var(--accent))' }}>ID</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* "Contar sua história" saiu do topo — agora é o card fixo do Início */}
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

      {/* Desktop sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
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
                {item.premium && isFree && (
                  <Lock className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-primary-foreground/70' : 'text-muted-foreground/50')} />
                )}
                {badge > 0 && (
                  <span className={cn(
                    'min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold',
                    active ? 'bg-primary-foreground text-primary' : 'bg-destructive text-destructive-foreground',
                  )}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
          <div className="mt-auto pt-2 border-t border-border">
            <button
              onClick={async () => { await signOut(); navigate('/paciente/login'); }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all w-full"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Sair</span>
            </button>
          </div>
        </nav>

        <main
          className="flex-1 overflow-y-auto overflow-x-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-6"
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain', scrollBehavior: 'auto', touchAction: 'pan-y' }}
        >
          {/* Voltar — em toda página do portal exceto o Início (a maioria não
              tinha). Volta no histórico; sem histórico, cai no Início. */}
          {location.pathname !== '/paciente/dashboard' && (
            <div className="flex items-center gap-3 px-4 pt-3">
              <button
                onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/paciente/dashboard'); }}
                aria-label="Voltar"
                className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0 active:scale-95"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>
              {breadcrumbs.length > 0 && (
                <Breadcrumb className="min-w-0">
                  <BreadcrumbList>
                    {breadcrumbs.map((crumb, i) => (
                      <Fragment key={crumb.path ?? crumb.label}>
                        {i > 0 && <BreadcrumbSeparator />}
                        <BreadcrumbItem>
                          {crumb.path ? (
                            <BreadcrumbLink asChild>
                              <Link to={crumb.path}>{crumb.label}</Link>
                            </BreadcrumbLink>
                          ) : (
                            <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                          )}
                        </BreadcrumbItem>
                      </Fragment>
                    ))}
                  </BreadcrumbList>
                </Breadcrumb>
              )}
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation — 4 primary + "Mais" */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border flex items-stretch justify-around z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {primaryItems.map((item) => {
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
              <span className={cn('text-[9px] font-medium truncate max-w-full', active && 'font-bold')}>
                {item.shortLabel}
              </span>
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}

        {/* Botão "Mais" */}
        <button
          onClick={() => setMaisOpen(true)}
          className={cn(
            'flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-2 px-1 transition-all active:scale-95 relative',
            isMaisActive ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <div className="relative">
            <MoreHorizontal className={cn('h-5 w-5', isMaisActive && 'text-primary')} />
            {totalSecondaryBadge > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold">
                {totalSecondaryBadge > 9 ? '9+' : totalSecondaryBadge}
              </span>
            )}
          </div>
          <span className={cn('text-[9px] font-medium', isMaisActive && 'font-bold')}>Mais</span>
          {isMaisActive && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
          )}
        </button>
      </nav>

      {/* "Mais" drawer — bottom sheet com todas as seções restantes */}
      {maisOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm"
            onClick={() => setMaisOpen(false)}
          />
          {/* Sheet */}
          <div
            className="md:hidden fixed bottom-0 left-0 right-0 z-[70] bg-card rounded-t-2xl border-t border-border shadow-2xl"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
          >
            {/* Handle + header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-muted mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
              <p className="text-sm font-bold text-foreground mt-1">Mais opções</p>
              <button
                onClick={() => setMaisOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted active:scale-95 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-4 pb-2 space-y-2">
              {([
                { titulo: 'Minha saúde', itens: secondaryItems.filter(i => GRUPO_SAUDE.has(i.path)) },
                { titulo: 'Conta e mais', itens: secondaryItems.filter(i => !GRUPO_SAUDE.has(i.path)) },
              ]).map(grupo => (
                <div key={grupo.titulo}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1 pb-1.5">{grupo.titulo}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {grupo.itens.map((item) => {
                      const active = location.pathname === item.path;
                      const badge = getBadgeCount(item.badgeKey);
                      return (
                        <button
                          key={item.path}
                          onClick={() => navigate(item.path)}
                          className={cn(
                            'flex items-center gap-2.5 px-3 py-3 min-h-[52px] rounded-xl text-sm font-medium transition-all active:scale-[0.97] text-left',
                            active
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'bg-muted/60 text-foreground hover:bg-muted',
                          )}
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          <span className="flex-1 text-[13px] leading-tight">{item.label}</span>
                          {item.premium && isFree && (
                            <Lock className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                          )}
                          {badge > 0 && (
                            <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold">
                              {badge}
                            </span>
                          )}
                          {!badge && !item.premium && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 pt-1 border-t border-border/50 mt-1">
              <button
                onClick={async () => { setMaisOpen(false); await signOut(); navigate('/paciente/login'); }}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/5 transition-all w-full active:scale-[0.97]"
              >
                <LogOut className="h-5 w-5 shrink-0" />
                <span>Sair da conta</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
