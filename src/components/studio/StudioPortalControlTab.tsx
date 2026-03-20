import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Eye, Trophy, Star, Flame, Target, Lightbulb,
  CheckCircle2, Moon, Droplets, Apple, Dumbbell,
  Monitor, Brain, Shield, Zap, Heart, AlertTriangle,
  ChevronDown, ChevronUp, Sparkles, ArrowRight, Clock,
  CalendarDays, BarChart3, Play, Bell, AlertCircle
} from 'lucide-react';
import { subDays, format, parseISO, isToday, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { calcularPerdaDimensao } from '@/utils/myid/lossTable';
import { gerarInsightsClinicosMyID } from '@/utils/myid/clinicalInsights';
import MyIDDicasPessoais from '@/components/myid/MyIDDicasPessoais';

interface Props {
  pacienteId: string;
  pacienteNome: string;
}

// ── XP / Gamification (same logic as patient portal) ──────────────────────
function calcXP(stats: { avaliacoes: number; consultas: number; diarios: number }) {
  return stats.avaliacoes * 50 + stats.consultas * 30 + stats.diarios * 10;
}
function getLevel(xp: number) {
  if (xp >= 500) return { label: 'Ouro', color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30', icon: Trophy, next: null };
  if (xp >= 250) return { label: 'Prata', color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-900/30', icon: Star, next: 500 };
  if (xp >= 100) return { label: 'Bronze', color: 'text-amber-700', bg: 'bg-amber-100 dark:bg-amber-900/30', icon: Flame, next: 250 };
  return { label: 'Iniciante', color: 'text-primary', bg: 'bg-primary/10', icon: Star, next: 100 };
}

// ── Mission generator (same as PacienteMetasDesafios) ─────────────────────
function gerarMissoesSaude(scores: any) {
  if (!scores) return [];
  const missoes: any[] = [];

  const dims = [
    { key: 'R', inv: true, icon: Moon, titulo: 'Melhorar o Sono', thresh: 3, xp: 20, cat: 'importante', color: 'indigo' },
    { key: 'HID', inv: true, icon: Droplets, titulo: 'Beber mais Água', thresh: 2, xp: 10, cat: 'importante', color: 'sky' },
    { key: 'AF', inv: true, icon: Dumbbell, titulo: 'Mais Movimento', thresh: 3, xp: 15, cat: 'oportunidade', color: 'emerald' },
    { key: 'NUT', inv: true, icon: Apple, titulo: 'Ajustar Nutrição', thresh: 2, xp: 10, cat: 'oportunidade', color: 'green' },
    { key: 'P', inv: false, icon: Brain, titulo: 'Reduzir Ansiedade', thresh: 3, xp: 15, cat: 'urgente', color: 'purple' },
    { key: 'ERG', inv: true, icon: Monitor, titulo: 'Ajustar Ergonomia', thresh: 2, xp: 10, cat: 'oportunidade', color: 'violet' },
    { key: 'I', inv: false, icon: Zap, titulo: 'Vencer a Inércia', thresh: 2, xp: 15, cat: 'oportunidade', color: 'orange' },
    { key: 'D', inv: false, icon: AlertTriangle, titulo: 'Manejo da Dor', thresh: 8, xp: 20, cat: 'urgente', color: 'red' },
    { key: 'C', inv: true, icon: Heart, titulo: 'Melhorar Contexto', thresh: 4, xp: 10, cat: 'importante', color: 'indigo' },
    { key: 'N', inv: false, icon: Shield, titulo: 'Ruído Sistêmico', thresh: 2, xp: 10, cat: 'importante', color: 'slate' },
  ];

  dims.forEach(d => {
    const raw = d.inv ? 10 - (scores[d.key] ?? 5) : (scores[d.key] ?? 0);
    const perda = calcularPerdaDimensao(d.key, raw);
    if (perda.perda_pontos >= d.thresh) {
      missoes.push({
        id: `missao-${d.key}`, icon: d.icon, titulo: d.titulo,
        lossPoints: perda.perda_pontos, xp: d.xp,
        categoria: perda.gatilho_critico ? 'urgente' : d.cat,
        colorClass: `text-${d.color}-700 dark:text-${d.color}-400`,
        bgClass: `bg-${d.color}-50 dark:bg-${d.color}-950/30`,
      });
    }
  });

  // Positives
  ['R', 'AF', 'C'].forEach(key => {
    const raw = ['R', 'AF', 'C'].includes(key) ? 10 - (scores[key] ?? 5) : scores[key] ?? 0;
    const perda = calcularPerdaDimensao(key, raw);
    if (perda.perda_pontos === 0) {
      const label = key === 'R' ? 'Sono Excelente' : key === 'AF' ? 'Atividade Forte' : 'Suporte Social Forte';
      missoes.push({
        id: `forca-${key}`, icon: key === 'R' ? Moon : key === 'AF' ? Dumbbell : Heart,
        titulo: `✅ ${label}`, lossPoints: 0, xp: 5, categoria: 'positivo',
        colorClass: 'text-emerald-700 dark:text-emerald-400',
        bgClass: 'bg-emerald-50 dark:bg-emerald-950/30',
      });
    }
  });

  const order: Record<string, number> = { urgente: 0, importante: 1, oportunidade: 2, positivo: 3 };
  missoes.sort((a: any, b: any) => order[a.categoria] - order[b.categoria] || b.lossPoints - a.lossPoints);
  return missoes;
}

const catLabel: Record<string, string> = {
  urgente: '⚠️ Urgente', importante: '📌 Importante', oportunidade: '💡 Oportunidade', positivo: '💪 Ponto Forte',
};

export default function StudioPortalControlTab({ pacienteId, pacienteNome }: Props) {
  const { user } = useAuth();
  const [showMissoes, setShowMissoes] = useState(true);
  const [showDicas, setShowDicas] = useState(false);
  const [showFases, setShowFases] = useState(false);
  const [showTreinos, setShowTreinos] = useState(true);
  const [showAlertas, setShowAlertas] = useState(true);

  // ── Patient engagement stats ────────────────────────────────────────
  const { data: engagementStats } = useQuery({
    queryKey: ['portal-control-stats', pacienteId],
    queryFn: async () => {
      const weekAgo = subDays(new Date(), 7).toISOString();
      const [avalRes, sessaoRes, diarioRes, diarioWeekRes, streakRes] = await Promise.all([
        supabase.from('avaliacoes_identidade').select('id', { count: 'exact', head: true }).eq('paciente_id', pacienteId),
        supabase.from('controle_sessoes').select('id', { count: 'exact', head: true }).eq('paciente_id', pacienteId).eq('status', 'realizada'),
        supabase.from('daily_logs').select('id', { count: 'exact', head: true }).eq('paciente_id', pacienteId),
        supabase.from('daily_logs').select('id', { count: 'exact', head: true }).eq('paciente_id', pacienteId).gte('created_at', weekAgo),
        supabase.from('daily_logs').select('created_at').eq('paciente_id', pacienteId).order('created_at', { ascending: false }).limit(30),
      ]);

      let streak = 0;
      const logs = streakRes.data || [];
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const d = subDays(today, i).toISOString().split('T')[0];
        if (logs.some((l: any) => l.created_at.startsWith(d))) streak++;
        else if (i > 0) break;
      }

      const stats = {
        avaliacoes: avalRes.count || 0,
        consultas: sessaoRes.count || 0,
        diarios: diarioRes.count || 0,
        diariosEstaSemana: diarioWeekRes.count || 0,
        streak,
      };
      return stats;
    },
    enabled: !!pacienteId,
  });

  const xp = calcXP(engagementStats || { avaliacoes: 0, consultas: 0, diarios: 0 });
  const level = getLevel(xp);
  const LevelIcon = level.icon;

  // ── MyID scores for missions/tips ───────────────────────────────────
  const { data: myidData } = useQuery({
    queryKey: ['portal-control-myid', pacienteId],
    queryFn: async () => {
      const { data: av } = await supabase
        .from('avaliacoes_identidade')
        .select('myid_score, myid_analysis, score_d, score_efi, score_p, score_i, score_r, score_c, score_n')
        .eq('paciente_id', pacienteId)
        .not('myid_score', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (av?.[0]) {
        const a = av[0];
        const analysis = a.myid_analysis as any;
        const cs = analysis?.componentScores || analysis?.component_scores || {};
        return {
          scores: {
            D: cs.D ?? (Number(a.score_d) || 0), EFI: cs.EFI ?? (Number(a.score_efi) || 0),
            P: cs.P ?? (Number(a.score_p) || 0), I: cs.I ?? (Number(a.score_i) || 0),
            R: cs.R ?? (Number(a.score_r) || 0), C: cs.C ?? (Number(a.score_c) || 0),
            AF: cs.AF ?? 5, HID: cs.HID ?? 5, NUT: cs.NUT ?? 5, ERG: cs.ERG ?? 5,
            N: cs.N ?? (Number(a.score_n) || 0),
          },
          myidScore: Number(a.myid_score) || 0,
        };
      }

      // Fallback to myid_avaliacoes
      const { data: myidAv } = await supabase
        .from('myid_avaliacoes')
        .select('resultado_processado')
        .eq('paciente_id', pacienteId)
        .eq('status', 'concluido')
        .order('created_at', { ascending: false })
        .limit(1);

      if (myidAv?.[0]?.resultado_processado) {
        const rp = myidAv[0].resultado_processado as any;
        const cs = rp?.component_scores;
        if (cs) return {
          scores: { D: cs.D ?? 0, EFI: cs.EFI ?? 0, P: cs.P ?? 0, I: cs.I ?? 0, R: cs.R ?? 0, C: cs.C ?? 0, AF: cs.AF ?? 5, HID: cs.HID ?? 5, NUT: cs.NUT ?? 5, ERG: cs.ERG ?? 5, N: cs.N ?? 0 },
          myidScore: rp?.myid_100 ?? rp?.MyID_score ?? 0,
        };
      }
      return null;
    },
    enabled: !!pacienteId,
  });

  const missoes = useMemo(() => gerarMissoesSaude(myidData?.scores), [myidData]);
  const insights = useMemo(
    () => myidData?.scores && myidData.myidScore ? gerarInsightsClinicosMyID(myidData.scores, myidData.myidScore) : null,
    [myidData],
  );

  const missoesConcluiveis = missoes.filter((m: any) => m.categoria !== 'positivo');
  const missoesPositivas = missoes.filter((m: any) => m.categoria === 'positivo');

  // ── Treinos & Execuções ─────────────────────────────────────────────
  const { data: treinosData } = useQuery({
    queryKey: ['portal-control-treinos', pacienteId],
    queryFn: async () => {
      const weekAgo = subDays(new Date(), 7).toISOString();
      const [treinosRes, execRes] = await Promise.all([
        (supabase as any).from('studio_treinos').select('id, titulo, duracao_estimada, intensidade, frequencia, publicado').eq('paciente_id', pacienteId).eq('terapeuta_id', user!.id).eq('ativo', true).order('ordem'),
        (supabase as any).from('studio_execucoes').select('treino_id, data_execucao, completo, nota_dor, feedback_aluno').eq('paciente_id', pacienteId).eq('terapeuta_id', user!.id).order('data_execucao', { ascending: false }).limit(50),
      ]);
      return { treinos: treinosRes.data || [], execucoes: execRes.data || [] };
    },
    enabled: !!user && !!pacienteId,
  });

  // ── Alertas do Paciente (espelha PacienteAlertasLembretes) ──────────
  const { data: alertasData } = useQuery({
    queryKey: ['portal-control-alertas', pacienteId],
    queryFn: async () => {
      const now = new Date();
      const alerts: { id: string; tipo: string; titulo: string; descricao: string; urgencia: string }[] = [];

      // Próxima consulta nas próximas 48h
      const { data: proxConsultas } = await supabase
        .from('agendamentos')
        .select('id, data_inicio, titulo, tipo_atendimento, status')
        .eq('paciente_id', pacienteId)
        .gte('data_inicio', now.toISOString())
        .in('status', ['confirmado', 'pendente'])
        .order('data_inicio', { ascending: true })
        .limit(3);

      proxConsultas?.forEach(c => {
        const horasAte = differenceInHours(parseISO(c.data_inicio), now);
        if (horasAte <= 48) {
          alerts.push({
            id: `consulta-${c.id}`, tipo: 'consulta',
            titulo: horasAte <= 2 ? '⏰ Consulta em breve!' : '📅 Consulta próxima',
            descricao: `${c.titulo || c.tipo_atendimento || 'Consulta'} — ${format(parseISO(c.data_inicio), "EEEE, HH:mm", { locale: ptBR })}`,
            urgencia: horasAte <= 2 ? 'alta' : horasAte <= 24 ? 'media' : 'baixa',
          });
        }
      });

      // Diário não preenchido hoje
      const { count: diarioHoje } = await supabase
        .from('daily_logs')
        .select('id', { count: 'exact', head: true })
        .eq('paciente_id', pacienteId)
        .gte('created_at', new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString());

      if (!diarioHoje || diarioHoje === 0) {
        alerts.push({
          id: 'diario-hoje', tipo: 'diario',
          titulo: '💊 Registre seu dia',
          descricao: 'Diário de saúde não preenchido hoje.',
          urgencia: now.getHours() >= 18 ? 'media' : 'baixa',
        });
      }

      // Questionários pendentes
      const { count: pendentes } = await supabase
        .from('myid_avaliacoes')
        .select('id', { count: 'exact', head: true })
        .eq('paciente_id', pacienteId)
        .neq('status', 'concluido');

      if (pendentes && pendentes > 0) {
        alerts.push({
          id: 'quest-pendente', tipo: 'questionario',
          titulo: '📋 Questionário pendente',
          descricao: `${pendentes} questionário(s) aguardando resposta`,
          urgencia: 'media',
        });
      }

      const urgOrder: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
      alerts.sort((a, b) => (urgOrder[a.urgencia] ?? 2) - (urgOrder[b.urgencia] ?? 2));
      return alerts;
    },
    enabled: !!pacienteId,
  });

  const treinos = treinosData?.treinos || [];
  const execucoes = treinosData?.execucoes || [];
  const weekAgo = subDays(new Date(), 7);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <Eye className="h-4 w-4 text-studio" />
        <h3 className="font-bold text-sm text-foreground">Portal do Cliente</h3>
        <Badge variant="outline" className="text-[9px] ml-auto">Visão do Terapeuta</Badge>
      </div>

      {/* ── Gamification Status ──────────────────────────────────────── */}
      <Card className="overflow-hidden border-0 shadow-md"
        style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(213 55% 28%) 100%)' }}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-bold text-primary-foreground">Engajamento de {pacienteNome}</h4>
              <p className="text-[10px] text-primary-foreground/50">O que o paciente vê no portal</p>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-sm">
              <LevelIcon className="h-3 w-3 text-primary-foreground" />
              <span className="text-[10px] font-bold text-primary-foreground">{level.label}</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { label: 'XP Total', value: xp },
              { label: 'Avaliações', value: engagementStats?.avaliacoes ?? 0 },
              { label: 'Sessões', value: engagementStats?.consultas ?? 0 },
              { label: 'Diários', value: engagementStats?.diarios ?? 0 },
            ].map(s => (
              <div key={s.label} className="text-center px-1 py-1.5 rounded-lg bg-white/10">
                <div className="text-sm font-black text-primary-foreground">{s.value}</div>
                <div className="text-[8px] text-primary-foreground/50">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {level.next && (
              <div className="flex-1 space-y-0.5">
                <div className="flex justify-between text-[9px] text-primary-foreground/50">
                  <span>{xp} XP</span><span>{level.next} XP</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (xp / level.next) * 100)}%`, transition: 'width 0.6s' }} />
                </div>
              </div>
            )}
            {(engagementStats?.streak ?? 0) > 1 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 shrink-0">
                <span className="text-xs">🔥</span>
                <span className="text-[10px] font-bold text-primary-foreground">{engagementStats?.streak}d streak</span>
              </div>
            )}
            <Badge variant="outline" className="bg-white/10 border-white/20 text-primary-foreground text-[8px] h-5 shrink-0">
              {engagementStats?.diariosEstaSemana ?? 0}/7 diários esta semana
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* ── Missões de Saúde (visão read-only do terapeuta) ──────────── */}
      {missoesConcluiveis.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowMissoes(!showMissoes)}>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-studio" />
              <h4 className="font-bold text-sm text-foreground">Missões de Saúde do Paciente</h4>
              <Badge className="text-[9px] h-4 bg-studio/10 text-studio border-0">MyID</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">{missoesConcluiveis.length} ativas</span>
              {showMissoes ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
          </div>

          {showMissoes && (
            <div className="space-y-1.5">
              {missoesConcluiveis.map((m: any) => {
                const Icon = m.icon;
                return (
                  <div key={m.id} className={cn("p-2.5 rounded-xl border flex items-start gap-2.5", m.bgClass)}>
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", m.bgClass)}>
                      <Icon className={cn("h-3.5 w-3.5", m.colorClass)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("text-xs font-bold", m.colorClass)}>{m.titulo}</span>
                        <span className={cn("text-[8px] font-black px-1.5 py-0.5 rounded-full", m.bgClass, m.colorClass)}>
                          {catLabel[m.categoria]}
                        </span>
                        <span className="text-[9px] text-destructive font-bold ml-auto">−{m.lossPoints}pts</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Positives */}
              {missoesPositivas.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {missoesPositivas.map((m: any) => (
                    <div key={m.id} className={cn("p-2 rounded-xl border", m.bgClass)}>
                      <div className="flex items-center gap-1.5">
                        <m.icon className={cn("h-3 w-3", m.colorClass)} />
                        <span className={cn("text-[10px] font-bold", m.colorClass)}>{m.titulo}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Dicas Personalizadas (componente completo do paciente) ──── */}
      {myidData?.scores && (
        <div className="space-y-2">
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowDicas(!showDicas)}>
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-studio" />
              <h4 className="font-bold text-sm text-foreground">Dicas Personalizadas (Visão Paciente)</h4>
            </div>
            {showDicas ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
          {showDicas && (
            <MyIDDicasPessoais scores={myidData.scores} myidScore={myidData.myidScore} compact={false} />
          )}
        </div>
      )}

      {/* ── Plano de Evolução por Fases ────────────────────────────────── */}
      {insights && (
        <div className="space-y-2">
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowFases(!showFases)}>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-studio" />
              <h4 className="font-bold text-sm text-foreground">Plano de Evolução por Fases</h4>
              {insights.driverInsight && (
                <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                  Driver: {insights.driverInsight.driverLabel} (−{insights.driverInsight.perda}pts)
                </Badge>
              )}
            </div>
            {showFases ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>

          {showFases && (
            <div className="space-y-2">
              {insights.driverInsight && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[11px] font-bold text-primary">
                        Prioridade: {insights.driverInsight.driverLabel} (−{insights.driverInsight.perda}pts)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {insights.driverInsight.intervencoes.slice(0, 3).map((i: string, idx: number) => (
                        <span key={idx} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{i}</span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {insights.fases.map((fase: any) => (
                <Card key={fase.fase} className="border-border">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm">{fase.icone}</span>
                      <span className="text-xs font-bold text-foreground">Fase {fase.fase}: {fase.titulo}</span>
                      <span className="text-[10px] text-muted-foreground">({fase.semanas})</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-1.5">{fase.foco}</p>
                    <div className="flex flex-wrap gap-1">
                      {fase.intervencoes.slice(0, 4).map((interv: string, idx: number) => (
                        <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border text-foreground/70 flex items-center gap-1">
                          <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />{interv}
                        </span>
                      ))}
                    </div>
                    <div className="mt-1.5 pt-1.5 border-t border-border/50">
                      <span className="text-[10px] font-bold text-primary">{fase.metaMyID}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Treinos & Execuções do Paciente ────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowTreinos(!showTreinos)}>
          <div className="flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-studio" />
            <h4 className="font-bold text-sm text-foreground">Treinos & Aderência</h4>
            <Badge variant="outline" className="text-[9px]">{treinos.filter((t: any) => t.publicado).length} publicados</Badge>
          </div>
          {showTreinos ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>

        {showTreinos && (
          <div className="space-y-2">
            {treinos.length === 0 ? (
              <Card className="border-dashed"><CardContent className="p-6 text-center text-sm text-muted-foreground">Nenhum treino criado</CardContent></Card>
            ) : (
              treinos.map((treino: any) => {
                const weekExecs = execucoes.filter((e: any) => e.treino_id === treino.id && e.completo && new Date(e.data_execucao) >= weekAgo);
                const recentExecs = execucoes.filter((e: any) => e.treino_id === treino.id).slice(0, 5);
                const target = parseInt(treino.frequencia?.match(/\d+/)?.[0] || '3');
                const progress = Math.min(100, (weekExecs.length / target) * 100);

                return (
                  <Card key={treino.id} className={cn(!treino.publicado && 'opacity-50')}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gradient-studio flex items-center justify-center shrink-0">
                          <Dumbbell className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground truncate">{treino.titulo}</span>
                            {treino.publicado && <Badge className="text-[8px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">Publicado</Badge>}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <Clock className="h-2.5 w-2.5" /> {treino.duracao_estimada}
                            <span>•</span> {treino.intensidade}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-black text-foreground">{weekExecs.length}/{target}</span>
                          <p className="text-[8px] text-muted-foreground">esta semana</p>
                        </div>
                      </div>

                      <Progress value={progress} className="h-1.5" />

                      {/* Recent executions with patient feedback */}
                      {recentExecs.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Últimas execuções</span>
                          {recentExecs.map((ex: any) => (
                            <div key={ex.data_execucao} className="flex items-center gap-2 text-[10px] py-1 border-b border-border/50 last:border-0">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                              <span className="text-foreground font-medium">
                                {ex.data_execucao ? (isToday(parseISO(ex.data_execucao)) ? 'Hoje' : format(parseISO(ex.data_execucao), "d MMM", { locale: ptBR })) : '—'}
                              </span>
                              {ex.nota_dor != null && (
                                <Badge variant="outline" className={cn("text-[8px] py-0 h-3.5", ex.nota_dor > 5 ? 'border-destructive text-destructive' : 'text-muted-foreground')}>
                                  Dor: {ex.nota_dor}/10
                                </Badge>
                              )}
                              {ex.feedback_aluno && (
                                <span className="text-muted-foreground truncate flex-1 italic">"{ex.feedback_aluno}"</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Empty state if no MyID data */}
      {!myidData && missoes.length === 0 && treinos.length === 0 && (
        <Card className="border-dashed border-2 border-studio/20">
          <CardContent className="py-10 text-center">
            <Eye className="h-10 w-10 mx-auto mb-3 text-studio/30" />
            <p className="font-semibold text-foreground">Portal sem dados</p>
            <p className="text-sm text-muted-foreground mt-1">
              Complete uma avaliação MyID e crie treinos para visualizar o portal do paciente aqui.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
