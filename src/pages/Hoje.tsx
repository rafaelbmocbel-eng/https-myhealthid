import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { startOfDay, endOfDay } from 'date-fns';
import {
  Search, Plus, Users, Triangle, BarChart3,
  CalendarDays, MessageCircle, GitBranch, CalendarHeart,
  BookOpen, Settings, Tag, Sparkles,
} from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export default function Hoje() {
  const { user, profile, loading, authReady } = useAuth();
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');

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

          {/* Abrir paciente */}
          <section className="bg-card rounded-3xl p-5 shadow-sm border border-border/40">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                  Comece pelo paciente
                </div>
                <h2 className="text-2xl font-bold mt-0.5">Abrir paciente</h2>
              </div>
              <button
                onClick={() => navigate('/pacientes')}
                className="h-11 w-11 rounded-full bg-background border border-border/60 flex items-center justify-center text-primary hover:bg-primary/5 transition shrink-0"
                aria-label="Novo paciente"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 relative">
              <Search className="h-4 w-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar paciente..."
                style={{ fontSize: 16 }}
                className="w-full h-12 pl-11 pr-4 rounded-full bg-background border border-border/60 outline-none focus:border-primary/50 transition"
              />
            </div>

            <div className="mt-3 rounded-2xl border border-dashed border-border/60 bg-background/50 p-5">
              {filtrados.length > 0 ? (
                <div className="space-y-1">
                  {filtrados.map((p: any) => (
                    <button
                      key={p.id}
                      onClick={() => navigate(`/pacientes/${p.id}`)}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-muted/60 flex items-center gap-3 transition"
                    >
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                        {(p.nome[0] || '').toUpperCase()}
                      </div>
                      <span className="text-sm font-medium truncate">
                        {p.nome} {p.sobrenome}
                      </span>
                    </button>
                  ))}
                </div>
              ) : busca ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Nenhum paciente encontrado.
                </p>
              ) : (
                <div className="flex flex-col items-center gap-2 text-center">
                  <Users className="h-6 w-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {pacientes.length === 0
                      ? <>Nenhum paciente ainda. Toque em <strong>+</strong> para começar.</>
                      : <>Digite para buscar entre {pacientes.length} pacientes.</>}
                  </p>
                </div>
              )}
            </div>
          </section>

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
                <div className="text-2xl font-bold leading-tight">Comparar</div>
              </div>
            </button>
          </section>

          {/* Pills de acesso rápido */}
          <section className="grid grid-cols-2 gap-3">
            <PillBtn icon={Brain} label="Testes" onClick={() => navigate('/pacientes')} />
            <PillBtn icon={Zap} label="Drills" onClick={() => navigate('/protocolos')} />
            <PillBtn icon={CalendarDays} label="Agenda" onClick={() => navigate('/agenda')} />
            <PillBtn icon={MessageCircle} label="WhatsApp" onClick={() => navigate('/crm/inbox')} />
            <PillBtn icon={Compass} label="Eventos" onClick={() => navigate('/eventos')} />
            <PillBtn icon={History} label="Histórico" onClick={() => navigate('/relatorios')} />
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
