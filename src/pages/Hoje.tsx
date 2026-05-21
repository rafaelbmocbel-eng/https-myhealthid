import { useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { startOfDay, endOfDay, format, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Users, LayoutDashboard, Tag,
  CalendarDays, MessageCircle, CalendarHeart,
  BookOpen, Settings, ArrowRight, Clock,
} from 'lucide-react';

import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

function pulseRing(level?: 'high' | 'low') {
  if (!level) return '';
  return level === 'high' ? 'ring-2 ring-destructive/60 animate-pulse-urgent' : 'ring-2 ring-warning/50 animate-pulse-soft';
}

export default function Hoje() {
  const { user, profile, loading, authReady } = useAuth();
  const navigate = useNavigate();

  const firstName = useMemo(() => (profile?.nome || '').split(' ')[0] || 'Olá', [profile]);
  const initials = useMemo(() => {
    const n = profile?.nome || '';
    const s = profile?.sobrenome || '';
    return ((n[0] || '') + (s[0] || '')).toUpperCase() || 'EU';
  }, [profile]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  const today = new Date();
  const todayLabel = format(today, "EEEE, d 'de' MMMM", { locale: ptBR });

  const { data: stats } = useQuery({
    queryKey: ['hoje-stats', user?.id],
    queryFn: async () => {
      const pac = await supabase.from('pacientes')
        .select('id', { count: 'exact', head: true })
        .eq('terapeuta_id', user!.id).eq('ativo', true);
      const aval = await supabase.from('avaliacoes_identidade')
        .select('id', { count: 'exact', head: true })
        .eq('terapeuta_id', user!.id);
      const hoje = await supabase.from('agendamentos')
        .select('id', { count: 'exact', head: true })
        .eq('terapeuta_id', user!.id)
        .gte('data_inicio', startOfDay(today).toISOString())
        .lte('data_inicio', endOfDay(today).toISOString());
      return {
        pacientes: pac.count || 0,
        avaliacoes: aval.count || 0,
        hoje: hoje.count || 0,
      };
    },
    enabled: authReady && !!user,
    staleTime: 60_000,
  });

  const { data: proxima } = useQuery({
    queryKey: ['hoje-proxima-sessao', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('agendamentos')
        .select('id, data_inicio, titulo, paciente_id, pacientes(nome, sobrenome)')
        .eq('terapeuta_id', user!.id)
        .gte('data_inicio', new Date().toISOString())
        .order('data_inicio', { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: authReady && !!user,
    staleTime: 30_000,
  });

  // Pulse indicators — necessidades por módulo
  const { data: alerts } = useQuery({
    queryKey: ['hoje-alerts', user?.id],
    queryFn: async () => {
      const [wa, evHoje] = await Promise.all([
        supabase
          .from('whatsapp_conversas')
          .select('nao_lidas')
          .eq('terapeuta_id', user!.id)
          .gt('nao_lidas', 0),
        supabase
          .from('eventos')
          .select('id', { count: 'exact', head: true })
          .eq('terapeuta_id', user!.id)
          .gte('data_inicio', startOfDay(today).toISOString())
          .lte('data_inicio', endOfDay(today).toISOString()),
      ]);
      const whatsappUnread = (wa.data || []).reduce((s, r: any) => s + (r.nao_lidas || 0), 0);
      return {
        whatsapp: whatsappUnread,
        eventosHoje: evHoje.count || 0,
        agendaHoje: stats?.hoje ?? 0,
      };
    },
    enabled: authReady && !!user,
    staleTime: 30_000,
  });

  // Urgência: 'high' = vermelho pulsando rápido | 'low' = âmbar pulsando suave | undefined = normal
  const urgency = (n: number, highAt = 5): 'high' | 'low' | undefined => {
    if (!n) return undefined;
    return n >= highAt ? 'high' : 'low';
  };

  if (!loading && !user) return <Navigate to="/auth" replace />;

  const proximaDate = proxima?.data_inicio ? new Date(proxima.data_inicio) : null;
  const proximaQuando = proximaDate
    ? isToday(proximaDate)
      ? `Hoje · ${format(proximaDate, 'HH:mm')}`
      : isTomorrow(proximaDate)
        ? `Amanhã · ${format(proximaDate, 'HH:mm')}`
        : format(proximaDate, "EEE d 'de' MMM · HH:mm", { locale: ptBR })
    : null;
  const proximaPaciente = (proxima as any)?.pacientes
    ? `${(proxima as any).pacientes.nome || ''} ${(proxima as any).pacientes.sobrenome || ''}`.trim()
    : proxima?.titulo || 'Sessão agendada';

  return (
    <AppLayout>
      <div className="min-h-[100dvh]">
        <div className="max-w-md mx-auto px-4 pt-2 pb-10 space-y-5">

          {/* Greeting */}
          <header className="flex items-center gap-3 pt-1">
            <div className="h-11 w-11 rounded-full bg-gradient-to-br from-primary to-primary-dark text-primary-foreground flex items-center justify-center text-sm font-bold shadow-sm ring-2 ring-background">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                {todayLabel}
              </div>
              <div className="text-lg font-bold leading-tight truncate">
                {greeting}, {firstName}
              </div>
            </div>
          </header>

          {/* Próxima sessão — compact strip, leva ao Dashboard */}
          <button
            onClick={() => navigate('/inicio-app')}
            className="w-full text-left rounded-2xl px-3.5 py-2.5 relative overflow-hidden
                       bg-gradient-to-r from-[hsl(38_85%_55%)] to-[hsl(20_75%_48%)]
                       text-white shadow-sm hover:shadow-md transition active:scale-[0.99]
                       flex items-center gap-3"
          >
            <div className="h-8 w-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
              <Clock className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[9px] font-semibold tracking-[0.2em] uppercase opacity-85 leading-none">
                Próxima sessão
              </div>
              <div className="mt-0.5 text-sm font-semibold leading-tight truncate">
                {proxima ? proximaPaciente : 'Nenhuma sessão à vista'}
              </div>
            </div>
            {proxima && proximaQuando ? (
              <div className="text-[11px] font-semibold opacity-95 whitespace-nowrap shrink-0">
                {proximaQuando}
              </div>
            ) : null}
            <ArrowRight className="h-3.5 w-3.5 opacity-80 shrink-0" />
          </button>

          {/* Stats inline */}
          <section className="grid grid-cols-3 gap-2">
            <StatChip label="Hoje" value={stats?.hoje ?? 0} accent />
            <StatChip label="Pacientes" value={stats?.pacientes ?? 0} />
            <StatChip label="Avaliações" value={stats?.avaliacoes ?? 0} />
          </section>

          {/* Tile duplo principal */}
          <section className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/agenda')}
              className="h-28 rounded-3xl p-4 text-left flex flex-col justify-between
                         bg-gradient-to-br from-primary to-primary-dark text-primary-foreground shadow-md
                         hover:shadow-lg transition active:scale-[0.98]"
            >
              <div className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
                <CalendarDays className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[10px] font-semibold tracking-[0.18em] uppercase opacity-80">Hoje</div>
                <div className="text-lg font-bold leading-tight">Agenda</div>
              </div>
            </button>

            <button
              onClick={() => navigate('/crm?tab=inbox')}
              className={cn(
                "h-28 rounded-3xl p-4 text-left flex flex-col justify-between relative",
                "bg-card border border-border/40 shadow-sm hover:shadow-md transition active:scale-[0.98]",
                pulseRing(urgency(alerts?.whatsapp ?? 0, 5)),
              )}
            >
              {alerts?.whatsapp ? (
                <span className="absolute top-2.5 right-2.5 min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shadow-sm">
                  {alerts.whatsapp > 99 ? '99+' : alerts.whatsapp}
                </span>
              ) : null}
              <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                <MessageCircle className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">Inbox</div>
                <div className="text-lg font-bold leading-tight">WhatsApp CRM</div>
              </div>
            </button>
          </section>

          {/* Atalhos */}
          <section className="space-y-2">
            <SectionLabel>Atalhos</SectionLabel>
            <div className="grid grid-cols-2 gap-2.5">
              <PillBtn icon={Users} label="Pacientes" onClick={() => navigate('/pacientes')} />
              <PillBtn icon={LayoutDashboard} label="Dashboard" onClick={() => navigate('/inicio-app')} />
              <PillBtn
                icon={CalendarHeart}
                label="Eventos"
                badge={alerts?.eventosHoje}
                urgency={urgency(alerts?.eventosHoje ?? 0, 3)}
                onClick={() => navigate('/eventos')}
              />
              <PillBtn icon={Tag} label="Planos" onClick={() => navigate('/precos')} />
            </div>
          </section>

          {/* Sistema */}
          <section className="space-y-2">
            <SectionLabel>Sistema</SectionLabel>
            <div className="grid grid-cols-2 gap-2.5">
              <PillBtn icon={BookOpen} label="Bases de Dados" onClick={() => navigate('/base-cientifica')} />
              <PillBtn icon={Settings} label="Config" onClick={() => navigate('/configuracoes')} />
            </div>
          </section>

          <div className="h-2" />
        </div>
      </div>
    </AppLayout>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-1 text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
      {children}
    </div>
  );
}

function PillBtn({
  icon: Icon, label, onClick, badge, urgency,
}: {
  icon: any; label: string; onClick: () => void;
  badge?: number; urgency?: 'high' | 'low';
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-14 rounded-2xl bg-card border border-border/40 px-3.5 flex items-center gap-3 relative",
        "shadow-xs hover:shadow-sm hover:border-border transition active:scale-[0.98]",
        pulseRing(urgency),
      )}
    >
      <div className="h-9 w-9 rounded-full bg-muted/60 flex items-center justify-center text-primary shrink-0 relative">
        <Icon className="h-4 w-4" />
        {badge ? (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center shadow-sm">
            {badge > 9 ? '9+' : badge}
          </span>
        ) : null}
      </div>
      <span className="text-sm font-semibold truncate">{label}</span>
    </button>
  );
}

function StatChip({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-2xl px-3 py-3 text-center border ${
      accent
        ? 'bg-primary/5 border-primary/15'
        : 'bg-card border-border/40'
    } shadow-xs`}>
      <div className={`text-xl font-bold leading-none ${accent ? 'text-primary' : ''}`}>{value}</div>
      <div className="text-[9px] font-semibold tracking-[0.18em] uppercase text-muted-foreground mt-1.5">
        {label}
      </div>
    </div>
  );
}
