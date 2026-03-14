import { Link, Navigate, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useState, useRef, useEffect } from 'react';
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
import AmostraIntegrada from '@/components/dashboard/AmostraIntegrada';
import { format, parseISO, startOfDay, endOfDay, formatDistanceToNow, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageTransition, StaggerContainer, StaggerItem, FadeIn } from '@/components/PageTransition';
import { DashboardSkeleton } from '@/components/ui/skeleton-card';

export default function Index() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

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

  const { data: avaliacoesRaw = [] } = useQuery({
    queryKey: ['avaliacoes-raw-epidemio', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('avaliacoes_identidade')
        .select('score_e, score_p, score_c, score_f, score_d, score_r, score_efi, id_final, dados_avaliacao, classificacao, paciente_id, created_at, red_flags, pacientes(nome, sobrenome)')
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: true });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: avaliacoesCobZero = [] } = useQuery({
    queryKey: ['avaliacoes-cob-zero-epidemio', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('avaliacoes_cob_zero')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: true });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: medidasStudio = [] } = useQuery({
    queryKey: ['studio-medidas-epidemio', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('studio_medidas')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .order('data_medida', { ascending: true });
      return data || [];
    },
    enabled: !!user,
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
      const scores = {
        E: avg('score_e'), P: avg('score_p'), C: avg('score_c'),
        F: avg('score_f'), D: avg('score_d'), R: avg('score_r'),
        EFI: avg('score_efi'), ID: avg('id_final'),
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
      const [agResult, avalIdResult, avalCobResult, pacResult] = await Promise.all([
        supabase.from('agendamentos').select('id, data_inicio, status, tipo_atendimento, created_at, pacientes(id, nome, sobrenome)').eq('terapeuta_id', user!.id).gte('created_at', sevenDaysAgo).order('created_at', { ascending: false }).limit(5),
        supabase.from('avaliacoes_identidade').select('id, created_at, classificacao, paciente_id, pacientes(id, nome, sobrenome)').eq('terapeuta_id', user!.id).gte('created_at', sevenDaysAgo).order('created_at', { ascending: false }).limit(5),
        supabase.from('avaliacoes_cob_zero').select('id, created_at, paciente_id, pacientes(id, nome, sobrenome)').eq('terapeuta_id', user!.id).gte('created_at', sevenDaysAgo).order('created_at', { ascending: false }).limit(5),
        supabase.from('pacientes').select('id, nome, sobrenome, created_at').eq('terapeuta_id', user!.id).gte('created_at', sevenDaysAgo).order('created_at', { ascending: false }).limit(5),
      ]);
      type ActivityItem = { id: string; type: 'agendamento' | 'avaliacao_id' | 'avaliacao_cob' | 'novo_paciente'; description: string; pacienteNome: string; pacienteId?: string; timestamp: string; icon: 'calendar' | 'clipboard' | 'align' | 'user-plus' };
      const items: ActivityItem[] = [];
      (agResult.data || []).forEach((a: any) => items.push({ id: `ag-${a.id}`, type: 'agendamento', description: `${a.tipo_atendimento || 'Consulta'} ${a.status === 'concluido' ? 'concluída' : a.status === 'cancelado' ? 'cancelada' : 'agendada'}`, pacienteNome: a.pacientes ? `${a.pacientes.nome} ${a.pacientes.sobrenome}` : 'Paciente', pacienteId: a.pacientes?.id, timestamp: a.created_at, icon: 'calendar' }));
      (avalIdResult.data || []).forEach((a: any) => items.push({ id: `avi-${a.id}`, type: 'avaliacao_id', description: `Avaliação Identidade${a.classificacao ? ` — ${a.classificacao}` : ''} concluída`, pacienteNome: a.pacientes ? `${a.pacientes.nome} ${a.pacientes.sobrenome}` : 'Paciente', pacienteId: a.paciente_id, timestamp: a.created_at, icon: 'clipboard' }));
      (avalCobResult.data || []).forEach((a: any) => items.push({ id: `avc-${a.id}`, type: 'avaliacao_cob', description: 'Avaliação COB° concluída', pacienteNome: a.pacientes ? `${a.pacientes.nome} ${a.pacientes.sobrenome}` : 'Paciente', pacienteId: a.paciente_id, timestamp: a.created_at, icon: 'align' }));
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

      const link = `${window.location.origin}/myid/responder/${token}`;
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

  const metodoIdentidadePacientes = pacienteServicos.filter(s => s.servico === 'metodo_identidade').length;
  const cobZeroPacientes = pacienteServicos.filter(s => s.servico === 'cob_zero').length;
  const studioPacientes = pacienteServicos.filter(s => s.servico === 'studio_personal_id').length;

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
      <div className="container py-4 sm:py-8 max-w-6xl px-1 sm:px-6">
        {/* Welcome header */}
        <FadeIn>
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-black text-foreground">
            {saudacao}, {profile?.nome || 'Terapeuta'}! 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        </FadeIn>

        {/* Quick stats */}
        <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Pacientes Totais', value: pacientes.length, icon: Users, color: 'text-primary' },
            { label: 'Atendimentos Hoje', value: agendamentosHoje.length, icon: CalendarDays, color: 'text-emerald-600' },
            { label: 'Avaliações Pendentes', value: avaliacoesPendentes.length, icon: ClipboardList, color: 'text-amber-600' },
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
          {/* Próximo Atendimento — enriched */}
          <div
            className={`clinical-card text-center p-4 ${proximoAtendimento ? 'cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all' : ''}`}
            onClick={() => proximoAtendimento?.pacientes && navigate(`/pacientes/${(proximoAtendimento as any).pacientes.id}`)}
          >
            <Clock className="h-6 w-6 mx-auto mb-2 text-blue-600" />
            <div className="text-2xl font-black text-foreground">
              {proximoAtendimento ? format(parseISO(proximoAtendimento.data_inicio), 'HH:mm') : '—'}
            </div>
            {proximoAtendimento?.pacientes ? (
              <div className="text-xs text-blue-600 font-semibold mt-1 truncate">
                {(proximoAtendimento as any).pacientes.nome} {(proximoAtendimento as any).pacientes.sobrenome}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground mt-1 leading-tight">Próximo Atendimento</div>
            )}
          </div>
        </StaggerContainer>

        {/* Main modules */}
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5 mb-6 sm:mb-8">
          {/* Método Identidade */}
          <div className="clinical-card border-2 border-[hsl(345_55%_32%/0.2)] hover:border-[hsl(345_55%_32%/0.4)] transition-all flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-11 w-11 rounded-xl bg-gradient-identidade flex items-center justify-center shadow-lg shrink-0">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">Método Identidade</h2>
                <p className="text-xs text-muted-foreground">Radar de Valências e Alertas Clínicos</p>
              </div>
            </div>
            <div className="flex-1 space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pacientes</span>
                <span className="font-semibold text-primary">{metodoIdentidadePacientes}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Gamificação</span>
                <span className="text-muted-foreground">Fórmula e Herói Silencioso</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link to="/pacientes">Ver Pacientes</Link>
              </Button>
              <Button asChild size="sm" className="flex-1 bg-gradient-identidade text-white">
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

          {/* Studio Personal ID */}
          <div className="clinical-card border-2 border-[hsl(165_65%_32%/0.2)] hover:border-[hsl(165_65%_32%/0.4)] transition-all flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-11 w-11 rounded-2xl bg-gradient-studio flex items-center justify-center shadow-lg shrink-0">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">Studio Personal ID</h2>
                <p className="text-xs text-muted-foreground">Treinamento Personalizado</p>
              </div>
            </div>
            <div className="flex-1 space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pacientes</span>
                <span className="font-semibold text-studio">{studioPacientes}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Objetivos & Sessões</span>
                <span className="text-muted-foreground">Personalizado</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link to="/pacientes">Ver Pacientes</Link>
              </Button>
              <Button asChild size="sm" className="flex-1 bg-gradient-studio text-white hover:opacity-90">
                <Link to="/studio-personal-id">
                  Abrir <ArrowRight className="h-3.5 w-3.5 ml-1" />
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
                    <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${ag.status === 'confirmado' ? 'bg-emerald-100 text-emerald-700' :
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

        {/* Alertas Clínicos Críticos (Red Flags) */}
        {recentAlerts.length > 0 && (
          <div className="clinical-card mb-6 border-red-200/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-red-100 flex items-center justify-center shadow-sm">
                  <Shield className="h-4.5 w-4.5 text-red-600" />
                </div>
                <div>
                  <h2 className="font-bold text-red-800">Alertas Clínicos Ativos</h2>
                  <p className="text-[10px] text-red-600/80">Pacientes que acionaram Red Flags recentemente</p>
                </div>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {recentAlerts.map(alert => (
                <div key={alert.id_final || alert.created_at} className="p-3 rounded-lg border border-red-100 bg-red-50/30 flex flex-col gap-1 cursor-pointer hover:bg-red-50/60 transition-colors" onClick={() => alert.paciente_id && navigate(`/pacientes/${alert.paciente_id}`)}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-red-900 truncate">{(alert.pacientes as any)?.nome} {(alert.pacientes as any)?.sobrenome}</span>
                    <span className="text-[10px] text-red-500 font-medium">{formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ptBR })}</span>
                  </div>
                  <div className="text-[11px] text-red-700/80 font-medium">Perímetro de Alerta MyID acionado</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feed de Atividades Recentes */}
        {atividadesRecentes.length > 0 && (
          <div className="clinical-card mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-lg">
                  <Activity className="h-4.5 w-4.5 text-white" />
                </div>
                <h2 className="font-bold text-foreground">Últimas Atividades</h2>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-primary">
                <Link to="/pacientes">Ver tudo <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
              </Button>
            </div>
            <div className="space-y-1.5">
              {atividadesRecentes.map((item: any) => {
                const ActivityIcon = item.icon === 'calendar' ? CalendarDays : item.icon === 'clipboard' ? ClipboardList : item.icon === 'align' ? AlignCenter : UserPlus;
                const colorMap: Record<string, string> = { calendar: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400', clipboard: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400', align: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400', 'user-plus': 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400' };
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/10 transition-all cursor-pointer"
                    onClick={() => item.pacienteId && navigate(`/pacientes/${item.pacienteId}`)}
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${colorMap[item.icon] || 'bg-slate-100 text-slate-600'}`}>
                      <ActivityIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{item.pacienteNome}</div>
                      <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                    </div>
                    <div className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                      {formatDistanceToNow(parseISO(item.timestamp), { addSuffix: true, locale: ptBR })}
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
                { label: 'Diretrizes Totais', value: statsData.totalProtocolos, icon: FileText, color: 'text-violet-600' },
                { label: 'Diretrizes Ativas', value: statsData.protocolosAtivos, icon: TrendingUp, color: 'text-emerald-600' },
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
                    { label: 'Estrutural (E)', value: amostraClinica.scores.E, icon: Bone, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
                    { label: 'Cinesiofobia (P)', value: amostraClinica.scores.P, icon: Brain, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30' },
                    { label: 'Carga Contextual (C)', value: amostraClinica.scores.C, icon: Shield, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
                    { label: 'Contextual (F)', value: amostraClinica.scores.F, icon: Zap, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
                    { label: 'Dor (D)', value: amostraClinica.scores.D, icon: Heart, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30' },
                    { label: 'Regulação (R)', value: amostraClinica.scores.R, icon: Activity, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-950/30' },
                    { label: 'Funcionalidade (EFI)', value: amostraClinica.scores.EFI, icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
                    { label: 'Dor Identidade (ID)', value: amostraClinica.scores.ID, icon: Gauge, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950/30' },
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
                        <ClipboardList className="h-3.5 w-3.5" /> Classificações
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
                      <Zap className="h-3.5 w-3.5" /> Funcionalidade Média (EFI)
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
                      <MapPin className="h-3.5 w-3.5" /> Regiões de Dor Mais Frequentes
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
                      <Bone className="h-3.5 w-3.5" /> Unidades Corporais Comprometidas
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
                      <BedDouble className="h-3.5 w-3.5" /> Sub-Scores de Regulação (Média)
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
                      <Dumbbell className="h-3.5 w-3.5" /> Nível de Atividade Física
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
                  <Stethoscope className="h-3.5 w-3.5" /> Comorbidades Mais Prevalentes
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
                  <Activity className="h-3.5 w-3.5" /> Moduladores Teciduais (Média por UC)
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
          </div>
        )}

        {/* Análise Epidemiológica */}
        {avaliacoesRaw.length >= 2 && (
          <div className="clinical-card mb-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">Central de Inteligência Epidemiológica</h2>
                <p className="text-xs text-muted-foreground">
                  Integração Multi-Serviço (MyID, COB° ZERO, Studio) · Base Científica
                </p>
              </div>
            </div>
            <AmostraIntegrada
              avaliacoesIdentidade={avaliacoesRaw as any}
              avaliacoesCobZero={avaliacoesCobZero as any}
              medidasStudio={medidasStudio as any}
            />
          </div>
        )}

      </div>

      {/* Quick Action FAB */}
      <div ref={fabRef} className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-2">
        {isFabOpen && (
          <div className="flex flex-col gap-2 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {[
              { label: 'Novo Paciente', icon: UserPlus, to: '/pacientes', gradient: 'from-primary to-rose-500' },
              { label: 'Agendar', icon: CalendarDays, to: '/agenda', gradient: 'from-amber-500 to-orange-500' },
              { label: 'Nova Avaliação', icon: ClipboardList, to: '/metodo-identidade', gradient: 'from-emerald-500 to-teal-500' },
              { label: 'Gerar Link MyID', icon: LinkIcon, action: handleGerarLinkMyID, gradient: 'from-slate-700 to-slate-900' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-lg bg-card border shadow-lg text-xs font-medium text-foreground whitespace-nowrap">
                  {item.label}
                </span>
                {item.to ? (
                  <Link
                    to={item.to}
                    className={`h-11 w-11 rounded-full bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-lg hover:scale-110 transition-transform`}
                  >
                    <item.icon className="h-5 w-5 text-white" />
                  </Link>
                ) : (
                  <button
                    onClick={() => { item.action?.(); setIsFabOpen(false); }}
                    disabled={isGeneratingLink}
                    className={`h-11 w-11 rounded-full bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-lg hover:scale-110 transition-transform disabled:opacity-50`}
                  >
                    {isGeneratingLink ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <item.icon className="h-5 w-5 text-white" />}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => setIsFabOpen(prev => !prev)}
          className={`h-14 w-14 rounded-full bg-gradient-to-br from-primary to-rose-600 flex items-center justify-center shadow-2xl hover:scale-105 transition-all duration-200 ${isFabOpen ? 'rotate-45' : ''}`}
          aria-label="Ações rápidas"
        >
          {isFabOpen ? <X className="h-6 w-6 text-white" /> : <Plus className="h-7 w-7 text-white" />}
        </button>
      </div>
      </PageTransition>
    </AppLayout>
  );
}
