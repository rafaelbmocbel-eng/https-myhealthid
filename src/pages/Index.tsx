import { Link, Navigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Activity, AlignCenter, ArrowRight, Users, CalendarDays,
  ClipboardList, Clock, Plus, Loader2, BarChart3, TrendingUp,
  CheckCircle2, XCircle, UserX, FileText, Brain, Heart, Bone,
  Zap, Shield, Gauge,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Index() {
  const { user, profile, loading } = useAuth();

  const { data: pacientes = [] } = useQuery({
    queryKey: ['pacientes-count', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('pacientes').select('id, nome, sobrenome').eq('terapeuta_id', user!.id).eq('ativo', true);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: agendamentosHoje = [] } = useQuery({
    queryKey: ['agendamentos-hoje', user?.id],
    queryFn: async () => {
      const today = new Date();
      const { data } = await supabase.from('agendamentos')
        .select('*, pacientes(nome, sobrenome)')
        .eq('terapeuta_id', user!.id)
        .gte('data_inicio', startOfDay(today).toISOString())
        .lte('data_inicio', endOfDay(today).toISOString())
        .order('data_inicio');
      return data || [];
    },
    enabled: !!user,
  });

  const { data: avaliacoesPendentes = [] } = useQuery({
    queryKey: ['avaliacoes-pendentes', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('avaliacoes').select('id').eq('terapeuta_id', user!.id).eq('status', 'pendente');
      return data || [];
    },
    enabled: !!user,
  });

  const { data: pacienteServicos = [] } = useQuery({
    queryKey: ['paciente-servicos-count', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('paciente_servicos').select('paciente_id, servico').eq('ativo', true);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: statsData } = useQuery({
    queryKey: ['dashboard-stats', user?.id],
    queryFn: async () => {
      const [
        { count: totalAvalIdentidade },
        { count: totalAvalCob },
        { count: totalProtocolos },
        { count: protocolosAtivos },
        { data: agSemana },
        { count: totalConcluidos },
        { count: totalFaltas },
        { count: totalCancelados },
      ] = await Promise.all([
        supabase.from('avaliacoes_identidade').select('*', { count: 'exact', head: true }).eq('terapeuta_id', user!.id),
        supabase.from('avaliacoes_cob_zero').select('*', { count: 'exact', head: true }).eq('terapeuta_id', user!.id),
        supabase.from('protocolos').select('*', { count: 'exact', head: true }).eq('terapeuta_id', user!.id),
        supabase.from('protocolos').select('*', { count: 'exact', head: true }).eq('terapeuta_id', user!.id).eq('status', 'ativo'),
        supabase.from('agendamentos').select('status').eq('terapeuta_id', user!.id)
          .gte('data_inicio', new Date(Date.now() - 30 * 86400000).toISOString()),
        supabase.from('agendamentos').select('*', { count: 'exact', head: true }).eq('terapeuta_id', user!.id).eq('status', 'concluido'),
        supabase.from('agendamentos').select('*', { count: 'exact', head: true }).eq('terapeuta_id', user!.id).eq('status', 'faltou'),
        supabase.from('agendamentos').select('*', { count: 'exact', head: true }).eq('terapeuta_id', user!.id).eq('status', 'cancelado'),
      ]);
      const totalSessoes30d = agSemana?.length || 0;
      const concluidos30d = agSemana?.filter(a => a.status === 'concluido').length || 0;
      const faltas30d = agSemana?.filter(a => a.status === 'faltou').length || 0;
      const taxaPresenca = totalSessoes30d > 0 ? Math.round(((totalSessoes30d - faltas30d) / totalSessoes30d) * 100) : 0;
      return {
        totalAvalIdentidade: totalAvalIdentidade || 0,
        totalAvalCob: totalAvalCob || 0,
        totalProtocolos: totalProtocolos || 0,
        protocolosAtivos: protocolosAtivos || 0,
        totalConcluidos: totalConcluidos || 0,
        totalFaltas: totalFaltas || 0,
        totalCancelados: totalCancelados || 0,
        sessoes30d: totalSessoes30d,
        concluidos30d,
        faltas30d,
        taxaPresenca,
      };
    },
    enabled: !!user,
  });

  const { data: amostraClinica } = useQuery({
    queryKey: ['amostra-clinica', user?.id],
    queryFn: async () => {
      const { data: avaliacoes } = await supabase
        .from('avaliacoes_identidade')
        .select('score_e, score_p, score_c, score_f, score_d, score_r, score_efi, id_final, dados_avaliacao, classificacao')
        .eq('terapeuta_id', user!.id);
      if (!avaliacoes || avaliacoes.length === 0) return null;
      const n = avaliacoes.length;
      const avg = (key: string) => {
        const vals = avaliacoes.map(a => (a as any)[key]).filter((v: any) => v != null && !isNaN(v));
        return vals.length > 0 ? vals.reduce((s: number, v: number) => s + Number(v), 0) / vals.length : 0;
      };
      const scores = {
        E: avg('score_e'), P: avg('score_p'), C: avg('score_c'),
        F: avg('score_f'), D: avg('score_d'), R: avg('score_r'),
        EFI: avg('score_efi'), ID: avg('id_final'),
      };
      const locaisDor: Record<string, number> = {};
      const classificacoes: Record<string, number> = {};
      avaliacoes.forEach(a => {
        if (a.classificacao) classificacoes[a.classificacao] = (classificacoes[a.classificacao] || 0) + 1;
        try {
          const dados = a.dados_avaliacao as any;
          if (dados?.bloco2?.local_dor) {
            const loc = Array.isArray(dados.bloco2.local_dor) ? dados.bloco2.local_dor : [dados.bloco2.local_dor];
            loc.forEach((l: string) => { if (l) locaisDor[l] = (locaisDor[l] || 0) + 1; });
          }
          if (dados?.bloco2?.regioes_dor) {
            const regs = Array.isArray(dados.bloco2.regioes_dor) ? dados.bloco2.regioes_dor : [dados.bloco2.regioes_dor];
            regs.forEach((r: string) => { if (r) locaisDor[r] = (locaisDor[r] || 0) + 1; });
          }
          if (dados?.bloco6?.unidades_afetadas) {
            const ucs = Array.isArray(dados.bloco6.unidades_afetadas) ? dados.bloco6.unidades_afetadas : [];
            ucs.forEach((uc: string) => { if (uc) locaisDor[uc] = (locaisDor[uc] || 0) + 1; });
          }
        } catch {}
      });
      const topLocais = Object.entries(locaisDor).sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([nome, count]) => ({ nome, count, pct: Math.round((count / n) * 100) }));
      const topClassificacoes = Object.entries(classificacoes).sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([nome, count]) => ({ nome, count, pct: Math.round((count / n) * 100) }));
      return { scores, n, topLocais, topClassificacoes };
    },
    enabled: !!user,
  });

  if (!loading && !user) return <Navigate to="/auth" replace />;

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </AppLayout>
  );

  const proximoAtendimento = agendamentosHoje.find(a => {
    const inicio = parseISO(a.data_inicio);
    return inicio > new Date() && a.status !== 'cancelado';
  });

  const metodoIdentidadePacientes = pacienteServicos.filter(s => s.servico === 'metodo_identidade').length;
  const cobZeroPacientes = pacienteServicos.filter(s => s.servico === 'cob_zero').length;

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <AppLayout>
      <div className="container py-8 max-w-6xl">
        {/* Welcome header */}
        <div className="mb-8">
          <h1 className="text-2xl font-black text-foreground">
            {saudacao}, {profile?.nome || 'Terapeuta'}! 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Pacientes Totais', value: pacientes.length, icon: Users, color: 'text-primary' },
            { label: 'Atendimentos Hoje', value: agendamentosHoje.length, icon: CalendarDays, color: 'text-emerald-600' },
            { label: 'Avaliações Pendentes', value: avaliacoesPendentes.length, icon: ClipboardList, color: 'text-amber-600' },
            {
              label: 'Próximo Atendimento',
              value: proximoAtendimento ? format(parseISO(proximoAtendimento.data_inicio), 'HH:mm') : '—',
              icon: Clock,
              color: 'text-blue-600',
            },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="clinical-card text-center p-4">
                <Icon className={`h-6 w-6 mx-auto mb-2 ${stat.color}`} />
                <div className="text-2xl font-black text-foreground">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1 leading-tight">{stat.label}</div>
              </div>
            );
          })}
        </div>

        {/* Main modules */}
        <div className="grid md:grid-cols-3 gap-5 mb-8">
          {/* Método Identidade */}
          <div className="clinical-card border-2 border-primary/20 hover:border-primary/40 transition-all flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-11 w-11 rounded-xl bg-gradient-primary flex items-center justify-center shadow-primary shrink-0">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">Método Identidade</h2>
                <p className="text-xs text-muted-foreground">Avaliação Multidimensional da Dor</p>
              </div>
            </div>
            <div className="flex-1 space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pacientes</span>
                <span className="font-semibold text-primary">{metodoIdentidadePacientes}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">6 Blocos de Avaliação</span>
                <span className="text-muted-foreground">Scores E, P, C, F, D, R</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link to="/pacientes">Ver Pacientes</Link>
              </Button>
              <Button asChild size="sm" className="flex-1 bg-gradient-primary text-white">
                <Link to="/metodo-identidade">
                  Avaliar <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              </Button>
            </div>
          </div>

          {/* COB° ZERO */}
          <div className="clinical-card border-2 border-blue-200 hover:border-blue-400 transition-all flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shrink-0">
                <AlignCenter className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">COB° ZERO</h2>
                <p className="text-xs text-muted-foreground">Protocolo Integrado de Escoliose</p>
              </div>
            </div>
            <div className="flex-1 space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pacientes</span>
                <span className="font-semibold text-blue-600">{cobZeroPacientes}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">5 Etapas</span>
                <span className="text-muted-foreground">Cobb, Lenke, Risco</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link to="/pacientes">Ver Pacientes</Link>
              </Button>
              <Button asChild size="sm" className="flex-1 text-white" style={{ background: 'linear-gradient(135deg, hsl(210 80% 45%), hsl(187 76% 45%))' }}>
                <Link to="/cob-zero">
                  Protocolo <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Agenda Premium */}
          <div className="clinical-card border-2 border-amber-200 hover:border-amber-400 transition-all flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shrink-0">
                <CalendarDays className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">Agenda Premium</h2>
                <p className="text-xs text-muted-foreground">Calendário Inteligente · Slots 45min</p>
              </div>
            </div>
            <div className="flex-1 space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Hoje</span>
                <span className="font-semibold text-amber-600">{agendamentosHoje.length} atendimentos</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Horário</span>
                <span className="text-muted-foreground">6h – 20h</span>
              </div>
            </div>
            <Button asChild size="sm" className="w-full text-white" style={{ background: 'linear-gradient(135deg, hsl(40 96% 52%), hsl(25 95% 53%))' }}>
              <Link to="/agenda">
                Abrir Agenda <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Today's schedule */}
        {agendamentosHoje.length > 0 && (
          <div className="clinical-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-foreground">Agenda de Hoje</h2>
              <Button asChild variant="ghost" size="sm" className="text-primary">
                <Link to="/agenda">Ver tudo <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
              </Button>
            </div>
            <div className="space-y-2">
              {agendamentosHoje.slice(0, 5).map((ag: any) => {
                const inicio = parseISO(ag.data_inicio);
                const isPast = inicio < new Date();
                return (
                  <div key={ag.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${isPast ? 'opacity-60' : 'hover:bg-accent/10'}`}>
                    <div className="text-sm font-mono font-bold text-primary w-12 shrink-0">
                      {format(inicio, 'HH:mm')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {ag.pacientes ? `${ag.pacientes.nome} ${ag.pacientes.sobrenome}` : ag.titulo || 'Agendamento'}
                      </div>
                      <div className="text-xs text-muted-foreground">{ag.tipo_atendimento || 'Retorno'}</div>
                    </div>
                    <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      ag.status === 'confirmado' ? 'bg-emerald-100 text-emerald-700' :
                      ag.status === 'pendente' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {ag.status}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Estatísticas Gerais */}
        {statsData && (
          <div className="clinical-card mb-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">Estatísticas Gerais</h2>
                <p className="text-xs text-muted-foreground">Visão consolidada dos últimos 30 dias</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
              {[
                { label: 'Avaliações Identidade', value: statsData.totalAvalIdentidade, icon: Activity, color: 'text-primary' },
                { label: 'Avaliações COB°', value: statsData.totalAvalCob, icon: AlignCenter, color: 'text-blue-600' },
                { label: 'Protocolos Totais', value: statsData.totalProtocolos, icon: FileText, color: 'text-violet-600' },
                { label: 'Protocolos Ativos', value: statsData.protocolosAtivos, icon: TrendingUp, color: 'text-emerald-600' },
                { label: 'Sessões (30d)', value: statsData.sessoes30d, icon: CalendarDays, color: 'text-amber-600' },
                { label: 'Taxa Presença', value: `${statsData.taxaPresenca}%`, icon: CheckCircle2, color: 'text-teal-600' },
              ].map(s => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="rounded-xl border bg-card p-3 text-center">
                    <Icon className={`h-5 w-5 mx-auto mb-1.5 ${s.color}`} />
                    <div className="text-xl font-black text-foreground">{s.value}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{s.label}</div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{statsData.totalConcluidos}</div>
                  <div className="text-[10px] text-emerald-600/80">Concluídos</div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 p-2.5">
                <UserX className="h-4 w-4 text-red-600 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-red-700 dark:text-red-400">{statsData.totalFaltas}</div>
                  <div className="text-[10px] text-red-600/80">Faltas</div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-950/30 p-2.5">
                <XCircle className="h-4 w-4 text-slate-500 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-slate-700 dark:text-slate-400">{statsData.totalCancelados}</div>
                  <div className="text-[10px] text-slate-500/80">Cancelados</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Amostra Clínica Populacional */}
        {amostraClinica && (
          <div className="clinical-card mb-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-600 to-pink-500 flex items-center justify-center shadow-lg">
                <Gauge className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">Amostra Clínica Populacional</h2>
                <p className="text-xs text-muted-foreground">
                  Média geral de {amostraClinica.n} avaliações · Todos os pacientes
                </p>
              </div>
            </div>

            {/* Scores médios biopsicossociais */}
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5" /> Índices Biopsicossociais (Média Geral)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Estrutural (E)', value: amostraClinica.scores.E, icon: Bone, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
                { label: 'Psicológico (P)', value: amostraClinica.scores.P, icon: Brain, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30' },
                { label: 'Cinesiofobia (C)', value: amostraClinica.scores.C, icon: Shield, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
                { label: 'Funcional (F)', value: amostraClinica.scores.F, icon: Zap, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
                { label: 'Dor (D)', value: amostraClinica.scores.D, icon: Heart, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30' },
                { label: 'Regulação (R)', value: amostraClinica.scores.R, icon: Activity, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-950/30' },
                { label: 'EFI Global', value: amostraClinica.scores.EFI, icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
                { label: 'Dor Identidade', value: amostraClinica.scores.ID, icon: Gauge, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950/30' },
              ].map(s => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className={`rounded-xl p-3 ${s.bg}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className={`h-3.5 w-3.5 ${s.color}`} />
                      <span className="text-[10px] font-medium text-muted-foreground">{s.label}</span>
                    </div>
                    <div className={`text-xl font-black ${s.color}`}>{s.value.toFixed(1)}</div>
                    <Progress value={s.value * 10} className="h-1.5 mt-1" />
                  </div>
                );
              })}
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {/* Locais de dor mais frequentes */}
              {amostraClinica.topLocais.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Heart className="h-3.5 w-3.5" /> Locais de Dor Mais Frequentes
                  </h3>
                  <div className="space-y-2">
                    {amostraClinica.topLocais.map(loc => (
                      <div key={loc.nome} className="flex items-center gap-3">
                        <span className="text-xs font-medium text-foreground w-28 truncate">{loc.nome}</span>
                        <div className="flex-1">
                          <Progress value={loc.pct} className="h-2" />
                        </div>
                        <span className="text-xs font-bold text-muted-foreground w-12 text-right">{loc.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Classificações */}
              {amostraClinica.topClassificacoes.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <ClipboardList className="h-3.5 w-3.5" /> Classificações Predominantes
                  </h3>
                  <div className="space-y-2">
                    {amostraClinica.topClassificacoes.map(cl => (
                      <div key={cl.nome} className="flex items-center gap-3">
                        <span className="text-xs font-medium text-foreground w-28 truncate">{cl.nome}</span>
                        <div className="flex-1">
                          <Progress value={cl.pct} className="h-2" />
                        </div>
                        <span className="text-xs font-bold text-muted-foreground w-12 text-right">
                          {cl.count} <span className="text-[10px] font-normal">({cl.pct}%)</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="outline" className="gap-2">
            <Link to="/pacientes"><Plus className="h-4 w-4" /> Novo Paciente</Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/agenda"><CalendarDays className="h-4 w-4" /> Agendar</Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/metodo-identidade"><ClipboardList className="h-4 w-4" /> Nova Avaliação</Link>
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
