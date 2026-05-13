import { Link, Navigate, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useState, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import { useToast } from '@/components/ui/use-toast';
import {
  Activity, AlignCenter, ArrowRight, Users, CalendarDays,
  ClipboardList, Clock, Plus, Loader2, BarChart3, TrendingUp,
  CheckCircle2, XCircle, UserX, FileText, Brain, Heart, Bone,
  Zap, Shield, Gauge, MapPin, Stethoscope, Dumbbell, BedDouble,
  Battery, Briefcase, Sparkles, Link as LinkIcon, X, UserPlus, MessageCircle
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { format, parseISO, startOfDay, endOfDay, formatDistanceToNow, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getBaseUrl } from '@/utils/linkUrls';
import { PageTransition, StaggerContainer, StaggerItem, FadeIn } from '@/components/PageTransition';
import { DashboardSkeleton } from '@/components/ui/skeleton-card';
import { useServicosAtivos } from '@/hooks/useServicosAtivos';
import OnboardingGuide from '@/components/onboarding/OnboardingGuide';
import NpsSurveyCard from '@/components/nps/NpsSurveyCard';
const ResearchDashboard = lazy(() => import('@/components/dashboard/ResearchDashboard'));
const ClinicalInsights = lazy(() => import('@/components/dashboard/ClinicalInsights'));
import { FlaskConical } from 'lucide-react';

export default function Index() {
  const { user, profile, loading, authReady } = useAuth();
  const navigate = useNavigate();
  const { servicos } = useServicosAtivos();
  const [vertente, setVertente] = useState<'clinica' | 'pesquisa'>('clinica');

  const { data: pacientes = [] } = useQuery({
    queryKey: ['pacientes-count', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('pacientes').select('id, nome, sobrenome').eq('terapeuta_id', user!.id).eq('ativo', true);
      return data || [];
    },
    enabled: authReady && !!user,
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
    enabled: authReady && !!user,
  });

  const { data: avaliacoesPendentes = [] } = useQuery({
    queryKey: ['avaliacoes-pendentes', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('avaliacoes').select('id').eq('terapeuta_id', user!.id).eq('status', 'pendente');
      return data || [];
    },
    enabled: authReady && !!user,
  });

  const { data: pacienteServicos = [] } = useQuery({
    queryKey: ['paciente-servicos-count', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('paciente_servicos').select('paciente_id, servico').eq('ativo', true);
      return data || [];
    },
    enabled: authReady && !!user,
  });

  const { data: statsData } = useQuery({
    queryKey: ['dashboard-stats', user?.id],
    queryFn: async () => {
      const [
        { count: totalAvalIdentidade },
        { count: totalAvalPresenciais },
        { count: totalProtocolos },
        { count: protocolosAtivos },
        { data: agSemana },
        { count: totalConcluidos },
        { count: totalFaltas },
        { count: totalCancelados },
      ] = await Promise.all([
        supabase.from('avaliacoes_identidade').select('*', { count: 'exact', head: true }).eq('terapeuta_id', user!.id),
        supabase.from('avaliacoes_voz').select('*', { count: 'exact', head: true }).eq('terapeuta_id', user!.id),
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
        totalAvalPresenciais: totalAvalPresenciais || 0,
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
    enabled: authReady && !!user,
  });

  const { data: avaliacoesRaw = [] } = useQuery({
    queryKey: ['avaliacoes-raw-epidemio', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('avaliacoes_identidade')
        .select('score_e, score_p, score_c, score_f, score_d, score_r, score_efi, score_i, score_n, id_final, myid_score, dados_avaliacao, classificacao, paciente_id, created_at, red_flags, pacientes(nome, sobrenome)')
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: true });
      return data || [];
    },
    enabled: authReady && !!user,
  });




  

  const { data: amostraClinica } = useQuery({
    queryKey: ['amostra-clinica', user?.id, avaliacoesRaw.length],
    queryFn: async () => {
      const avaliacoes = avaliacoesRaw;
      if (!avaliacoes || avaliacoes.length === 0) return null;
      const n = avaliacoes.length;
      const avg = (key: string) => {
        const vals = avaliacoes.map(a => (a as any)[key]).filter((v: any) => v != null && !isNaN(v));
        return vals.length > 0 ? vals.reduce((s: number, v: number) => s + Number(v), 0) / vals.length : 0;
      };
      // Extract v2 sub-dimensions from dados_avaliacao
      const extractSubScore = (key: string) => {
        const vals = avaliacoes.map(a => {
          try { const d = a.dados_avaliacao as any; return Number(d?.resultado?.componentScores?.[key] || 0); } catch { return 0; }
        }).filter(v => v > 0);
        return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
      };
      const scores = {
        D: avg('score_d'), EFI: avg('score_efi'), R: avg('score_r'),
        C: avg('score_c'), P: avg('score_p'), I: avg('score_i'),
        N: avg('score_n'), MyID: avg('id_final'),
        AF: extractSubScore('AF'), HID: extractSubScore('HID'),
        NUT: extractSubScore('NUT'), ERG: extractSubScore('ERG'),
        MED: extractSubScore('MED'),
      };

      const totalRedFlags = avaliacoes.filter(a => a.red_flags || (a.dados_avaliacao as any)?.resultado?.redFlagsDetected).length;

      const regioesDor: Record<string, { count: number; intensidadeTotal: number }> = {};
      const unidadesCorporais: Record<string, { count: number; scoreTotal: number }> = {};
      const comorbidades: Record<string, number> = {};
      const classificacoes: Record<string, number> = {};
      const atividadeFisica: Record<string, number> = {};
      const tecidosTotal = { muscular: 0, articular: 0, ligamentar: 0, nervosa: 0, visceral: 0, count: 0 };
      const regulacaoSubs = { R1_sono: 0, R2_energia: 0, R3_psico: 0, cargaLaboral: 0, countR: 0 };
      const funcionalidade = { trabalho: 0, exercicio: 0, domesticas: 0, vidaSocial: 0, independencia: 0, countF: 0 };

      avaliacoes.forEach(a => {
        if (a.classificacao) classificacoes[a.classificacao] = (classificacoes[a.classificacao] || 0) + 1;
        try {
          const d = a.dados_avaliacao as any;
          // Bloco 1 - Comorbidades e atividade
          if (d?.bloco1?.historicoMedico) {
            (d.bloco1.historicoMedico as string[]).forEach(c => {
              if (c) comorbidades[c] = (comorbidades[c] || 0) + 1;
            });
          }
          if (d?.bloco1?.atividadeFisica) {
            const af = d.bloco1.atividadeFisica;
            atividadeFisica[af] = (atividadeFisica[af] || 0) + 1;
          }
          // Bloco 2 - Regiões de dor
          if (d?.bloco2?.regioes && Array.isArray(d.bloco2.regioes)) {
            d.bloco2.regioes.forEach((r: any) => {
              const nome = r.nome || r.id;
              if (!nome) return;
              if (!regioesDor[nome]) regioesDor[nome] = { count: 0, intensidadeTotal: 0 };
              regioesDor[nome].count++;
              regioesDor[nome].intensidadeTotal += Number(r.intensidade || 0);
            });
          }
          // Bloco 3 - Funcionalidade
          if (d?.bloco3) {
            funcionalidade.trabalho += Number(d.bloco3.trabalho || 0);
            funcionalidade.exercicio += Number(d.bloco3.exercicio || 0);
            funcionalidade.domesticas += Number(d.bloco3.domesticas || 0);
            funcionalidade.vidaSocial += Number(d.bloco3.vidaSocial || 0);
            funcionalidade.independencia += Number(d.bloco3.independencia || 0);
            funcionalidade.countF++;
          }
          // Bloco 5 - Regulação sub-scores
          if (d?.bloco5) {
            regulacaoSubs.R1_sono += Number(d.bloco5.scoreR1 || 0);
            regulacaoSubs.R2_energia += Number(d.bloco5.scoreR2 || 0);
            regulacaoSubs.R3_psico += Number(d.bloco5.scoreR3 || 0);
            regulacaoSubs.cargaLaboral += Number(d.bloco5.cargaLaboral || 0);
            regulacaoSubs.countR++;
          }
          // Bloco 6 - Unidades corporais e tecidos
          if (d?.bloco6?.unidades && Array.isArray(d.bloco6.unidades)) {
            d.bloco6.unidades.forEach((u: any) => {
              const nome = u.nome || u.id;
              if (!nome) return;
              const score = Number(u.score || 0);
              if (!unidadesCorporais[nome]) unidadesCorporais[nome] = { count: 0, scoreTotal: 0 };
              if (score > 0) {
                unidadesCorporais[nome].count++;
                unidadesCorporais[nome].scoreTotal += score;
              }
              tecidosTotal.muscular += Number(u.scoreMuscular || 0);
              tecidosTotal.articular += Number(u.scoreArticular || 0);
              tecidosTotal.ligamentar += Number(u.scoreLigamentar || 0);
              tecidosTotal.nervosa += Number(u.scoreNervosa || 0);
              tecidosTotal.visceral += Number(u.scoreVisceral || 0);
              tecidosTotal.count++;
            });
          }
        } catch { }
      });

      const toRanked = (rec: Record<string, number>, max = 8) =>
        Object.entries(rec).sort((a, b) => b[1] - a[1]).slice(0, max)
          .map(([nome, count]) => ({ nome, count, pct: Math.round((count / n) * 100) }));

      const topRegioes = Object.entries(regioesDor)
        .sort((a, b) => b[1].count - a[1].count).slice(0, 8)
        .map(([nome, v]) => ({ nome, count: v.count, pct: Math.round((v.count / n) * 100), mediaIntensidade: v.count > 0 ? v.intensidadeTotal / v.count : 0 }));

      const topUnidades = Object.entries(unidadesCorporais)
        .filter(([, v]) => v.count > 0)
        .sort((a, b) => b[1].count - a[1].count).slice(0, 8)
        .map(([nome, v]) => ({ nome: nome.replace(/^UC\d+ – /, '').replace(/^[A-Z]+-[A-Z]+ – /, '').replace(/^[A-Z]+ – /, ''), nomeCompleto: nome, count: v.count, pct: Math.round((v.count / n) * 100), mediaScore: v.count > 0 ? v.scoreTotal / v.count : 0 }));

      const tc = tecidosTotal.count || 1;
      const tecidosMedia = {
        Muscular: tecidosTotal.muscular / tc,
        Articular: tecidosTotal.articular / tc,
        Ligamentar: tecidosTotal.ligamentar / tc,
        Nervoso: tecidosTotal.nervosa / tc,
        Visceral: tecidosTotal.visceral / tc,
      };

      const rc = regulacaoSubs.countR || 1;
      const regMedia = {
        'Sono (R1)': regulacaoSubs.R1_sono / rc,
        'Energia (R2)': regulacaoSubs.R2_energia / rc,
        'Psicológico (R3)': regulacaoSubs.R3_psico / rc,
        'Carga Laboral': regulacaoSubs.cargaLaboral / rc,
      };

      const fc = funcionalidade.countF || 1;
      const funcMedia = {
        Trabalho: funcionalidade.trabalho / fc,
        Exercício: funcionalidade.exercicio / fc,
        Domésticas: funcionalidade.domesticas / fc,
        'Vida Social': funcionalidade.vidaSocial / fc,
        Independência: funcionalidade.independencia / fc,
      };

      return {
        scores, n,
        totalRedFlags,
        percentRedFlags: n > 0 ? Math.round((totalRedFlags / n) * 100) : 0,
        topRegioes, topUnidades,
        topComorbidades: toRanked(comorbidades),
        topClassificacoes: toRanked(classificacoes, 5),
        topAtividade: toRanked(atividadeFisica, 5),
        tecidosMedia, regMedia, funcMedia,
      };
    },
    enabled: !!user,
  });

  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) setIsFabOpen(false);
    };
    if (isFabOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFabOpen]);

  const { data: atividadesRecentes = [] } = useQuery({
    queryKey: ['atividades-recentes', user?.id],
    queryFn: async () => {
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      const [agResult, avalIdResult, pacResult] = await Promise.all([
        supabase.from('agendamentos').select('id, data_inicio, status, tipo_atendimento, created_at, pacientes(id, nome, sobrenome)').eq('terapeuta_id', user!.id).gte('created_at', sevenDaysAgo).order('created_at', { ascending: false }).limit(5),
        supabase.from('avaliacoes_identidade').select('id, created_at, classificacao, paciente_id, pacientes(id, nome, sobrenome)').eq('terapeuta_id', user!.id).gte('created_at', sevenDaysAgo).order('created_at', { ascending: false }).limit(5),
        supabase.from('pacientes').select('id, nome, sobrenome, created_at').eq('terapeuta_id', user!.id).gte('created_at', sevenDaysAgo).order('created_at', { ascending: false }).limit(5),
      ]);
      type ActivityItem = { id: string; type: 'agendamento' | 'avaliacao_id' | 'novo_paciente'; description: string; pacienteNome: string; pacienteId?: string; timestamp: string; icon: 'calendar' | 'clipboard' | 'user-plus' };
      const items: ActivityItem[] = [];
      (agResult.data || []).forEach((a: any) => items.push({ id: `ag-${a.id}`, type: 'agendamento', description: `${a.tipo_atendimento || 'Consulta'} ${a.status === 'concluido' ? 'concluída' : a.status === 'cancelado' ? 'cancelada' : 'agendada'}`, pacienteNome: a.pacientes ? `${a.pacientes.nome} ${a.pacientes.sobrenome}` : 'Paciente', pacienteId: a.pacientes?.id, timestamp: a.created_at, icon: 'calendar' }));
      (avalIdResult.data || []).forEach((a: any) => items.push({ id: `avi-${a.id}`, type: 'avaliacao_id', description: `Avaliação MyID${a.classificacao ? ` — ${a.classificacao}` : ''} concluída`, pacienteNome: a.pacientes ? `${a.pacientes.nome} ${a.pacientes.sobrenome}` : 'Paciente', pacienteId: a.paciente_id, timestamp: a.created_at, icon: 'clipboard' }));
      (pacResult.data || []).forEach((p: any) => items.push({ id: `pac-${p.id}`, type: 'novo_paciente', description: 'Novo paciente cadastrado', pacienteNome: `${p.nome} ${p.sobrenome}`, pacienteId: p.id, timestamp: p.created_at, icon: 'user-plus' }));
      return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 8);
    },
    enabled: !!user,
  });

  const handleGerarLinkMyID = async () => {
    if (!user) return;
    try {
      setIsGeneratingLink(true);

      const token = Math.random().toString(36).substring(2, 12);

      const { data, error } = await supabase
        .from('myid_avaliacoes')
        .insert({
          terapeuta_id: user.id,
          token_acesso: token,
          status: 'pendente'
        })
        .select()
        .single();

      if (error) throw error;

      const link = `${getBaseUrl()}/myid/responder/${token}`;
      await navigator.clipboard.writeText(`Olá! Para iniciarmos nosso trabalho ou atualização, por favor responda ao Questionário MyID através deste link. Leva cerca de 10 minutinhos:\n\n${link}`);

      toast({
        title: "Link Copiado!",
        description: "O link do MyID foi copiado para a área de transferência.",
      });

    } catch (err: any) {
      toast({
        title: "Erro ao gerar link",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsGeneratingLink(false);
    }
  };

  if (!loading && !user) return <Navigate to="/auth" replace />;

  if (loading) return (
    <AppLayout>
      <DashboardSkeleton />
    </AppLayout>
  );

  const proximoAtendimento = agendamentosHoje.find(a => {
    const inicio = parseISO(a.data_inicio);
    return inicio > new Date() && a.status !== 'cancelado';
  });

  

  // Filtra avaliações recentes com red flags (últimos 30 dias)
  const recentAlerts = avaliacoesRaw
    .filter(a => {
      const isRed = a.red_flags || (a.dados_avaliacao as any)?.resultado?.redFlagsDetected;
      const isRecent = new Date(a.created_at) > new Date(Date.now() - 30 * 86400000);
      return isRed && isRecent;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3);

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <AppLayout>
      <PageTransition>
      <div className="container py-4 sm:py-8 max-w-6xl px-2 sm:px-6">
        {/* Welcome header */}
        <FadeIn>
        <header className="mb-6 sm:mb-8">
          <h1 className="h-page">
            {saudacao}, {profile?.nome || 'Terapeuta'}
          </h1>
          <p className="text-caption mt-1.5 capitalize">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </header>
        </FadeIn>

        {/* Vertente toggle */}
        <div className="inline-flex p-1 rounded-xl border border-border/40 bg-card mb-5">
          <button
            onClick={() => setVertente('clinica')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${vertente === 'clinica' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Stethoscope className="icon-xs" /> Visão Clínica
          </button>
          <button
            onClick={() => setVertente('pesquisa')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${vertente === 'pesquisa' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <FlaskConical className="icon-xs" /> Pesquisa Científica
          </button>
        </div>

        {vertente === 'pesquisa' ? (
          <ResearchDashboard />
        ) : (
        <>

        {/* Painel estratégico — usa todos os dados gerados */}
        <ClinicalInsights />

        {/* Onboarding Guide */}
        <div className="mb-6">
          <OnboardingGuide />
        </div>

        {/* Quick stats — clean row */}
        <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 mb-6 sm:mb-8">
          {[
            { label: 'Pacientes', value: pacientes.length, icon: Users },
            { label: 'Hoje', value: agendamentosHoje.length, icon: CalendarDays },
            { label: 'Pendentes', value: avaliacoesPendentes.length, icon: ClipboardList },
            {
              label: 'Próximo',
              value: proximoAtendimento ? format(parseISO(proximoAtendimento.data_inicio), 'HH:mm') : '—',
              icon: Clock,
              onClick: () => proximoAtendimento?.pacientes && navigate(`/pacientes/${(proximoAtendimento as any).pacientes.id}`),
              subtitle: proximoAtendimento?.pacientes ? `${(proximoAtendimento as any).pacientes.nome}` : undefined,
            },
          ].map(stat => {
            const Icon = stat.icon;
            const clickable = !!(stat as any).onClick;
            return (
              <StaggerItem key={stat.label}>
                <div
                  className={`rounded-xl border border-border/40 bg-card p-3 sm:p-4 transition-colors ${clickable ? 'cursor-pointer hover:border-primary/40' : ''}`}
                  onClick={(stat as any).onClick}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-micro">{stat.label}</span>
                    <Icon className="icon-xs text-muted-foreground/70" />
                  </div>
                  <div className="text-2xl font-semibold text-foreground tracking-tight">{stat.value}</div>
                  {(stat as any).subtitle && (
                    <div className="text-[11px] text-muted-foreground truncate mt-0.5">{(stat as any).subtitle}</div>
                  )}
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>

        {/* Service modules — clean list, no gradients */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-6 sm:mb-8">
          {[
            { label: 'Agenda', sublabel: `${agendamentosHoje.length} hoje`, icon: CalendarDays, href: '/agenda' },
          ].map(mod => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.href}
                to={mod.href}
                className="rounded-xl border border-border/40 bg-card p-3 sm:p-4 flex items-center gap-3 hover:border-primary/40 transition-colors group"
              >
                <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                  <Icon className="icon-sm text-foreground/70 group-hover:text-primary transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="h-card truncate">{mod.label}</div>
                  <div className="text-caption mt-0.5">{mod.sublabel}</div>
                </div>
                <ArrowRight className="icon-sm text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </Link>
            );
          })}
        </div>

        {/* Today's schedule */}
        {agendamentosHoje.length > 0 && (
          <section className="rounded-xl border border-border/40 bg-card p-4 sm:p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="h-section">Agenda de hoje</h2>
              <Button asChild variant="ghost" size="sm" className="text-primary h-8">
                <Link to="/agenda">Ver tudo <ArrowRight className="icon-xs ml-1" /></Link>
              </Button>
            </div>
            <div className="space-y-1">
              {agendamentosHoje.slice(0, 5).map((ag: any) => {
                const inicio = parseISO(ag.data_inicio);
                const isPast = inicio < new Date();
                return (
                  <div key={ag.id} className={`flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors ${isPast ? 'opacity-50' : 'hover:bg-muted/50'}`}>
                    <div className="text-sm font-mono font-semibold text-foreground w-12 shrink-0 tabular-nums">
                      {format(inicio, 'HH:mm')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {ag.pacientes ? `${ag.pacientes.nome} ${ag.pacientes.sobrenome}` : ag.titulo || 'Agendamento'}
                      </div>
                      <div className="text-caption">{ag.tipo_atendimento || 'Retorno'}</div>
                    </div>
                    <div className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      ag.status === 'confirmado' ? 'bg-emerald-50 text-emerald-700' :
                      ag.status === 'pendente' ? 'bg-amber-50 text-amber-700' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {ag.status}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Alertas Clínicos Críticos (Red Flags) */}
        {recentAlerts.length > 0 && (
          <section className="rounded-xl border border-destructive/20 bg-destructive/[0.02] p-4 sm:p-5 mb-6">
            <div className="flex items-center gap-2.5 mb-4">
              <Shield className="icon-sm text-destructive" />
              <div className="min-w-0">
                <h2 className="h-section text-destructive">Alertas clínicos ativos</h2>
                <p className="text-caption">Pacientes com Red Flags recentes</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-2.5">
              {recentAlerts.map(alert => (
                <button
                  key={alert.id_final || alert.created_at}
                  type="button"
                  className="text-left p-3 rounded-lg border border-destructive/15 bg-card hover:border-destructive/40 hover:bg-destructive/[0.04] transition-colors"
                  onClick={() => alert.paciente_id && navigate(`/pacientes/${alert.paciente_id}`)}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground truncate">{(alert.pacientes as any)?.nome} {(alert.pacientes as any)?.sobrenome}</span>
                  </div>
                  <div className="text-caption">Perímetro de alerta MyID acionado</div>
                  <div className="text-[10px] text-muted-foreground mt-1.5">
                    {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ptBR })}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Feed de Atividades Recentes */}
        {atividadesRecentes.length > 0 && (
          <section className="rounded-xl border border-border/40 bg-card p-4 sm:p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="h-section">Últimas atividades</h2>
              <Button asChild variant="ghost" size="sm" className="text-primary h-8">
                <Link to="/pacientes">Ver tudo <ArrowRight className="icon-xs ml-1" /></Link>
              </Button>
            </div>
            <div className="space-y-0.5">
              {atividadesRecentes.map((item: any) => {
                const ActivityIcon = item.icon === 'calendar' ? CalendarDays : item.icon === 'clipboard' ? ClipboardList : item.icon === 'align' ? AlignCenter : UserPlus;
                return (
                  <button
                    type="button"
                    key={item.id}
                    className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                    onClick={() => item.pacienteId && navigate(`/pacientes/${item.pacienteId}`)}
                  >
                    <div className="h-8 w-8 rounded-lg bg-muted/70 flex items-center justify-center shrink-0">
                      <ActivityIcon className="icon-sm text-foreground/70" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{item.pacienteNome}</div>
                      <div className="text-caption truncate">{item.description}</div>
                    </div>
                    <div className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                      {formatDistanceToNow(parseISO(item.timestamp), { addSuffix: true, locale: ptBR })}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Estatísticas Gerais */}
        {statsData && (
          <section className="rounded-xl border border-border/40 bg-card p-4 sm:p-5 mb-6">
            <div className="mb-5">
              <h2 className="h-section">Estatísticas gerais</h2>
              <p className="text-caption mt-0.5">Visão consolidada dos últimos 30 dias</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-5">
              {[
                { label: 'Avaliações MyID', value: statsData.totalAvalIdentidade },
                { label: 'Avaliações presenciais', value: statsData.totalAvalPresenciais },
                { label: 'Diretrizes ativas', value: statsData.protocolosAtivos },
                { label: 'Sessões (30d)', value: statsData.sessoes30d },
                { label: 'Taxa de presença', value: `${statsData.taxaPresenca}%` },
              ].map(s => (
                <div key={s.label} className="rounded-lg border border-border/40 bg-background p-3">
                  <div className="text-micro mb-1.5">{s.label}</div>
                  <div className="text-xl font-semibold text-foreground tracking-tight">{s.value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {[
                { count: statsData.totalConcluidos, label: 'Concluídos', icon: CheckCircle2, color: 'text-emerald-600' },
                { count: statsData.totalFaltas, label: 'Faltas', icon: UserX, color: 'text-destructive' },
                { count: statsData.totalCancelados, label: 'Cancelados', icon: XCircle, color: 'text-muted-foreground' },
              ].map(s => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-muted/40">
                    <Icon className={`icon-sm ${s.color}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">{s.count}</div>
                      <div className="text-[10px] text-muted-foreground">{s.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Amostra Clínica Populacional */}
        {amostraClinica && (
          <section className="rounded-xl border border-border/40 bg-card p-4 sm:p-5 mb-6">
            <div className="mb-5">
              <h2 className="h-section">Amostra clínica populacional</h2>
              <p className="text-caption mt-0.5">
                Média geral de {amostraClinica.n} avaliações MyID · Todos os pacientes
              </p>
            </div>

            <Tabs defaultValue="scores" className="w-full">
              <TabsList className="grid grid-cols-5 mb-4">
                <TabsTrigger value="scores" className="text-[10px] sm:text-xs">Scores</TabsTrigger>
                <TabsTrigger value="dor" className="text-[10px] sm:text-xs">Dor & Corpo</TabsTrigger>
                <TabsTrigger value="regulacao" className="text-[10px] sm:text-xs">Regulação</TabsTrigger>
                <TabsTrigger value="comorbidades" className="text-[10px] sm:text-xs">Comorbidades</TabsTrigger>
                <TabsTrigger value="tecidos" className="text-[10px] sm:text-xs">Tecidos</TabsTrigger>
              </TabsList>

              {/* TAB: Scores biopsicossociais */}
              <TabsContent value="scores">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  {[
                    { label: 'Dor (D)', value: amostraClinica.scores.D, icon: Heart, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30' },
                    { label: 'Função (EFI)', value: amostraClinica.scores.EFI, icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
                    { label: 'Regulação (R)', value: amostraClinica.scores.R, icon: Activity, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-950/30' },
                    { label: 'Contexto (C)', value: amostraClinica.scores.C, icon: Shield, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
                    { label: 'Comportamento (P)', value: amostraClinica.scores.P, icon: Brain, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30' },
                    { label: 'Inércia (I)', value: amostraClinica.scores.I, icon: Zap, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
                    { label: 'Ruído (N)', value: amostraClinica.scores.N, icon: Bone, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
                    { label: 'MyID-100', value: amostraClinica.scores.MyID, icon: Gauge, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950/30', isMyID: true },
                  ].map(s => {
                    const Icon = s.icon;
                    const isMyID = (s as any).isMyID;
                    return (
                      <div key={s.label} className={`rounded-xl p-3 ${s.bg}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className={`icon-sm ${s.color}`} />
                          <span className="text-[10px] font-medium text-muted-foreground">{s.label}</span>
                        </div>
                        <div className={`text-xl font-black ${s.color}`}>{s.value.toFixed(1)}</div>
                        <Progress value={isMyID ? s.value : s.value * 10} className="h-1.5 mt-1" />
                      </div>
                    );
                  })}
                  {/* V2 Sub-dimensions */}
                  {(amostraClinica.scores.AF > 0 || amostraClinica.scores.HID > 0 || amostraClinica.scores.NUT > 0 || amostraClinica.scores.ERG > 0) && (
                    <div className="col-span-2 sm:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Atividade Física (AF)', value: amostraClinica.scores.AF, color: 'text-orange-600' },
                        { label: 'Hidratação (HID)', value: amostraClinica.scores.HID, color: 'text-cyan-600' },
                        { label: 'Nutrição (NUT)', value: amostraClinica.scores.NUT, color: 'text-lime-600' },
                        { label: 'Ergonomia (ERG)', value: amostraClinica.scores.ERG, color: 'text-slate-600' },
                      ].filter(s => s.value > 0).map(s => (
                        <div key={s.label} className="rounded-xl border bg-card p-3">
                          <div className="text-[10px] font-medium text-muted-foreground mb-1">{s.label}</div>
                          <div className={`text-lg font-black ${s.color}`}>{s.value.toFixed(1)}</div>
                          <Progress value={s.value * 10} className="h-1.5 mt-1" />
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Card Red Flags Epidemiologia */}
                  <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 col-span-2 sm:col-span-4 border border-red-100/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
                        <Shield className="h-4 w-4 text-red-600" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-red-900">Incidência de Alertas Críticos (Red Flags)</div>
                        <div className="text-[10px] text-red-700/70">Proporção da amostra com perímetro de alerta acionado</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-red-700">{amostraClinica.percentRedFlags}%</div>
                      <div className="text-[10px] text-red-600/60">{amostraClinica.totalRedFlags} pacientes</div>
                    </div>
                  </div>
                </div>
                {/* Classificações + Funcionalidade */}
                <div className="grid md:grid-cols-2 gap-5">
                  {amostraClinica.topClassificacoes.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <ClipboardList className="icon-sm" /> Classificações
                      </h3>
                      <div className="space-y-2">
                        {amostraClinica.topClassificacoes.map(cl => (
                          <div key={cl.nome} className="flex items-center gap-3">
                            <span className="text-xs font-medium text-foreground w-24 truncate">{cl.nome}</span>
                            <div className="flex-1"><Progress value={cl.pct} className="h-2" /></div>
                            <span className="text-xs font-bold text-muted-foreground w-14 text-right">{cl.count} ({cl.pct}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Zap className="icon-sm" /> Funcionalidade Média (EFI)
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(amostraClinica.funcMedia).map(([k, v]) => (
                        <div key={k} className="flex items-center gap-3">
                          <span className="text-xs font-medium text-foreground w-24">{k}</span>
                          <div className="flex-1"><Progress value={Number(v) * 10} className="h-2" /></div>
                          <span className="text-xs font-bold text-emerald-600 w-10 text-right">{Number(v).toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* TAB: Dor & Corpo */}
              <TabsContent value="dor">
                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <MapPin className="icon-sm" /> Regiões de Dor Mais Frequentes
                    </h3>
                    {amostraClinica.topRegioes.length > 0 ? (
                      <div className="space-y-2.5">
                        {amostraClinica.topRegioes.map(r => (
                          <div key={r.nome}>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs font-medium text-foreground truncate max-w-[60%]">{r.nome}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {r.count}x · Intensidade média: <span className="font-bold text-red-600">{r.mediaIntensidade.toFixed(1)}</span>
                              </span>
                            </div>
                            <Progress value={r.pct} className="h-2" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sem dados de regiões de dor ainda.</p>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Bone className="icon-sm" /> Unidades Corporais Comprometidas
                    </h3>
                    {amostraClinica.topUnidades.length > 0 ? (
                      <div className="space-y-2.5">
                        {amostraClinica.topUnidades.map(u => (
                          <div key={u.nomeCompleto}>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs font-medium text-foreground truncate max-w-[60%]">{u.nome}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {u.count}x · Score médio: <span className="font-bold text-blue-600">{u.mediaScore.toFixed(1)}</span>
                              </span>
                            </div>
                            <Progress value={u.pct} className="h-2" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sem dados de unidades corporais ainda.</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* TAB: Regulação */}
              <TabsContent value="regulacao">
                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <BedDouble className="icon-sm" /> Sub-Scores de Regulação (Média)
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(amostraClinica.regMedia).map(([k, v]) => (
                        <div key={k} className="rounded-xl border bg-card p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-medium text-foreground">{k}</span>
                            <span className="text-lg font-black text-teal-600">{Number(v).toFixed(1)}</span>
                          </div>
                          <Progress value={Number(v) * 10} className="h-2" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Dumbbell className="icon-sm" /> Nível de Atividade Física
                    </h3>
                    {amostraClinica.topAtividade.length > 0 ? (
                      <div className="space-y-2">
                        {amostraClinica.topAtividade.map(a => (
                          <div key={a.nome} className="flex items-center gap-3">
                            <span className="text-xs font-medium text-foreground w-24 capitalize">{a.nome}</span>
                            <div className="flex-1"><Progress value={a.pct} className="h-2" /></div>
                            <span className="text-xs font-bold text-muted-foreground w-14 text-right">{a.count} ({a.pct}%)</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sem dados de atividade física.</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* TAB: Comorbidades */}
              <TabsContent value="comorbidades">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Stethoscope className="icon-sm" /> Comorbidades Mais Prevalentes
                </h3>
                {amostraClinica.topComorbidades.length > 0 ? (
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                    {amostraClinica.topComorbidades.map(c => (
                      <div key={c.nome} className="flex items-center gap-3">
                        <span className="text-xs font-medium text-foreground w-36 truncate">{c.nome}</span>
                        <div className="flex-1"><Progress value={c.pct} className="h-2" /></div>
                        <span className="text-xs font-bold text-muted-foreground w-14 text-right">{c.count} ({c.pct}%)</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhuma comorbidade registrada ainda.</p>
                )}
              </TabsContent>

              {/* TAB: Tecidos */}
              <TabsContent value="tecidos">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Activity className="icon-sm" /> Moduladores Teciduais (Média por UC)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {Object.entries(amostraClinica.tecidosMedia).map(([nome, valor]) => (
                    <div key={nome} className="rounded-xl border bg-card p-3 text-center">
                      <div className="text-[10px] font-medium text-muted-foreground mb-1">{nome}</div>
                      <div className="text-xl font-black text-foreground">{Number(valor).toFixed(1)}</div>
                      <Progress value={Number(valor) * 10} className="h-1.5 mt-1.5" />
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </section>
        )}

        </>
        )}

      </div>

      {/* NPS Dashboard */}
      <div className="container max-w-6xl px-1 sm:px-6 pb-6">
        <NpsSurveyCard showDashboard />
      </div>

      {/* FAB removed — actions available via sidebar/module cards */}
      </PageTransition>
    </AppLayout>
  );
}
