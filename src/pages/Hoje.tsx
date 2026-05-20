import { useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { startOfDay, endOfDay } from 'date-fns';
import {
  Users, Triangle, BarChart3,
  CalendarDays, MessageCircle, GitBranch, CalendarHeart,
  BookOpen, Settings, Tag,
} from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export default function Hoje() {
  const { user, profile, loading, authReady } = useAuth();
  const navigate = useNavigate();


  const initials = useMemo(() => {
    const n = profile?.nome || '';
    const s = profile?.sobrenome || '';
    return ((n[0] || '') + (s[0] || '')).toUpperCase() || 'EU';
  }, [profile]);

  const today = new Date();

  const { data: pacientes = [] } = useQuery({
    queryKey: ['hoje-pacientes', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('pacientes')
        .select('id, nome, sobrenome')
        .eq('terapeuta_id', user!.id)
        .eq('ativo', true)
        .order('nome')
        .limit(200);
      return data || [];
    },
    enabled: authReady && !!user,
    staleTime: 60_000,
  });

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

  if (!loading && !user) return <Navigate to="/auth" replace />;

  const filtrados = busca.trim()
    ? pacientes.filter((p: any) =>
        `${p.nome} ${p.sobrenome || ''}`.toLowerCase().includes(busca.toLowerCase()))
        .slice(0, 6)
    : [];

  return (
    <AppLayout>
      <div className="min-h-[100dvh] bg-muted/30">
        <div className="max-w-md mx-auto px-4 pt-4 pb-8 space-y-4">


          {/* Dois tiles principais */}
          <section className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/pacientes')}
              className="aspect-square rounded-3xl p-5 text-left flex flex-col justify-between
                         bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md
                         hover:shadow-lg transition active:scale-[0.98]"
            >
              <div className="h-11 w-11 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
                <Triangle className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[10px] font-semibold tracking-[0.18em] uppercase opacity-80">Iniciar</div>
                <div className="text-2xl font-bold leading-tight">Avaliação</div>
                <div className="text-[11px] opacity-80 mt-0.5">MyID v2.0</div>
              </div>
            </button>

            <button
              onClick={() => navigate('/inicio-app')}
              className="aspect-square rounded-3xl p-5 text-left flex flex-col justify-between
                         bg-card border border-border/40 shadow-sm hover:shadow-md transition active:scale-[0.98]"
            >
              <div className="h-11 w-11 rounded-2xl bg-background border border-border/40 flex items-center justify-center text-primary">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">Analytics</div>
                <div className="text-2xl font-bold leading-tight">Dashboard</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Visão geral</div>
              </div>
            </button>
          </section>

          {/* Pills de acesso rápido — todos os módulos */}
          <section className="grid grid-cols-2 gap-3">
            <PillBtn icon={Users} label="Pacientes" onClick={() => navigate('/pacientes')} />
            <PillBtn icon={CalendarDays} label="Agenda" onClick={() => navigate('/agenda')} />
            <PillBtn icon={MessageCircle} label="WhatsApp" onClick={() => navigate('/crm?tab=inbox')} />
            <PillBtn icon={GitBranch} label="CRM" onClick={() => navigate('/crm?tab=pipeline')} />
            <PillBtn icon={CalendarHeart} label="Eventos" onClick={() => navigate('/eventos')} />
            <PillBtn icon={BookOpen} label="Ciência" onClick={() => navigate('/base-cientifica')} />
            <PillBtn icon={Tag} label="Planos" onClick={() => navigate('/precos')} />
            <PillBtn icon={Settings} label="Ajustes" onClick={() => navigate('/configuracoes')} />
          </section>

          {/* Stats */}
          <section className="grid grid-cols-3 gap-3">
            <StatCard label="Pacientes" value={stats?.pacientes ?? 0} />
            <StatCard label="Avaliações" value={stats?.avaliacoes ?? 0} />
            <StatCard label="Hoje" value={stats?.hoje ?? 0} />
          </section>

          {/* Espaço para nav fixa eventual */}
          <div className="h-2" />
        </div>
      </div>
    </AppLayout>
  );
}

function PillBtn({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-14 rounded-2xl bg-card border border-border/40 px-4 flex items-center gap-3
                 shadow-xs hover:shadow-sm transition active:scale-[0.98]"
    >
      <div className="h-9 w-9 rounded-full bg-background border border-border/40 flex items-center justify-center text-primary shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-sm font-semibold truncate">{label}</span>
    </button>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card rounded-2xl border border-border/40 px-3 py-4 text-center shadow-xs">
      <div className="text-2xl font-bold leading-none">{value}</div>
      <div className="text-[10px] font-semibold tracking-[0.16em] uppercase text-muted-foreground mt-2">
        {label}
      </div>
    </div>
  );
}
