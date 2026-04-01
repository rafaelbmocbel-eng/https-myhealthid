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
  AlertTriangle, CheckCircle2, Target, Award, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { calcularPerdaDimensao } from '@/utils/myid/lossTable';
import { getMyIDFingerprintData, getMyIDSeverityColor, getMyIDInterpretation } from '@/utils/myidCalculations';
import MyIDFingerprint from '@/components/myid/MyIDFingerprint';
import MyIDFormulaDisplay from '@/components/myid/MyIDFormulaDisplay';
import StructuralConnectionMap from '@/components/structural/StructuralConnectionMap';
import { StructuralAssessmentData, UNIT_CONFIGS, classifyScore, classifyScoreColor } from '@/types/structural';
import { generateRehabInsights } from '@/utils/tissueHealingTimelines';
import type { MyIDResult as MyIDResultType, FingerprintRing } from '@/types/myid';
import { Progress } from '@/components/ui/progress';
import ProtocoloScores from '@/components/protocolo/ProtocoloScores';
import MyIDDicasPessoais from '@/components/myid/MyIDDicasPessoais';
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

const GlobalGauge = ({ score, color }: { score: number; color: string }) => {
  const radius = 38;
  const circ = Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const dashoffset = circ - pct * circ;
  return (
    <div className="relative flex flex-col items-center justify-center w-full max-w-[200px] h-[100px] mx-auto overflow-hidden">
      <svg width="100%" height="100%" viewBox="0 0 100 55" className="overflow-visible mt-2">
        <path d="M 12 50 A 38 38 0 0 1 88 50" fill="none" stroke="currentColor" strokeWidth="8" opacity="0.12" strokeLinecap="round" style={{ color }} />
        <path d="M 12 50 A 38 38 0 0 1 88 50" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={circ} strokeDashoffset={dashoffset} strokeLinecap="round" style={{ color, transition: 'stroke-dashoffset 1s cubic-bezier(0.25, 1, 0.5, 1)' }} />
      </svg>
      <div className="absolute bottom-1 flex flex-col items-center leading-none">
        <span className="text-4xl font-black tracking-tighter" style={{ color }}>{Math.round(score)}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">MyID-100</span>
      </div>
    </div>
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
        MED: 0,
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
        AF: cs.AF ?? 5, HID: cs.HID ?? 5, NUT: cs.NUT ?? 5, ERG: cs.ERG ?? 5,
        N: cs.N ?? (Number(ultimaMyID.score_n) || 0),
        MED: 0,
      };
    }
    return null;
  };

  const scores = getScores();

  // ── Cálculo das Zonas de Poder ─────────────────────────────────────────────
  const getPowerZones = (sc: any): PowerZone[] => {
    if (!sc) return [];

    // Use loss table to calculate actual impact per zone
    // Biológica: R (capacity), HID (capacity), NUT (capacity)
    const bioLossR = calcularPerdaDimensao('R', 10 - sc.R).perda_pontos;
    const bioLossHID = calcularPerdaDimensao('HID', 10 - sc.HID).perda_pontos;
    const bioLossNUT = calcularPerdaDimensao('NUT', 10 - sc.NUT).perda_pontos;
    const bioMaxLoss = 15 + 6 + 6; // max weights from loss table
    const bioLevel = Math.max(0, 100 - ((bioLossR + bioLossHID + bioLossNUT) / bioMaxLoss) * 100);

    // Comportamental: I (demand), AF (capacity), ERG (capacity)
    const compLossI = calcularPerdaDimensao('I', sc.I).perda_pontos;
    const compLossAF = calcularPerdaDimensao('AF', 10 - sc.AF).perda_pontos;
    const compLossERG = calcularPerdaDimensao('ERG', 10 - sc.ERG).perda_pontos;
    const compMaxLoss = 5 + 8 + 5;
    const compLevel = Math.max(0, 100 - ((compLossI + compLossAF + compLossERG) / compMaxLoss) * 100);

    // Emocional: P (demand), C (capacity)
    const emoLossP = calcularPerdaDimensao('P', sc.P).perda_pontos;
    const emoLossC = calcularPerdaDimensao('C', 10 - sc.C).perda_pontos;
    const emoMaxLoss = 5 + 10;
    const emoLevel = Math.max(0, 100 - ((emoLossP + emoLossC) / emoMaxLoss) * 100);

    // Sistêmica: N (demand), D (demand), EFI (demand)
    const sistLossN = calcularPerdaDimensao('N', sc.N).perda_pontos;
    const sistLossD = calcularPerdaDimensao('D', sc.D).perda_pontos;
    const sistLossEFI = calcularPerdaDimensao('EFI', sc.EFI).perda_pontos;
    const sistMaxLoss = 5 + 20 + 15;
    const sistLevel = Math.max(0, 100 - ((sistLossN + sistLossD + sistLossEFI) / sistMaxLoss) * 100);

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
    // Use loss-table to calculate actual point recovery potential per factor
    const factors = [
      { key: 'R', label: 'Melhorar o Sono', potential: calcularPerdaDimensao('R', 10 - sc.R).perda_pontos, mission: 'Tentar dormir 30min mais cedo hoje.' },
      { key: 'HID', label: 'Beber mais Água', potential: calcularPerdaDimensao('HID', 10 - sc.HID).perda_pontos, mission: 'Beber 2 litros de água durante o dia.' },
      { key: 'AF', label: 'Mais Movimento', potential: calcularPerdaDimensao('AF', 10 - sc.AF).perda_pontos, mission: 'Fazer uma caminhada leve de 15 min.' },
      { key: 'NUT', label: 'Ajustar Nutrição', potential: calcularPerdaDimensao('NUT', 10 - sc.NUT).perda_pontos, mission: 'Evitar ultraprocessados nas próximas 3 refeições.' },
      { key: 'P', label: 'Reduzir Ansiedade', potential: calcularPerdaDimensao('P', sc.P).perda_pontos, mission: 'Praticar 5 min de respiração consciente.' },
      { key: 'I', label: 'Vencer a Inércia', potential: calcularPerdaDimensao('I', sc.I).perda_pontos, mission: 'Realizar uma tarefa pendente que te gera estresse.' },
      { key: 'D', label: 'Reduzir a Dor', potential: calcularPerdaDimensao('D', sc.D).perda_pontos, mission: 'Aplicar técnica de relaxamento ou crioterapia.' },
      { key: 'C', label: 'Melhorar Contexto', potential: calcularPerdaDimensao('C', 10 - sc.C).perda_pontos, mission: 'Dedique 10 min a uma atividade que lhe traz prazer.' },
      { key: 'ERG', label: 'Ajustar Ergonomia', potential: calcularPerdaDimensao('ERG', 10 - sc.ERG).perda_pontos, mission: 'Faça micro-pausas a cada 50 min de trabalho.' },
    ];

    const sorted = [...factors].sort((a, b) => b.potential - a.potential);
    // Filter out factors with 0 loss (no improvement needed)
    const actionable = sorted.filter(f => f.potential > 0);
    const best = actionable.length > 0 ? actionable : sorted;
    return {
      opportunity: best[0],
      limitation: best[best.length - 1],
      missions: best.slice(0, 3).map(f => ({
        id: f.key,
        title: f.label,
        description: f.mission,
        icon: Target,
        completed: false
      }))
    };
  };

  const insights = getInsights(scores);

  // Compute MyID-100 from component scores using loss table (same logic as calculator)
  const computeMyID100FromScores = (sc: typeof scores): number => {
    if (!sc) return 0;
    let totalPerdas = 0;
    // Demand dimensions (raw score = how bad)
    totalPerdas += calcularPerdaDimensao('D', sc.D).perda_pontos;
    totalPerdas += calcularPerdaDimensao('EFI', sc.EFI).perda_pontos;
    totalPerdas += calcularPerdaDimensao('P', sc.P).perda_pontos;
    totalPerdas += calcularPerdaDimensao('I', sc.I).perda_pontos;
    totalPerdas += calcularPerdaDimensao('N', sc.N).perda_pontos;
    // Capacity dimensions (deficit = 10 - value)
    totalPerdas += calcularPerdaDimensao('R', 10 - sc.R).perda_pontos;
    totalPerdas += calcularPerdaDimensao('C', 10 - sc.C).perda_pontos;
    totalPerdas += calcularPerdaDimensao('AF', 10 - sc.AF).perda_pontos;
    totalPerdas += calcularPerdaDimensao('HID', 10 - sc.HID).perda_pontos;
    totalPerdas += calcularPerdaDimensao('NUT', 10 - sc.NUT).perda_pontos;
    totalPerdas += calcularPerdaDimensao('ERG', 10 - sc.ERG).perda_pontos;
    return Math.max(0, Math.min(100, 100 - totalPerdas));
  };

  // Prefer stored 0-100 value, but recalculate from scores if stored value seems wrong (0 or old scale <11)
  const storedScore = myidLinkResult?.MyID_score ?? (Number(ultimaMyID?.myid_score) || 0);
  const myidScore = (storedScore > 10 ? storedScore : scores ? computeMyID100FromScores(scores) : storedScore);
  const rawRedFlags = myidLinkResult?.red_flags ?? (ultimaMyID?.dados_avaliacao as any)?.resultado?.redFlagsDetected ?? (!!ultimaMyID?.red_flags || false);
  const hasRedFlags = Array.isArray(rawRedFlags) ? rawRedFlags.length > 0 : !!rawRedFlags;

  const dimScores = {
    D: scores?.D ?? 0,
    EFI: scores?.EFI ?? 0,
    P: scores?.P ?? 0,
    I: scores?.I ?? 0,
    N: scores?.N ?? 0,
    R: scores?.R ? 10 - scores.R : 0,
    AF: scores?.AF ? 10 - scores.AF : 0,
    ERG: scores?.ERG ? 10 - scores.ERG : 0,
  };
  const interpretation = getMyIDInterpretation(myidScore, hasRedFlags, dimScores);
  const classificacao = interpretation.status;
  const label = interpretation.label;
  const rawRec = interpretation.recommendation || myidLinkResult?.recommendation || '';
  const recommendation = typeof rawRec === 'string' ? rawRec : (rawRec && typeof rawRec === 'object' ? JSON.stringify(rawRec) : '');
  const painPattern = typeof (myidLinkResult?.pain_pattern) === 'string' ? myidLinkResult.pain_pattern : '';
  const rawFocus = myidLinkResult?.focus_areas ?? [];
  const focusAreas: string[] = Array.isArray(rawFocus) ? rawFocus.map((a: any) => typeof a === 'string' ? a : (a?.label || a?.area || JSON.stringify(a))) : [];
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
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-violet-600 shadow-lg shadow-violet-200 dark:shadow-none shrink-0">
                    <Fingerprint className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-black text-xl text-foreground leading-tight">Painel de Impacto MyID</h3>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1">Sua Biologia em Tempo Real</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-white/50 dark:bg-black/20 p-2 pr-4 rounded-2xl border border-white dark:border-white/10">
                  <GlobalGauge score={myidScore} color={interpretation.color} />
                  <div className="flex flex-col">
                    <Badge variant="outline" className={cn("text-[10px] font-black px-2 py-0 border-current mb-1", severityClass)}>{classificacao}</Badge>
                    <span className="text-[10px] text-muted-foreground font-bold leading-tight max-w-[100px] uppercase">Estado de Saúde Atual</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-8">
                {/* Fingerprint — Mapa Principal */}
                <div className="relative group p-4 bg-white/30 dark:bg-black/10 rounded-3xl border border-white/50 dark:border-white/5 backdrop-blur-sm">
                  <div className="absolute top-4 left-4 p-2 bg-white/80 dark:bg-black/50 rounded-lg shadow-sm z-10">
                    <Sparkles className="h-3 w-3 text-violet-600 animate-pulse" />
                  </div>
                  <MyIDFingerprint
                    rings={rings}
                    myidScore={myidScore}
                    highlightedKey={hoveredScoreKey}
                    onRingHover={setHoveredScoreKey}
                  />
                  <div className="mt-4 text-center">
                    <p className="text-[10px] text-muted-foreground font-medium italic">Passe o mouse nos anéis para detalhar cada índice</p>
                  </div>
                </div>

                <div className="space-y-5">
                  {insights && (
                    <>
                      <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl group transition-all hover:bg-emerald-500/10 duration-300">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 flex items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 shrink-0">
                            <TrendingUp className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest opacity-80">Maior Oportunidade</span>
                            <h4 className="font-bold text-sm text-emerald-950 dark:text-emerald-100 truncate">{insights.opportunity.label}</h4>
                          </div>
                        </div>
                      </div>

                      <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl group transition-all hover:bg-amber-500/10 duration-300">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 flex items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 shrink-0">
                            <AlertTriangle className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[9px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest opacity-80">Ponto de Atenção</span>
                            <h4 className="font-bold text-sm text-amber-950 dark:text-amber-100 truncate">{insights.limitation.label}</h4>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 bg-muted/30 dark:bg-muted/10 rounded-[2rem] border border-border/50 backdrop-blur-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform duration-500">
                          <Award className="h-12 w-12" />
                        </div>
                        <div className="flex items-center gap-3 mb-4 relative z-10">
                          <Award className="h-5 w-5 text-primary" />
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
              <div className="mt-10 pt-6 border-t border-violet-100 dark:border-violet-900/30">
                <MyIDFormulaDisplay
                  scores={scores!}
                  myidScore={myidScore}
                  highlightedKey={hoveredScoreKey}
                  hasRedFlags={redFlagsDetected}
                />
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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {powerZones.map((zone) => (
                <Card key={zone.id} className="overflow-hidden group hover:shadow-sm transition-all border-border/40">
                  <CardContent className="p-2.5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn("p-1.5 rounded-lg transition-colors", zone.color.replace('text-', 'bg-').replace('600', '100'), `dark:${zone.color.replace('text-', 'bg-').replace('600', '900/30')}`)}>
                        <zone.icon className={cn("h-3 w-3", zone.color)} />
                      </div>
                      <span className={cn("text-sm font-black", zone.color)}>{zone.level.toFixed(0)}%</span>
                    </div>

                    <h5 className="font-bold text-[11px] leading-tight mb-1">{zone.title}</h5>

                    <Progress value={zone.level} className="h-1 mb-1.5" />

                    <div className="flex flex-wrap gap-0.5">
                      {zone.factors.map(f => (
                        <span key={f} className="text-[7px] font-semibold px-1 py-px bg-muted rounded text-muted-foreground">
                          {f}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Dicas e Missões movidas para gamificação (PacienteMetasDesafios) */}

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

            {/* ── Rehab Timeline Widget ── */}
            {(() => {
              const insights = structuralData.units ? generateRehabInsights(structuralData.units) : [];
              if (insights.length === 0) return null;
              const longestRecovery = insights[0];
              const hasSlowTissue = insights.some(i => i.category === 'Articular' || i.category === 'Ligamentar');
              return (
                <div className="mt-4 rounded-xl border-2 border-primary/20 bg-gradient-to-br from-card to-primary/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-primary" />
                    <h4 className="font-bold text-sm text-foreground">Tempo de Reabilitação</h4>
                    <Badge variant="outline" className="text-[9px] ml-auto">Baseado em Evidência</Badge>
                  </div>

                  {hasSlowTissue && (
                    <div className="p-2.5 rounded-lg bg-destructive/5 border border-destructive/20">
                      <p className="text-[10px] text-destructive font-medium">
                        ⚠️ Estruturas de cicatrização lenta identificadas. O alívio dos sintomas NÃO significa cura completa do tecido.
                      </p>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {insights.slice(0, 4).map((insight, idx) => {
                      const colorMap: Record<string, string> = {
                        emerald: 'bg-emerald-500', amber: 'bg-amber-500', orange: 'bg-orange-500',
                        red: 'bg-red-500', purple: 'bg-purple-500', blue: 'bg-blue-500',
                      };
                      const maxAll = insights[0]?.maxWeeks || 1;
                      const barWidth = (insight.maxWeeks / maxAll) * 100;
                      return (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-sm w-5 shrink-0">{insight.icon}</span>
                          <span className="text-[9px] font-medium w-14 truncate shrink-0">{insight.tissue}</span>
                          <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full', colorMap[insight.color] || 'bg-primary')} style={{ width: `${barWidth}%` }} />
                          </div>
                          <span className="text-[9px] font-bold w-16 text-right shrink-0">{insight.minWeeks}–{insight.maxWeeks} sem</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                    <div className="flex items-start gap-2">
                      <Heart className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Cada tecido tem seu relógio biológico. <strong>Respeitar esse tempo é a diferença entre recuperação completa e recidiva.</strong>
                        {hasSlowTissue && ' O fortalecimento muscular ao redor é seu principal mecanismo de proteção.'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

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
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} domain={[0, 10]} className="fill-muted-foreground" />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', background: 'hsl(var(--card))' }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line yAxisId="right" type="monotone" dataKey="myidScore" name="MyID" stroke="hsl(260, 65%, 65%)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls />
                  {serviceType === 'cob_zero' && (
                    <>
                      <Bar yAxisId="left" dataKey="cobb" name="Cobb°" fill="hsl(230, 70%, 60%)" radius={[6, 6, 0, 0]} barSize={20} />
                      <Line yAxisId="left" type="monotone" dataKey="risco" name="Risco%" stroke="hsl(15, 90%, 50%)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    </>
                  )}
                  {serviceType === 'studio' && (
                    <>
                      <Bar yAxisId="left" dataKey="gordura" name="Gordura%" fill="hsl(210, 75%, 55%)" radius={[6, 6, 0, 0]} barSize={20} />
                      <Line yAxisId="left" type="monotone" dataKey="peso" name="Peso" stroke="hsl(230, 70%, 60%)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── SEÇÃO 4: DIRETRIZES DE TRATAMENTO (dados reais) ─── */}
      {hasMyID && (
        <ActiveDiretrizSection pacienteId={pacienteId} />
      )}
    </div>
  );
}

// ── Active Diretriz Section (shows real saved protocol) ───────────────
function ActiveDiretrizSection({ pacienteId }: { pacienteId: string }) {
  const navigate = useNavigate();
  const [showDiretrizes, setShowDiretrizes] = useState(false);

  const { data: activeProtocolo } = useQuery({
    queryKey: ['active-diretriz', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('protocolos')
        .select('*')
        .eq('paciente_id', pacienteId)
        .eq('status', 'ativo')
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] || null;
    },
  });

  const { data: fases = [] } = useQuery({
    queryKey: ['active-diretriz-fases', activeProtocolo?.id],
    enabled: !!activeProtocolo?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('protocolo_fases' as any)
        .select('*')
        .eq('protocolo_id', activeProtocolo!.id)
        .order('numero_fase');
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: progressao } = useQuery({
    queryKey: ['active-diretriz-progressao', activeProtocolo?.id],
    enabled: !!activeProtocolo?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('protocolo_progressao')
        .select('*')
        .eq('protocolo_id', activeProtocolo!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const faseAtual = progressao?.fase_atual || 1;

  return (
    <Card className="shadow-sm border-violet-200/50">
      <CardContent className="p-0">
        <Button
          variant="ghost"
          className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-violet-50/50"
          onClick={() => setShowDiretrizes(!showDiretrizes)}
        >
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-violet-600" />
            <span className="font-bold text-sm">Diretrizes e Tratamentos</span>
            {activeProtocolo && (
              <Badge variant="outline" className="text-[9px] h-4 border-emerald-300 text-emerald-700 bg-emerald-50">
                Ativa
              </Badge>
            )}
          </div>
          {showDiretrizes ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>

        {showDiretrizes && (
          <div className="px-4 pb-5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            {!activeProtocolo ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-2">Nenhuma diretriz ativa encontrada.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/protocolos?paciente=${pacienteId}`)}
                  className="gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Criar Diretriz
                </Button>
              </div>
            ) : (
              <>
                {/* Header da diretriz */}
                <div className="bg-violet-50/50 dark:bg-violet-900/10 p-3 rounded-lg border border-violet-200/50">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs font-bold text-violet-700">{activeProtocolo.titulo}</h4>
                    <Badge variant="outline" className="text-[8px] h-4">
                      Fase {faseAtual}/{fases.length || '?'}
                    </Badge>
                  </div>
                  {activeProtocolo.objetivo_geral && (
                    <p className="text-[11px] text-muted-foreground">{activeProtocolo.objetivo_geral}</p>
                  )}
                  <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
                    {activeProtocolo.frequencia && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{activeProtocolo.frequencia}</span>
                    )}
                    {activeProtocolo.duracao_total && (
                      <span className="flex items-center gap-1"><Target className="h-3 w-3" />{activeProtocolo.duracao_total}</span>
                    )}
                  </div>
                </div>

                {/* Fases com técnicas */}
                {fases.map((fase: any, idx: number) => {
                  const isCurrentPhase = faseAtual === fase.numero_fase;
                  const tecnicas = Array.isArray(fase.tecnicas) ? fase.tecnicas : [];
                  const exercicios = Array.isArray(fase.exercicios) ? fase.exercicios : [];

                  return (
                    <div
                      key={fase.id || idx}
                      className={cn(
                        "p-3 rounded-lg border text-sm",
                        isCurrentPhase
                          ? "border-primary/30 bg-primary/5"
                          : "border-border/50 bg-muted/30"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-xs">
                          {isCurrentPhase && '▶ '}Fase {fase.numero_fase}: {fase.titulo || fase.nome || `Fase ${fase.numero_fase}`}
                        </span>
                        {fase.semanas && (
                          <span className="text-[9px] text-muted-foreground">{fase.semanas}</span>
                        )}
                      </div>
                      {fase.objetivo && (
                        <p className="text-[11px] text-muted-foreground mb-2">{fase.objetivo}</p>
                      )}

                      {tecnicas.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Técnicas</span>
                          <div className="flex flex-wrap gap-1">
                            {tecnicas.map((t: any, ti: number) => (
                              <Badge key={ti} variant="secondary" className="text-[9px] h-5 bg-violet-100 text-violet-700 border-0">
                                {typeof t === 'string' ? t : t.nome || t.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {exercicios.length > 0 && (
                        <div className="space-y-1 mt-1.5">
                          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Exercícios</span>
                          <div className="flex flex-wrap gap-1">
                            {exercicios.map((e: any, ei: number) => (
                              <Badge key={ei} variant="secondary" className="text-[9px] h-5 bg-emerald-100 text-emerald-700 border-0">
                                {typeof e === 'string' ? e : e.nome || e.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Snapshot insights from scores_avaliacao */}
                {activeProtocolo.scores_avaliacao && typeof activeProtocolo.scores_avaliacao === 'object' && (activeProtocolo.scores_avaliacao as any).snapshot && (
                  <div className="bg-amber-50/50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-200/50">
                    <h4 className="text-[10px] font-bold text-amber-700 mb-1">💡 Demandas Identificadas</h4>
                    <div className="flex flex-wrap gap-1">
                      {((activeProtocolo.scores_avaliacao as any).snapshot?.demandas || []).map((d: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-[8px] h-4 border-amber-300 text-amber-700">
                          {d}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Link to full view */}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-1.5 text-xs"
                  onClick={() => navigate(`/protocolos?paciente=${pacienteId}`)}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Ver detalhes completos
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
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
        Montar Diretrizes e Tratamentos (Painel)
      </Button>
    </div>
  );
}
