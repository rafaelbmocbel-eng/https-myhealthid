import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity, Fingerprint, AlignCenter, Dumbbell,
  TrendingUp, Brain, ChevronDown, ChevronUp, FileText,
  Sparkles, Printer, Copy, Shield, Zap, Heart, Smile,
  AlertTriangle, CheckCircle2, Target, Award, ShieldAlert
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMyIDFingerprintData, getMyIDSeverityColor, getMyIDInterpretation, generateMyIDNarrative4Lines } from '@/utils/myidCalculations';
import MyIDFingerprint from '@/components/myid/MyIDFingerprint';
import MyIDFormulaDisplay from '@/components/myid/MyIDFormulaDisplay';
import StructuralConnectionMap from '@/components/structural/StructuralConnectionMap';
import { StructuralAssessmentData, UNIT_CONFIGS, classifyScore, classifyScoreColor } from '@/types/structural';
import type { MyIDResult as MyIDResultType, FingerprintRing } from '@/types/myid';
import { Progress } from '@/components/ui/progress';
import ProtocoloScores from '@/components/protocolo/ProtocoloScores';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Area
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface PatientIntegratedDashboardProps {
  pacienteId: string;
  serviceType: 'identidade' | 'cob_zero' | 'studio';
}

// ─── Componentes Gráficos Auxiliares ──────────────────────────────────────────
const MiniGauge = ({ value, color }: { value: number; color: string }) => {
  const radius = 9;
  const circ = 2 * Math.PI * radius;
  const maxVal = Math.max(0.01, value); // fallback math
  const dashoffset = circ - (maxVal / 10) * circ;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" className="shrink-0 -rotate-90">
      <circle cx="12" cy="12" r={radius} fill="none" stroke="currentColor" strokeWidth="4" opacity="0.15" style={{ color }} />
      <circle cx="12" cy="12" r={radius} fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray={circ} strokeDashoffset={dashoffset} strokeLinecap="round" style={{ color, transition: 'stroke-dashoffset 0.6s ease-out' }} />
    </svg>
  );
};


// ── Novas Interfaces de Engajamento ───────────────────────────────────────────
interface PowerZone {
  id: string;
  title: string;
  level: number; // 0-100
  color: string;
  icon: any;
  description: string;
  factors: string[];
}

interface Mission {
  id: string;
  title: string;
  description: string;
  icon: any;
  completed: boolean;
}

export default function PatientIntegratedDashboard({
  pacienteId,
  serviceType
}: PatientIntegratedDashboardProps) {
  const { user } = useAuth();
  const [hoveredScoreKey, setHoveredScoreKey] = useState<string | null>(null);
  const [showDiretrizes, setShowDiretrizes] = useState(false);

  // ── MyID data
  const { data: myidAvaliacoes = [] } = useQuery({
    queryKey: ['integrated-myid-avaliacoes', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes_identidade')
        .select('*')
        .eq('paciente_id', pacienteId)
        .not('myid_score', 'is', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // ── MyID from myid_avaliacoes (completed via link)
  const { data: myidFromLink = [] } = useQuery({
    queryKey: ['integrated-myid-link', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('myid_avaliacoes')
        .select('*')
        .eq('paciente_id', pacienteId)
        .eq('status', 'concluido')
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return data || [];
    },
  });

  const ultimaMyID = myidAvaliacoes[0];
  const myidLinkResult = myidFromLink[0]?.resultado_processado as any;

  // Use whichever is more recent
  const hasMyID = !!ultimaMyID || !!myidLinkResult;

  // ── Service-specific data
  const { data: serviceData = [] } = useQuery({
    queryKey: ['integrated-service-data', pacienteId, serviceType],
    queryFn: async () => {
      if (serviceType === 'cob_zero') {
        const { data } = await supabase.from('avaliacoes_cob_zero').select('*')
          .eq('paciente_id', pacienteId).order('created_at', { ascending: false });
        return data || [];
      } else if (serviceType === 'studio') {
        const { data } = await supabase.from('studio_medidas').select('*')
          .eq('paciente_id', pacienteId).order('data_medida', { ascending: false });
        return data || [];
      }
      return [];
    },
  });

  // ── Structural assessment data (only for Método Identidade)
  const { data: structuralAvaliacoes = [] } = useQuery({
    queryKey: ['integrated-structural', pacienteId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('avaliacoes_identidade')
        .select('*')
        .eq('paciente_id', pacienteId)
        .not('score_e', 'is', null)
        .is('myid_score', null)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return data || [];
    },
    enabled: serviceType === 'identidade',
  });

  const structuralData = structuralAvaliacoes[0]?.dados_avaliacao as any as StructuralAssessmentData | null;

  const lastServiceEntry = serviceData[0] as any;

  // ── Build scores
  const getScores = () => {
    if (myidLinkResult?.component_scores) {
      const cs = myidLinkResult.component_scores;
      return {
        D: cs.D ?? (cs.D_pain ?? 0),
        EFI: cs.EFI ?? (cs.EFI_functionality ?? 0),
        P: cs.P ?? (cs.P_psychological ?? 0),
        I: cs.I ?? (cs.I_inertia ?? 0),
        R: cs.R ?? (cs.R_regulation ?? 0),
        C: cs.C ?? (cs.C_context ?? 0),
        AF: cs.AF ?? (cs.AF_activity ?? 5),
        HID: cs.HID ?? (cs.HID_hydration ?? 5),
        NUT: cs.NUT ?? (cs.NUT_nutrition ?? 5),
        ERG: cs.ERG ?? (cs.ERG_ergonomics ?? 5),
        N: cs.N ?? (cs.N_noise ?? 0),
        MED: cs.MED ?? (cs.MED_penalty ?? 0),
      };
    }
    if (ultimaMyID) {
      const analysis = ultimaMyID.myid_analysis as any;
      const cs = analysis?.componentScores || analysis?.component_scores || {};
      return {
        D: cs.D ?? (Number(ultimaMyID.score_d) || 0),
        EFI: cs.EFI ?? (Number(ultimaMyID.score_efi) || 0),
        P: cs.P ?? (Number(ultimaMyID.score_p) || 0),
        I: cs.I ?? (Number(ultimaMyID.score_i) || 0),
        R: cs.R ?? (Number(ultimaMyID.score_r) || 0),
        C: cs.C ?? (Number(ultimaMyID.score_c) || 0),
        AF: cs.AF ?? (cs.AF_activity ?? 5),
        HID: cs.HID ?? (cs.HID_hydration ?? 5),
        NUT: cs.NUT ?? (cs.NUT_nutrition ?? 5),
        ERG: cs.ERG ?? (cs.ERG_ergonomics ?? 5),
        N: cs.N ?? (Number(ultimaMyID.score_n) || 0),
        MED: cs.MED ?? (cs.MED_penalty ?? 0),
      };
    }
    return null;
  };

  const scores = getScores();

  // ── Cálculo das Zonas de Poder ─────────────────────────────────────────────
  const getPowerZones = (sc: any): PowerZone[] => {
    if (!sc) return [];

    // Biológica: R, HID, NUT (Higher is better)
    const bioLevel = ((sc.R + sc.HID + sc.NUT) / 30) * 100;

    // Comportamental: I, AF, ERG (I: lower is better, others: higher is better)
    const compLevel = (((10 - sc.I) + sc.AF + sc.ERG) / 30) * 100;

    // Emocional: P, C (P: lower is better, C: higher is better)
    const emoLevel = (((10 - sc.P) + sc.C) / 20) * 100;

    // Sistêmica/Ambiental: N, D, EFI (Lower is better)
    const sistLevel = (((10 - sc.N) + (10 - sc.D) + (10 - sc.EFI)) / 30) * 100;

    return [
      {
        id: 'bio',
        title: 'Biológica',
        level: bioLevel,
        color: 'text-emerald-600',
        icon: Heart,
        description: 'Vitalidade e regulação interna.',
        factors: ['Sono', 'Hidratação', 'Nutrição']
      },
      {
        id: 'comp',
        title: 'Comportamental',
        level: compLevel,
        color: 'text-blue-600',
        icon: Zap,
        description: 'Seu estilo de vida e movimento.',
        factors: ['Atividade', 'Inércia', 'Ergonomia']
      },
      {
        id: 'emo',
        title: 'Emocional',
        level: emoLevel,
        color: 'text-violet-600',
        icon: Smile,
        description: 'Sua resiliência e suporte mental.',
        factors: ['Coping', 'Contexto']
      },
      {
        id: 'sist',
        title: 'Sistêmica',
        level: sistLevel,
        color: 'text-amber-600',
        icon: Shield,
        description: 'Proteção contra dor e ruído.',
        factors: ['Dor', 'Ruído', 'Função']
      }
    ];
  };

  const powerZones = getPowerZones(scores);

  // ── Lógica de Missões e Insights ───────────────────────────────────────────
  const getInsights = (sc: any) => {
    if (!sc) return null;
    const factors = [
      { key: 'R', label: 'Melhorar o Sono', potential: 10 - sc.R, mission: 'Tentar dormir 30min mais cedo hoje.' },
      { key: 'HID', label: 'Beber mais Água', potential: 10 - sc.HID, mission: 'Beber 2 litros de água durante o dia.' },
      { key: 'AF', label: 'Mais Movimento', potential: 10 - sc.AF, mission: 'Fazer uma caminhada leve de 15 min.' },
      { key: 'NUT', label: 'Ajustar Nutrição', potential: 10 - sc.NUT, mission: 'Evitar ultraprocessados nas próximas 3 refeições.' },
      { key: 'P', label: 'Reduzir Ansiedade', potential: sc.P, mission: 'Praticar 5 min de respiração consciente.' },
      { key: 'I', label: 'Vencer a Inércia', potential: sc.I, mission: 'Realizar uma tarefa pendente que te gera estresse.' },
    ];

    const sorted = [...factors].sort((a, b) => b.potential - a.potential);
    return {
      opportunity: sorted[0],
      limitation: sorted[sorted.length - 1],
      missions: sorted.slice(0, 3).map(f => ({
        id: f.key,
        title: f.label,
        description: f.mission,
        icon: Target,
        completed: false
      }))
    };
  };

  const insights = getInsights(scores);
  const myidScore = myidLinkResult?.MyID_score ?? (Number(ultimaMyID?.myid_score) || 0);
  const hasRedFlags = myidLinkResult?.red_flags ?? (ultimaMyID?.dados_avaliacao as any)?.resultado?.redFlagsDetected ?? (!!ultimaMyID?.red_flags || false);

  const interpretation = getMyIDInterpretation(myidScore, hasRedFlags);
  const narrative = generateMyIDNarrative4Lines(myidScore, scores || {}, hasRedFlags);
  const classificacao = interpretation.status;
  const label = interpretation.label;
  const recommendation = interpretation.recommendation || myidLinkResult?.recommendation || '';
  const painPattern = myidLinkResult?.pain_pattern ?? '';
  const focusAreas = myidLinkResult?.focus_areas ?? [];
  const redFlagsDetected = hasRedFlags;

  const rings = scores ? getMyIDFingerprintData(scores) : [];
  const severityClass = getMyIDSeverityColor(classificacao);

  // ── Chart data
  const getMyIDDate = (av: any) => av.data_avaliacao || format(parseISO(av.created_at), 'dd/MM/yyyy');
  const getServiceDate = (av: any) => serviceType === 'studio' ? format(parseISO(av.data_medida), 'dd/MM/yyyy') : av.data_avaliacao;

  const allDates = Array.from(new Set([
    ...myidAvaliacoes.map(getMyIDDate),
    ...serviceData.map(getServiceDate)
  ])).sort((a: string, b: string) => {
    try {
      return parse(a, 'dd/MM/yyyy', new Date()).getTime() - parse(b, 'dd/MM/yyyy', new Date()).getTime();
    } catch { return 0; }
  });

  const chartData = allDates.map(dateStr => {
    const myidMatch = myidAvaliacoes.find(m => getMyIDDate(m) === dateStr);
    const serviceMatch = serviceData.find((m: any) => getServiceDate(m) === dateStr);
    const point: any = { date: dateStr };
    if (myidMatch) {
      point.myidScore = Number(myidMatch.myid_score) || null;
      point.scoreD = Number(myidMatch.score_d) || null;
      point.scoreR = Number(myidMatch.score_r) || null;
    }
    if (serviceMatch) {
      const sm = serviceMatch as any;
      if (serviceType === 'cob_zero') {
        point.cobb = Number(sm.cobb_angle) || null;
        point.scoreE = Number(sm.score_e) || null;
        point.risco = Number(sm.risco_percentage) || null;
      } else if (serviceType === 'studio') {
        point.gordura = Number(sm.percentual_gordura) || null;
        point.peso = Number(sm.peso) || null;
      }
    }
    return point;
  });

  // ═══════════════════ RENDER ═══════════════════

  return (
    <div className="space-y-5">
      {/* ─── SEÇÃO 1: MyID RESULTADO ─── */}
      {!hasMyID ? (
        <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-xl border-border bg-muted/20 text-center">
          <Fingerprint className="h-14 w-14 text-muted-foreground opacity-20 mb-3" />
          <h4 className="font-bold text-foreground">Aguardando MyID</h4>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            O paciente precisa concluir o questionário MyID para visualizar os resultados.
          </p>
        </div>
      ) : (
        <>
          {/* MyID Fingerprint + Score */}
          <Card className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-card via-card to-violet-50/40 dark:to-violet-950/20 mb-6">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 flex items-center justify-center rounded-xl bg-violet-600 shadow-sm shrink-0">
                    <Fingerprint className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-foreground leading-tight">Painel de Impacto MyID</h3>
                    <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest mt-0.5">Sua Biologia em Tempo Real</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-white/50 dark:bg-black/20 px-3 py-1.5 rounded-xl border border-white dark:border-white/10">
                  <Badge variant="outline" className={cn("text-[9px] font-black px-2 py-0.5 border-current", severityClass)}>{classificacao}</Badge>
                  <span className="text-[9px] text-muted-foreground font-bold uppercase">Estado de Saúde Atual</span>
                </div>
              </div>

              {/* Fingerprint — Mapa Principal (full width) */}
              <div className="relative group p-2 sm:p-4 bg-white/30 dark:bg-black/10 rounded-3xl border border-white/50 dark:border-white/5 backdrop-blur-sm w-full mx-auto">
                <div className="absolute top-4 left-4 p-2 bg-white/80 dark:bg-black/50 rounded-lg shadow-sm z-10">
                  <Sparkles className="h-3 w-3 text-violet-600 animate-pulse" />
                </div>
                <MyIDFingerprint
                  rings={rings}
                  myidScore={myidScore}
                  className="w-full"
                  highlightedKey={hoveredScoreKey}
                  onRingHover={setHoveredScoreKey}
                />
                <div className="mt-2 text-center">
                  <p className="text-[10px] text-muted-foreground font-medium italic">Passe o mouse nos anéis para detalhar cada índice</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">

                <div className="space-y-3">
                  {insights && (
                    <>
                      <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-2xl group transition-all hover:bg-emerald-500/10 dark:hover:bg-emerald-500/15 hover:translate-x-1 duration-300">
                        <div className="flex items-start gap-4">
                          <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm shrink-0">
                            <TrendingUp className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest opacity-80">Maior Oportunidade</span>
                              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                            </div>
                            <h4 className="font-bold text-base text-emerald-950 dark:text-emerald-100 leading-tight">{insights.opportunity.label}</h4>
                            <p className="text-xs text-emerald-900/60 dark:text-emerald-400/60 mt-0.5 leading-snug font-medium">
                              Reduzir este índice trará o maior retorno direto para sua saúde global agora.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-2xl group transition-all hover:bg-amber-500/10 dark:hover:bg-amber-500/15 hover:translate-x-1 duration-300">
                        <div className="flex items-start gap-4">
                          <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 group-hover:scale-110 group-hover:-rotate-3 transition-all duration-300 shadow-sm shrink-0">
                            <AlertTriangle className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest opacity-80 mb-0.5 block">Ponto de Atenção</span>
                            <h4 className="font-bold text-base text-amber-950 dark:text-amber-100 leading-tight">{insights.limitation.label}</h4>
                            <p className="text-xs text-amber-900/60 dark:text-amber-400/60 mt-0.5 leading-snug font-medium">
                              Sua base de sustentação. Este fator está equilibrado, mantenha como está.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-muted/30 dark:bg-muted/10 rounded-2xl border border-border/50 backdrop-blur-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:rotate-12 transition-transform duration-500">
                          <Award className="h-10 w-10" />
                        </div>
                        <div className="flex items-center gap-2 mb-3 relative z-10">
                          <Award className="h-4 w-4 text-primary" />
                          <h5 className="text-[11px] font-black uppercase tracking-[0.15em] text-foreground">Bio-ConquistasAtivas</h5>
                        </div>
                        <div className="flex flex-wrap gap-2.5 relative z-10">
                          {scores && (
                            <>
                              <Badge variant="secondary" className={cn("rounded-full border-2 px-3 py-1 gap-2 transition-all duration-500 hover:scale-105", scores.HID > 7 ? "bg-blue-100 text-blue-700 border-blue-200 shadow-sm shadow-blue-100" : "opacity-20 grayscale cursor-not-allowed")}>
                                <div className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" /> Hidratado
                              </Badge>
                              <Badge variant="secondary" className={cn("rounded-full border-2 px-3 py-1 gap-2 transition-all duration-500 hover:scale-105", scores.R > 7 ? "bg-violet-100 text-violet-700 border-violet-200 shadow-sm shadow-violet-100" : "opacity-20 grayscale cursor-not-allowed")}>
                                <div className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" /> Sono VIP
                              </Badge>
                              <Badge variant="secondary" className={cn("rounded-full border-2 px-3 py-1 gap-2 transition-all duration-500 hover:scale-105", scores.AF > 6 ? "bg-emerald-100 text-emerald-700 border-emerald-200 shadow-sm shadow-emerald-100" : "opacity-20 grayscale cursor-not-allowed")}>
                                <div className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" /> Ativo
                              </Badge>
                              <Badge variant="secondary" className={cn("rounded-full border-2 px-3 py-1 gap-2 transition-all duration-500 hover:scale-105", scores.P < 4 ? "bg-orange-100 text-orange-700 border-orange-200 shadow-sm shadow-orange-100" : "opacity-20 grayscale cursor-not-allowed")}>
                                <div className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" /> Equilíbrio
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Detalhamento da Fórmula MyID (Demand vs Capacity) */}
              <div className="mt-8 pt-6 border-t border-violet-100 dark:border-violet-900/30">
                <MyIDFormulaDisplay
                  scores={scores!}
                  myidScore={myidScore}
                  highlightedKey={hoveredScoreKey}
                  hasRedFlags={redFlagsDetected}
                />
              </div>

              {/* 4-Line Narrative Summary - Movido para debaixo do Index */}
              <div className="mt-4 max-w-2xl mx-auto bg-violet-50/50 dark:bg-violet-900/10 rounded-2xl p-5 border border-violet-100 dark:border-violet-900/20">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-violet-600" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-violet-700 dark:text-violet-400">Resumo Sistêmico</span>
                </div>
                <div className="space-y-2">
                  {narrative.map((line, i) => (
                    <p key={i} className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300 font-medium">
                      <span className="text-violet-500 mr-1.5">•</span>{line}
                    </p>
                  ))}
                </div>
              </div>

              {/* ─── O QUE O MyID REVELA ─── */}
              <div className="mt-8 pt-6 border-t border-violet-100 dark:border-violet-900/30">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-8 w-8 flex items-center justify-center rounded-xl bg-primary/10">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-black text-sm uppercase tracking-widest text-foreground">O que o MyID revelou</h4>
                    <p className="text-[10px] text-muted-foreground">Cada dimensão investigada pelo questionário</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {[
                    { text: 'Quanto de "demanda" seu corpo está recebendo', icon: Activity, color: 'text-red-500', scoreKey: 'D' },
                    { text: 'Quanto de "capacidade de suporte" você tem', icon: Shield, color: 'text-emerald-500', scoreKey: 'R' },
                    { text: 'Como suas EMOÇÕES amplificam (ou reduzem) a dor', icon: Brain, color: 'text-violet-500', scoreKey: 'P' },
                    { text: 'Qual é seu nível de MOVIMENTO e ATIVIDADE', icon: Dumbbell, color: 'text-blue-500', scoreKey: 'AF' },
                    { text: 'Se você está HIDRATADO o suficiente para recuperar', icon: Heart, color: 'text-cyan-500', scoreKey: 'HID' },
                    { text: 'Se sua ALIMENTAÇÃO está alimentando a recuperação', icon: Zap, color: 'text-amber-500', scoreKey: 'NUT' },
                    { text: 'Quais "fantasmas" do passado ainda assombram seu sistema', icon: AlertTriangle, color: 'text-orange-500', scoreKey: 'N' },
                    { text: 'Se seu ambiente está ajudando ou prejudicando', icon: Smile, color: 'text-teal-500', scoreKey: 'C' },
                    { text: 'Sua postura e ergonomia estão corretas', icon: Target, color: 'text-indigo-500', scoreKey: 'ERG' },
                    { text: 'Qual é o padrão da sua dor', icon: Fingerprint, color: 'text-rose-500', scoreKey: 'I' },
                    { text: 'Se há medicações afetando sua recuperação', icon: ShieldAlert, color: 'text-purple-500', scoreKey: 'MED' },
                  ].map((item, idx) => {
                    const sc = scores as any;
                    const val = sc?.[item.scoreKey];
                    const hasVal = val !== undefined && val !== null;
                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors group"
                        onMouseEnter={() => setHoveredScoreKey(item.scoreKey)}
                        onMouseLeave={() => setHoveredScoreKey(null)}
                      >
                        <div className={cn("mt-0.5 shrink-0", item.color)}>
                          <item.icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground leading-snug">{item.text}</p>
                          {hasVal && (
                            <span className={cn("text-[10px] font-black mt-1 inline-block", item.color)}>
                              {Number(val).toFixed(1)}/10
                            </span>
                          )}
                        </div>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ─── ZONAS DE PODER (Agrupamento Didático) ─── */}
          <div className="mb-10 lg:px-2">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <h4 className="font-black text-sm uppercase tracking-widest text-foreground">Sua Zonas de Poder</h4>
                </div>
                <p className="text-xs text-muted-foreground">O potencial de saúde em cada área da sua vida</p>
              </div>

              <div className="flex items-center gap-4 bg-muted/40 p-2 px-3 rounded-lg border border-border/50">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-bold uppercase tracking-tighter">Oportunidade</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-[10px] font-bold uppercase tracking-tighter">Atenção</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="text-[10px] font-bold uppercase tracking-tighter">Alavanca</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {powerZones.map((zone) => (
                <Card key={zone.id} className="overflow-hidden group hover:shadow-md transition-all border-violet-100/30 dark:border-violet-900/20">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className={cn("p-2 rounded-xl transition-colors", zone.color.replace('text-', 'bg-').replace('600', '100'), `dark:${zone.color.replace('text-', 'bg-').replace('600', '900/30')}`)}>
                        <zone.icon className={cn("h-4 w-4", zone.color)} />
                      </div>
                      <div className="text-right leading-none">
                        <span className={cn("text-xl font-black", zone.color)}>{zone.level.toFixed(0)}%</span>
                        <p className="text-[8px] font-bold text-muted-foreground uppercase mt-0.5">Potencial</p>
                      </div>
                    </div>

                    <h5 className="font-bold text-sm mb-1">{zone.title}</h5>
                    <p className="text-[10px] text-muted-foreground mb-4 line-clamp-2 leading-relaxed">{zone.description}</p>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-tight mb-1">
                          <span className="text-muted-foreground">Ganho de Saúde</span>
                          <span className={zone.color}>{zone.level.toFixed(0)}%</span>
                        </div>
                        <Progress value={zone.level} className="h-1.5" />
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {zone.factors.map(f => (
                          <span key={f} className="text-[8px] font-bold px-1.5 py-0.5 bg-muted rounded uppercase border border-border/50 text-muted-foreground">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* ─── MISSÕES DIÁRIAS (Interativo) ─── */}
          {insights && (
            <div className="mb-10 lg:px-2">
              <div className="bg-violet-600 rounded-3xl p-6 shadow-xl shadow-violet-200 dark:shadow-none overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-violet-400/20 rounded-full -ml-12 -mb-12 blur-xl" />

                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
                      <Zap className="h-5 w-5 text-white animate-pulse" />
                    </div>
                    <div>
                      <h4 className="font-black text-lg text-white leading-none">Missões para Você</h4>
                      <p className="text-xs text-violet-100/70 mt-1 uppercase tracking-tighter font-bold">Baseadas no seu MyID de {classificacao}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {insights.missions.map((mission, idx) => (
                      <div key={idx} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 hover:bg-white/15 transition-all cursor-pointer group">
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/20 group-hover:scale-110 transition-transform">
                            <mission.icon className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex-1">
                            <h5 className="font-bold text-sm text-white">{mission.title}</h5>
                            <p className="text-[11px] text-white/80 mt-1 leading-snug">{mission.description}</p>
                          </div>
                          <div className="h-5 w-5 rounded-full border border-white/40 flex items-center justify-center group-hover:bg-white/20 transition-all">
                            <CheckCircle2 className="h-3 w-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Alertas Clínicos e Perfil (Substituindo Evolução) */}
          <div className="mt-8 mb-10">
            <div className="flex items-center gap-2 mb-4 px-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <h4 className="font-black text-sm uppercase tracking-widest text-foreground">Alertas Clínicos e Perfil de Saúde</h4>
            </div>
            <ProtocoloScores scores={scores} />
          </div>
        </>
      )}

      {/* ─── SEÇÃO 1.5: AVALIAÇÃO ESTRUTURAL (only Método Identidade) ─── */}
      {serviceType === 'identidade' && structuralData && (
        <Card className="shadow-sm overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/30 shrink-0">
                <Activity className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-black text-lg text-foreground">Avaliação Estrutural</h3>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">8 Unidades Funcionais</p>
              </div>
              <div className="ml-auto text-right">
                <div className={cn('text-2xl font-black', classifyScoreColor(structuralData.scoreStructuralGeneral ?? 0))}>
                  {(structuralData.scoreStructuralGeneral ?? 0).toFixed(1)}
                </div>
                <div className="text-[9px] font-bold text-muted-foreground">{classifyScore(structuralData.scoreStructuralGeneral ?? 0)}</div>
              </div>
            </div>

            {/* Unit scores grid */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 mb-4">
              {UNIT_CONFIGS.map(cfg => {
                const unit = structuralData.units?.[cfg.id];
                const score = unit?.score ?? 0;
                return (
                  <div key={cfg.id} className="text-center p-1.5 rounded-lg bg-muted/40">
                    <div className="text-xs">{cfg.emoji}</div>
                    <div className={cn('text-sm font-black', classifyScoreColor(score))}>{score.toFixed(1)}</div>
                    <div className="text-[8px] text-muted-foreground font-bold">{cfg.id}</div>
                  </div>
                );
              })}
            </div>

            {/* Connection Map */}
            <StructuralConnectionMap data={structuralData} />

            {/* Gerar Diretriz de Tratamento */}
            <StructuralDiretrizButton data={structuralData} pacienteId={pacienteId} />
          </CardContent>
        </Card>
      )}

      {/* ─── SEÇÃO 2: AVALIAÇÃO ESPECÍFICA DO SERVIÇO ─── */}
      {lastServiceEntry && serviceType !== 'identidade' && (
        <Card className="shadow-sm overflow-hidden">
          <CardContent className="p-5">
            {serviceType === 'cob_zero' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30 shrink-0">
                    <AlignCenter className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-foreground">COB° ZERO</h3>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Avaliação Estrutural</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-3 text-center">
                    <div className="text-3xl font-black text-blue-600">{Number(lastServiceEntry.cobb_angle || 0).toFixed(1)}°</div>
                    <div className="text-[9px] font-bold text-blue-800/60 uppercase">Ângulo Cobb</div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3 text-center">
                    <div className="text-xl font-black">{Number(lastServiceEntry.score_e || 0).toFixed(1)}</div>
                    <div className="text-[9px] font-bold text-muted-foreground uppercase">Score E</div>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/10 rounded-xl p-3 text-center">
                    <div className="text-xl font-black text-orange-600">{Number(lastServiceEntry.risco_percentage || 0).toFixed(1)}%</div>
                    <div className="text-[9px] font-bold text-orange-800/60 uppercase">Risco</div>
                  </div>
                </div>
                {hasMyID && (
                  <p className="text-[10px] text-muted-foreground border-t pt-2">
                    <span className="font-bold">Conexão:</span> Score E estrutural ({Number(lastServiceEntry.score_e || 0).toFixed(1)}) complementa o MyID sistêmico ({myidScore.toFixed(1)}).
                    {Number(lastServiceEntry.risco_percentage) > 50 && ' ⚠️ Risco elevado — monitorar evolução do Cobb com MyID.'}
                  </p>
                )}
              </div>
            ) : serviceType === 'studio' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30 shrink-0">
                    <Dumbbell className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-foreground">Studio Personal</h3>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Composição Corporal</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-xl p-3 text-center">
                    <div className="text-3xl font-black text-emerald-600">{Number(lastServiceEntry.percentual_gordura || 0).toFixed(1)}%</div>
                    <div className="text-[9px] font-bold text-emerald-800/60 uppercase">Gordura</div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3 text-center">
                    <div className="text-xl font-black">{Number(lastServiceEntry.peso || 0).toFixed(1)}kg</div>
                    <div className="text-[9px] font-bold text-muted-foreground uppercase">Peso</div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3 text-center">
                    <div className="text-xl font-black">{Number(lastServiceEntry.imc || 0).toFixed(1)}</div>
                    <div className="text-[9px] font-bold text-muted-foreground uppercase">IMC</div>
                  </div>
                </div>
                {hasMyID && (
                  <p className="text-[10px] text-muted-foreground border-t pt-2">
                    <span className="font-bold">Conexão:</span> AF = {scores?.AF.toFixed(1)} influencia diretamente o denominador do MyID.
                    {scores && scores.AF < 4 && ' ⚠️ Atividade física baixa — foco em progressão gradual.'}
                  </p>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* ─── SEÇÃO 3: EVOLUÇÃO GRÁFICA ─── */}
      {chartData.length >= 2 && (
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="font-bold text-sm">Evolução Clínica</h3>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} domain={[0, 10]} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line yAxisId="right" type="monotone" dataKey="myidScore" name="MyID" stroke="hsl(260, 65%, 65%)" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
                  {serviceType === 'cob_zero' && (
                    <>
                      <Bar yAxisId="left" dataKey="cobb" name="Cobb°" fill="hsl(230, 70%, 60%)" radius={[4, 4, 0, 0]} barSize={20} />
                      <Line yAxisId="left" type="monotone" dataKey="risco" name="Risco%" stroke="hsl(15, 90%, 50%)" strokeWidth={1.5} dot={{ r: 3 }} connectNulls />
                    </>
                  )}
                  {serviceType === 'studio' && (
                    <>
                      <Bar yAxisId="left" dataKey="gordura" name="Gordura%" fill="hsl(210, 75%, 55%)" radius={[4, 4, 0, 0]} barSize={20} />
                      <Line yAxisId="left" type="monotone" dataKey="peso" name="Peso" stroke="hsl(230, 70%, 60%)" strokeWidth={1.5} dot={{ r: 3 }} connectNulls />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── SEÇÃO 4: DIRETRIZES DE TRATAMENTO ─── */}
      {hasMyID && (
        <Card className="shadow-sm border-violet-200/50">
          <CardContent className="p-0">
            <Button
              variant="ghost"
              className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-violet-50/50"
              onClick={() => setShowDiretrizes(!showDiretrizes)}
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-violet-600" />
                <span className="font-bold text-sm">Diretrizes e Serviços</span>
              </div>
              {showDiretrizes ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            {showDiretrizes && (
              <div className="px-4 pb-5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                {recommendation && (
                  <div className="bg-violet-50/50 dark:bg-violet-900/10 p-3 rounded-lg border border-violet-200/50">
                    <h4 className="text-xs font-bold text-violet-700 mb-1">🎯 Interpretação Geral</h4>
                    <p className="text-sm text-foreground">{recommendation}</p>
                  </div>
                )}

                {focusAreas?.length > 0 && (
                  <div className="bg-amber-50/50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-200/50">
                    <h4 className="text-xs font-bold text-amber-700 mb-1">🔍 Áreas de Foco</h4>
                    <ul className="text-sm space-y-1">
                      {focusAreas.map((area: string, i: number) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-amber-500 mt-0.5">•</span>
                          <span>{area}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Score-based directives */}
                {scores && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {scores.D >= 6 && (
                      <div className="bg-red-50/50 dark:bg-red-900/10 p-3 rounded-lg border border-red-200/50 text-sm">
                        <span className="font-bold text-red-700">🔴 Dor ({scores.D.toFixed(1)}):</span> Priorizar manejo da dor antes de carga funcional.
                      </div>
                    )}
                    {scores.P >= 5 && (
                      <div className="bg-amber-50/50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-200/50 text-sm">
                        <span className="font-bold text-amber-700">🟡 Psicológico ({scores.P.toFixed(1)}):</span> Educação em dor e estratégias de coping.
                      </div>
                    )}
                    {scores.R < 5 && (
                      <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-200/50 text-sm">
                        <span className="font-bold text-blue-700">💤 Regulação ({scores.R.toFixed(1)}):</span> Priorizar higiene do sono e gerenciamento de estresse.
                      </div>
                    )}
                    {scores.AF < 4 && (
                      <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-3 rounded-lg border border-emerald-200/50 text-sm">
                        <span className="font-bold text-emerald-700">💪 Atividade ({scores.AF.toFixed(1)}):</span> Iniciar com exercícios leves e progressão gradual.
                      </div>
                    )}
                    {scores.HID < 4 && (
                      <div className="bg-sky-50/50 dark:bg-sky-900/10 p-3 rounded-lg border border-sky-200/50 text-sm">
                        <span className="font-bold text-sky-700">💧 Hidratação ({scores.HID.toFixed(1)}):</span> Aumentar consumo de água para pelo menos 2L/dia.
                      </div>
                    )}
                    {scores.N >= 5 && (
                      <div className="bg-slate-100/50 dark:bg-slate-900/10 p-3 rounded-lg border border-slate-200/50 text-sm">
                        <span className="font-bold text-slate-700">⚡ Ruído ({scores.N.toFixed(1)}):</span> Investigar fatores viscerais e autonômicos.
                      </div>
                    )}
                  </div>
                )}

                {/* Service-specific connection */}
                {serviceType === 'cob_zero' && lastServiceEntry && (
                  <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-200/50 text-sm">
                    <span className="font-bold text-blue-700">🔗 COB° + MyID:</span> Cobb {Number(lastServiceEntry.cobb_angle || 0).toFixed(1)}° com MyID {myidScore.toFixed(1)}.
                    {myidScore > 4 ? ' O estado sistêmico pode estar amplificando a dor estrutural.' : ' Estado sistêmico não agrava significativamente o quadro estrutural.'}
                  </div>
                )}
                {serviceType === 'studio' && lastServiceEntry && (
                  <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-3 rounded-lg border border-emerald-200/50 text-sm">
                    <span className="font-bold text-emerald-700">🔗 Studio + MyID:</span> Composição corporal atual ({Number(lastServiceEntry.percentual_gordura || 0).toFixed(1)}% gordura) com AF de {scores?.AF.toFixed(1)}.
                    {scores && scores.AF < 5 ? ' Foco em aumento gradual de atividade antes de intensificar carga.' : ' Boa base de atividade — pode progredir normalmente.'}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Structural Treatment Guideline Generator ──────────────────────────
function StructuralDiretrizButton({ data, pacienteId }: { data: StructuralAssessmentData, pacienteId: string }) {
  const navigate = useNavigate();

  return (
    <div className="mt-4 pt-4 border-t">
      <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg mb-4 text-xs text-primary">
        💡 O sistema mapeou as restrições primárias e o score de dor.
        Para mesclar os dados de Identidade Estrutural nesta sessão e gerar prescrições por fases em uma nova diretriz, acesse o painel.
      </div>
      <Button
        className="w-full bg-gradient-primary text-white gap-2"
        onClick={() => navigate(`/protocolos?paciente=${pacienteId}`)}
      >
        <Sparkles className="h-4 w-4" />
        Montar Diretrizes e Serviços (Painel)
      </Button>
    </div>
  );
}
