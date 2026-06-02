import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Activity, Fingerprint, AlignCenter, Dumbbell,
  TrendingUp, ChevronDown, ChevronUp, FileText,
  Sparkles, Printer, Copy, Shield, Zap, Heart, Smile,
  AlertTriangle, CheckCircle2, Target, Award, Clock, Rocket
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { calcularPerdaDimensao } from '@/utils/myid/lossTable';
import { getMyIDFingerprintData, getMyIDSeverityColor, getMyIDInterpretation } from '@/utils/myidCalculations';
import MyIDFingerprint from '@/components/myid/MyIDFingerprint';
import MyIDDimensionDrillDown from '@/components/myid/MyIDDimensionDrillDown';
import StructuralConnectionMap from '@/components/structural/StructuralConnectionMap';
import { StructuralAssessmentData, UNIT_CONFIGS, classifyScore, classifyScoreColor } from '@/types/structural';
import { generateRehabInsights } from '@/utils/tissueHealingTimelines';
import type { MyIDResult as MyIDResultType, FingerprintRing } from '@/types/myid';
import { Progress } from '@/components/ui/progress';
import PatientHealthAreas from '@/components/paciente/PatientHealthAreas';
import MyIDDicasPessoais from '@/components/myid/MyIDDicasPessoais';
import PacienteMetasDesafios from '@/components/paciente/PacienteMetasDesafios';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Area
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface PatientIntegratedDashboardProps {
  pacienteId: string;
  serviceType: 'identidade' | 'cob_zero' | 'studio';
  isProfessional?: boolean;
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
    <div className="relative flex flex-col items-center justify-center w-full max-w-[220px] h-[110px] mx-auto">
      {/* Radial glow halo */}
      <div
        className="absolute inset-0 -z-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 70%, ${color}33 0%, transparent 60%)`,
          filter: 'blur(6px)',
        }}
      />
      <svg width="100%" height="100%" viewBox="0 0 100 55" className="relative overflow-visible mt-2 z-10">
        <path d="M 12 50 A 38 38 0 0 1 88 50" fill="none" stroke="currentColor" strokeWidth="8" opacity="0.12" strokeLinecap="round" style={{ color }} />
        <path d="M 12 50 A 38 38 0 0 1 88 50" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={circ} strokeDashoffset={dashoffset} strokeLinecap="round" style={{ color, transition: 'stroke-dashoffset 1s cubic-bezier(0.25, 1, 0.5, 1)' }} />
      </svg>
      <div className="absolute bottom-1 flex flex-col items-center leading-none z-10">
        <span className="kpi-hero text-5xl tracking-tight" style={{ color }}>{Math.round(score)}</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-60 mt-1">MyID-100</span>
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
  serviceType,
  isProfessional = false,
}: PatientIntegratedDashboardProps) {
  const { user } = useAuth();
  const [hoveredScoreKey, setHoveredScoreKey] = useState<string | null>(null);
  const [showDiretrizes, setShowDiretrizes] = useState(false);
  const [drillDownKey, setDrillDownKey] = useState<string | null>(null);

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
  const previousMyID = myidAvaliacoes[1]; // para comparativo
  const myidLinkResult = myidFromLink[0]?.resultado_processado as any;
  const previousScore = previousMyID ? Number(previousMyID.myid_score) || 0 : null;

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

  // Avaliação estrutural (Unidades ID) descontinuada no portal — mantida no perfil do profissional como histórico.
  const structuralData = null as any;

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
        title: 'Corpo',
        level: bioLevel,
        color: 'text-emerald-600',
        icon: Heart,
        description: 'Sono, comida e água em equilíbrio.',
        factors: ['Sono', 'Hidratação', 'Nutrição']
      },
      {
        id: 'comp',
        title: 'Hábitos',
        level: compLevel,
        color: 'text-blue-600',
        icon: Zap,
        description: 'Como você se move no dia a dia.',
        factors: ['Atividade', 'Inércia', 'Ergonomia']
      },
      {
        id: 'emo',
        title: 'Mente',
        level: emoLevel,
        color: 'text-violet-600',
        icon: Smile,
        description: 'Como sua cabeça lida com a rotina.',
        factors: ['Coping', 'Contexto']
      },
      {
        id: 'sist',
        title: 'Proteção',
        level: sistLevel,
        color: 'text-amber-600',
        icon: Shield,
        description: 'O quanto seu corpo está protegido de dor.',
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
  // Wording mais suave para o paciente (evita nocebo)
  const softenForPatient = (txt: string) => {
    if (!txt) return txt;
    return txt
      .replace(/SITUAÇÃO CRÍTICA/gi, 'Índice alto')
      .replace(/CRÍTICO/gi, 'Índice alto')
      .replace(/CRITICO/gi, 'Índice alto');
  };
  const classificacaoDisplay = isProfessional ? classificacao : softenForPatient(classificacao);
  const labelDisplay = isProfessional ? (label || classificacao) : softenForPatient(label || classificacao);
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
          {/* ═══════════ MEU MyID — duas leituras, dois tons ═══════════ */}
          <Tabs defaultValue="diagnostico" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-11 p-1 rounded-xl bg-muted/60">
              <TabsTrigger value="diagnostico" className="rounded-lg gap-2 text-sm font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Fingerprint className="icon-sm" />
                Meu MyID
              </TabsTrigger>
              <TabsTrigger value="jornada" className="rounded-lg gap-2 text-sm font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Rocket className="icon-sm" />
                Minha Jornada
              </TabsTrigger>
            </TabsList>

            {/* ─────────── ABA 1: DIAGNÓSTICO (calmo, claro, único) ─────────── */}
            <TabsContent value="diagnostico" className="mt-5 space-y-5 focus-visible:outline-none">
              {/* Hero clean: Fingerprint + score */}
              <Card className="rounded-xl border-border/40 shadow-xs overflow-hidden">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3 mb-5">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-1">Sua saúde hoje</p>
                      <h3 className="h-section text-foreground">Seu retrato</h3>
                    </div>
                    <Badge variant="outline" className={cn("text-[11px] font-semibold px-2.5 py-1 border-current", severityClass)}>
                      {classificacaoDisplay}
                    </Badge>
                  </div>

                  <MyIDFingerprint
                    rings={rings}
                    myidScore={myidScore}
                    highlightedKey={isProfessional ? (drillDownKey || hoveredScoreKey) : hoveredScoreKey}
                    onRingHover={setHoveredScoreKey}
                    onRingClick={isProfessional ? (r) => setDrillDownKey(prev => prev === r.scoreKey ? null : r.scoreKey) : undefined}
                  />

                  {isProfessional && (
                    <p className="mt-2 text-center text-[10px] text-muted-foreground">
                      💡 Toque em um anel da lista para ver as respostas e os insights abaixo.
                    </p>
                  )}

                  {/* Microlegenda: como ler os anéis */}
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-sky-500/80" />
                      Anéis de dentro = <span className="font-semibold text-foreground/80">o que te sustenta</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-red-500/80" />
                      Anéis de fora = <span className="font-semibold text-foreground/80">o que está pesando</span>
                    </span>
                  </div>

                  {/* Listas compactas: anéis internos e externos (apenas profissional) */}
                  {isProfessional && rings.length > 0 && (() => {
                    const inner = rings.filter(r => r.type === 'inner');
                    const outer = rings.filter(r => r.type === 'outer');
                    const RingList = ({ title, items, dotClass }: { title: string; items: typeof rings; dotClass: string }) => (
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-1.5 flex items-center gap-1.5">
                          <span className={cn('h-1.5 w-1.5 rounded-full', dotClass)} />
                          {title}
                        </p>
                        <ul className="rounded-lg border border-border/40 bg-card/40 divide-y divide-border/40">
                          {items.map(r => {
                            const active = drillDownKey === r.scoreKey;
                            return (
                              <li key={r.scoreKey}>
                                <button
                                  type="button"
                                  onClick={() => setDrillDownKey(prev => prev === r.scoreKey ? null : r.scoreKey)}
                                  className={cn(
                                    'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left transition',
                                    active ? 'bg-primary/10' : 'hover:bg-muted/40'
                                  )}
                                >
                                  <span className="flex items-center gap-2 min-w-0">
                                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: r.color }} />
                                    <span className="text-[12px] font-medium text-foreground truncate">{r.label}</span>
                                    <span className="text-[10px] text-muted-foreground">({r.scoreKey})</span>
                                  </span>
                                  <span className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[12px] font-bold tabular-nums" style={{ color: r.color }}>
                                      {Number(r.value).toFixed(1)}
                                    </span>
                                    <ChevronDown className={cn('h-3 w-3 text-muted-foreground transition-transform', active && 'rotate-180')} />
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                    return (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {inner.length > 0 && <RingList title="Anéis internos · sustento" items={inner} dotClass="bg-sky-500" />}
                        {outer.length > 0 && <RingList title="Anéis externos · pressão" items={outer} dotClass="bg-red-500" />}
                      </div>
                    );
                  })()}

                  {/* Painel inline do anel selecionado (apenas profissional) */}
                  {isProfessional && drillDownKey && (
                    <div className="mt-4">
                      <MyIDDimensionDrillDown
                        pacienteId={pacienteId}
                        dimensao={drillDownKey}
                        scoreValor={scores ? Number((scores as any)[drillDownKey]) : undefined}
                        respostasBrutas={(myidFromLink[0] as any)?.respostas_brutas || (ultimaMyID as any)?.dados_avaliacao || {}}
                        queixaPrincipal={(myidFromLink[0] as any)?.respostas_brutas?.bloco_1_main_complaint || (ultimaMyID as any)?.queixa_principal}
                        onClose={() => setDrillDownKey(null)}
                      />
                    </div>
                  )}


                  {/* Resumo humano de 2 linhas */}
                  {insights && (
                    <p className="mt-5 text-center text-sm text-foreground/80 leading-relaxed max-w-md mx-auto">
                      Sua maior oportunidade agora é <span className="font-semibold text-emerald-700 dark:text-emerald-400">{insights.opportunity.label.toLowerCase()}</span>.
                      O ponto que mais merece atenção é <span className="font-semibold text-amber-700 dark:text-amber-400">{insights.limitation.label.toLowerCase()}</span>.
                    </p>
                  )}

                  {/* Comparativo com último MyID */}
                  {previousScore !== null && previousScore > 0 && (() => {
                    const delta = Math.round(myidScore - previousScore);
                    const isUp = delta > 0;
                    const isFlat = delta === 0;
                    return (
                      <div className="mt-4 flex justify-center">
                        <div className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                          isFlat && "bg-muted/60 text-muted-foreground",
                          isUp && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                          !isFlat && !isUp && "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        )}>
                          {isFlat ? '→' : isUp ? '↑' : '↓'}
                          <span>
                            {isFlat
                              ? 'Igual ao seu último MyID'
                              : `${isUp ? '+' : ''}${delta} ${Math.abs(delta) === 1 ? 'ponto' : 'pontos'} desde o último MyID`}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Resumo explicativo — clique para abrir */}
                  <details className="mt-5 group rounded-xl border border-border/40 bg-muted/20 open:bg-muted/30 transition-colors">
                    <summary className="flex items-center justify-between gap-2 cursor-pointer select-none px-4 py-3 list-none [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Sparkles className="icon-sm text-primary" />
                        Entenda este resultado
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="px-4 pb-4 pt-1 text-sm leading-relaxed text-foreground/85 space-y-3">
                      <p className="text-[12.5px]">
                        Cada anel parte de uma <span className="font-medium">nota de 0 a 10</span> e desconta uma quantidade de pontos do seu MyID (que começa em <span className="font-mono">100</span>).
                        Abaixo, do <span className="font-semibold text-destructive">mais crítico</span> ao menos, mostramos quanto cada anel tirou — e a soma é o que falta para 100.
                      </p>

                      {rings.length > 0 && (() => {
                        const ACTION_MAP: Record<string, { ok: string; alerta: string; critico: string; acao: string }> = {
                          D:   { ok: 'dor sob controle',        alerta: 'dor incomodando o dia',         critico: 'dor intensa e persistente',        acao: 'aplicar técnicas de alívio, educação em dor e revisar com seu profissional.' },
                          EFI: { ok: 'rotina funcionando bem',  alerta: 'algumas atividades limitadas',  critico: 'dificuldade séria nas atividades', acao: 'adaptar tarefas e reintroduzir movimento de forma gradual.' },
                          P:   { ok: 'cabeça estável',          alerta: 'medo/ansiedade ao se mexer',    critico: 'catastrofização e evitação altas', acao: 'exposição gradual ao movimento + apoio psicológico se necessário.' },
                          I:   { ok: 'sem mudanças bruscas',    alerta: 'mudanças recentes pesando',     critico: 'múltiplos gatilhos novos',         acao: 'mapear o que mudou (carga, postura, equipamento) e ajustar.' },
                          N:   { ok: 'corpo sem ruído extra',   alerta: 'sinais autonômicos presentes',  critico: 'ruído sistêmico alto',             acao: 'investigar trauma axial, cicatrizes e sinais viscerais com o profissional.' },
                          R:   { ok: 'sono e energia bons',     alerta: 'sono ou energia em queda',      critico: 'desregulação importante do sono',  acao: 'higiene do sono, respiração diafragmática e regulação autonômica.' },
                          C:   { ok: 'contexto favorável',      alerta: 'estresse contextual',           critico: 'contexto muito adverso',           acao: 'reduzir estressores chave (trabalho, família, finanças) e buscar suporte.' },
                          AF:  { ok: 'bom nível de movimento',  alerta: 'atividade física insuficiente', critico: 'sedentarismo crítico',             acao: 'iniciar 150 min/sem de atividade leve-moderada de forma progressiva.' },
                          HID: { ok: 'hidratação adequada',     alerta: 'hidratação inconsistente',      critico: 'desidratação',                     acao: 'meta de 30–35 ml/kg/dia, distribuída ao longo do dia.' },
                          NUT: { ok: 'alimentação equilibrada', alerta: 'qualidade alimentar baixa',     critico: 'déficit nutricional',              acao: 'aumentar proteína e frutas, reduzir ultraprocessados; avaliar com nutri.' },
                          ERG: { ok: 'postura no dia ok',       alerta: 'ergonomia precisa de ajuste',   critico: 'ergonomia crítica',                acao: 'pausa a cada 50 min, ajuste de tela/cadeira e revisão do colchão.' },
                        };
                        // Peso máximo por dimensão (do lossTable)
                        const PESO_MAX: Record<string, number> = { D: 20, EFI: 15, R: 15, C: 10, AF: 8, HID: 6, NUT: 6, P: 5, I: 5, ERG: 5, N: 5 };
                        const ranked = rings
                          .filter(r => r.scoreKey !== 'MED')
                          .map(r => {
                            const deficit = r.type === 'inner' ? 10 - r.value : r.value;
                            const p = calcularPerdaDimensao(r.scoreKey, deficit);
                            return { ring: r, perda: p.perda_pontos, critico: p.gatilho_critico };
                          })
                          .sort((a, b) => b.perda - a.perda);
                        const totalPerdido = ranked.reduce((s, x) => s + x.perda, 0);
                        return (
                          <div>
                            <ol className="space-y-2">
                              {ranked.map(({ ring, perda, critico }, idx) => {
                                const a = ACTION_MAP[ring.scoreKey];
                                if (!a) return null;
                                const pesoMax = PESO_MAX[ring.scoreKey] ?? 10;
                                const limiarCrit = ring.scoreKey === 'D' ? 14 : ring.scoreKey === 'EFI' || ring.scoreKey === 'R' ? 10 : 6;
                                const limiarAlerta = ring.scoreKey === 'D' ? 8 : ring.scoreKey === 'EFI' || ring.scoreKey === 'R' ? 5 : 3;
                                const isCrit = critico || perda >= limiarCrit;
                                const isAlerta = !isCrit && perda >= limiarAlerta;
                                const estado = isCrit ? a.critico : isAlerta ? a.alerta : a.ok;
                                const tone = isCrit ? 'text-destructive' : isAlerta ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400';
                                const direcao = ring.type === 'inner' ? 'maior = melhor' : 'maior = pior';
                                return (
                                  <li key={ring.scoreKey} className="flex gap-2 text-[12.5px] leading-snug">
                                    <span className="text-muted-foreground tabular-nums shrink-0 w-5">{idx + 1}.</span>
                                    <span className="flex-1">
                                      <span className="font-semibold text-foreground">{ring.label}</span>
                                      <span className="text-muted-foreground"> · nota </span>
                                      <span className="font-semibold tabular-nums" style={{ color: ring.color }}>{Number(ring.value).toFixed(1)}/10</span>
                                      <span className="text-muted-foreground"> ({direcao})</span>
                                      <span className="text-muted-foreground"> → tirou </span>
                                      <span className={cn('font-semibold tabular-nums', tone)}>{perda} pts</span>
                                      <span className="text-muted-foreground"> de {pesoMax} possíveis{critico ? ' · gatilho crítico' : ''}.</span>
                                      <span className="block">
                                        <span className={cn('font-medium', tone)}>{estado}.</span>
                                        <span className="text-muted-foreground"> → {a.acao}</span>
                                      </span>
                                    </span>
                                  </li>
                                );
                              })}
                            </ol>
                            <div className="mt-3 rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-[12.5px] space-y-0.5">
                              <p className="flex items-center justify-between">
                                <span className="text-muted-foreground">Total perdido</span>
                                <span className="font-mono font-semibold text-foreground">{totalPerdido} pts</span>
                              </p>
                              <p className="flex items-center justify-between">
                                <span className="text-muted-foreground">MyID final</span>
                                <span className="font-mono font-bold" style={{ color: interpretation.color }}>
                                  100 − {totalPerdido} = {Math.max(0, 100 - totalPerdido)}/100
                                </span>
                              </p>
                              {Math.round(myidScore) !== (100 - totalPerdido) && (
                                <p className="text-[11px] text-muted-foreground pt-0.5">
                                  Pequena diferença com o MyID exibido ({Math.round(myidScore)}) pode ocorrer por bônus/penalidades de medicação.
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {redFlagsDetected && (
                        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive text-[12.5px]">
                          ⚠️ Foram detectados <span className="font-semibold">sinais de alerta clínico</span>. Converse com seu profissional antes de iniciar qualquer mudança no plano.
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground italic pt-1 border-t border-border/40">
                        O MyID é um apoio à decisão clínica — ele não substitui a avaliação do seu profissional.
                      </p>
                    </div>
                  </details>
                </CardContent>
              </Card>

              {/* 3 cards de leitura simples — semáforo */}
              {insights && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-400">Oportunidade</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground leading-snug">{insights.opportunity.label}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{insights.opportunity.mission}</p>
                  </div>

                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-700 dark:text-amber-400">Atenção</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground leading-snug">{insights.limitation.label}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Vamos cuidar disso com calma, no seu ritmo.</p>
                  </div>

                  <div className={cn(
                    "rounded-xl border p-4",
                    redFlagsDetected ? "border-destructive/30 bg-destructive/5" : "border-border/40 bg-muted/30"
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn("h-2 w-2 rounded-full", redFlagsDetected ? "bg-destructive" : "bg-muted-foreground/40")} />
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Resumo de hoje</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground leading-snug">{labelDisplay}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {redFlagsDetected ? 'Alguns pontos merecem atenção — vale conversar com seu profissional.' : 'Continue com seu plano de cuidado.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Detalhes da avaliação */}
              <Accordion type="single" collapsible className="border border-border/40 rounded-xl bg-card">
                <AccordionItem value="alertas" className="border-b-0">
                  <AccordionTrigger className="px-4 py-3 text-sm font-semibold hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Activity className="icon-sm text-muted-foreground" />
                      Detalhes da minha avaliação
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <PatientHealthAreas scores={scores} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>

            {/* ─────────── ABA 2: JORNADA (energia, leve, motivacional) ─────────── */}
            <TabsContent value="jornada" className="mt-5 space-y-5 focus-visible:outline-none">
              {/* Missões da semana */}
              <PacienteMetasDesafios pacienteId={pacienteId} />

              {/* Bio-Conquistas */}
              <Card className="rounded-xl border-border/40 shadow-xs">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Award className="icon-sm text-primary" />
                    <h4 className="h-card">Suas conquistas</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {scores && (
                      <>
                        <Badge variant="secondary" className={cn(
                          "rounded-full px-3 py-1 gap-2 transition-opacity",
                          scores.HID > 7 ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" : "opacity-30"
                        )}>
                          💧 Hidratado
                        </Badge>
                        <Badge variant="secondary" className={cn(
                          "rounded-full px-3 py-1 gap-2 transition-opacity",
                          scores.R > 7 ? "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300" : "opacity-30"
                        )}>
                          🌙 Sono em dia
                        </Badge>
                        <Badge variant="secondary" className={cn(
                          "rounded-full px-3 py-1 gap-2 transition-opacity",
                          scores.AF > 6 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "opacity-30"
                        )}>
                          🏃 Ativo
                        </Badge>
                        <Badge variant="secondary" className={cn(
                          "rounded-full px-3 py-1 gap-2 transition-opacity",
                          scores.P < 4 ? "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300" : "opacity-30"
                        )}>
                          🧘 Equilíbrio
                        </Badge>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Cuide dos seus hábitos pra desbloquear mais.
                  </p>
                </CardContent>
              </Card>

              {/* Áreas da sua saúde */}
              <Card className="rounded-xl border-border/40 shadow-xs">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                    <div>
                      <h4 className="h-card">Áreas da sua saúde</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">Como cada parte da sua vida está hoje</p>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Forte</span>
                      <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />OK</span>
                      <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-500" />Atenção</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {powerZones.map((zone) => (
                      <div key={zone.id} className="rounded-lg border border-border/40 p-3 bg-card">
                        <div className="flex items-center gap-2 mb-2">
                          <zone.icon className={cn("icon-sm", zone.color)} />
                          <span className={cn("text-sm font-bold", zone.color)}>{zone.level.toFixed(0)}%</span>
                        </div>
                        <h5 className="font-semibold text-xs leading-tight mb-2 text-foreground">{zone.title}</h5>
                        <Progress value={zone.level} className="h-1 mb-2" />
                        <p className="text-[10px] text-muted-foreground leading-relaxed">{zone.description}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}


      {/* Avaliação Estrutural (Unidades ID) removida do portal do paciente. */}

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
                    <h3 className="font-black text-lg text-foreground">Estrutural (legado)</h3>
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
                    <h3 className="font-black text-lg text-foreground">Funcional (legado)</h3>
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

      {/* (Drill-down agora é inline, renderizado abaixo da impressão digital) */}

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
                <p className="text-sm text-muted-foreground">Nenhuma diretriz ativa no momento.</p>
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
                  <FileText className="icon-sm" />
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
        className="w-full bg-primary text-primary-foreground gap-2"
        onClick={() => navigate(`/protocolos?paciente=${pacienteId}`)}
      >
        <Sparkles className="h-4 w-4" />
        Montar Diretrizes e Tratamentos (Painel)
      </Button>
    </div>
  );
}
