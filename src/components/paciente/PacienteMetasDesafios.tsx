import { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Target, Trophy, Heart, Dumbbell, BookOpen,
  CheckCircle2, Flame, Zap, Moon, Droplets, Apple,
  Monitor, Brain, Shield, AlertTriangle, Lightbulb,
  ChevronDown, ChevronUp, Sparkles, ArrowRight
} from 'lucide-react';
import { subDays } from 'date-fns';
import { calcularPerdaDimensao, DIMENSION_LABELS, DIMENSION_COLORS } from '@/utils/myid/lossTable';
import { gerarInsightsClinicosMyID, type ClinicalInsightResult } from '@/utils/myid/clinicalInsights';
import { ConfettiBurst } from '@/components/ui/confetti-burst';
import { useHaptics } from '@/hooks/useHaptics';

// ── Interfaces ─────────────────────────────────────────────────────
interface Meta {
  id: string;
  titulo: string;
  descricao: string;
  progresso: number;
  meta: number;
  atual: number;
  unidade: string;
  icon: any;
  cor: string;
  concluida: boolean;
  xpRecompensa: number;
}

interface MissaoSaude {
  id: string;
  icon: any;
  titulo: string;
  descricao: string;
  acaoImediata: string;
  categoria: 'urgente' | 'importante' | 'oportunidade' | 'positivo';
  lossPoints: number;
  xpRecompensa: number;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  completavel: boolean; // can the patient mark it as done today?
}

interface Props {
  pacienteId: string;
}

// ── Generate health missions from MyID scores ─────────────────────
function gerarMissoesSaude(scores: any): MissaoSaude[] {
  if (!scores) return [];
  const missoes: MissaoSaude[] = [];

  const perdaR = calcularPerdaDimensao('R', 10 - scores.R);
  const perdaHID = calcularPerdaDimensao('HID', 10 - scores.HID);
  const perdaNUT = calcularPerdaDimensao('NUT', 10 - scores.NUT);
  const perdaAF = calcularPerdaDimensao('AF', 10 - scores.AF);
  const perdaERG = calcularPerdaDimensao('ERG', 10 - scores.ERG);
  const perdaP = calcularPerdaDimensao('P', scores.P);
  const perdaI = calcularPerdaDimensao('I', scores.I);
  const perdaD = calcularPerdaDimensao('D', scores.D);
  const perdaC = calcularPerdaDimensao('C', 10 - scores.C);
  const perdaN = calcularPerdaDimensao('N', scores.N);

  // Only generate missions for dimensions with actual loss
  if (perdaR.perda_pontos >= 3) {
    missoes.push({
      id: 'missao-sono', icon: Moon, titulo: 'Dormir melhor',
      descricao: 'Seu sono está atrapalhando sua recuperação.',
      acaoImediata: 'Hoje, vá para a cama 30 min mais cedo e desligue as telas 1h antes.',
      categoria: perdaR.gatilho_critico ? 'urgente' : 'importante',
      lossPoints: perdaR.perda_pontos, xpRecompensa: 20, completavel: true,
      colorClass: 'text-indigo-700 dark:text-indigo-400', bgClass: 'bg-indigo-50 dark:bg-indigo-950/30', borderClass: 'border-indigo-200 dark:border-indigo-800/50',
    });
  }

  if (perdaHID.perda_pontos >= 2) {
    missoes.push({
      id: 'missao-agua', icon: Droplets, titulo: 'Beber mais água',
      descricao: 'Seu corpo está pedindo mais hidratação.',
      acaoImediata: 'Beba 2 litros de água ao longo do dia.',
      categoria: 'importante', lossPoints: perdaHID.perda_pontos, xpRecompensa: 10, completavel: true,
      colorClass: 'text-sky-700 dark:text-sky-400', bgClass: 'bg-sky-50 dark:bg-sky-950/30', borderClass: 'border-sky-200 dark:border-sky-800/50',
    });
  }

  if (perdaAF.perda_pontos >= 3) {
    missoes.push({
      id: 'missao-movimento', icon: Dumbbell, titulo: 'Se mexer um pouco',
      descricao: 'Seu corpo está pedindo movimento.',
      acaoImediata: 'Faça uma caminhada leve de 15 minutos hoje.',
      categoria: perdaAF.gatilho_critico ? 'urgente' : 'oportunidade',
      lossPoints: perdaAF.perda_pontos, xpRecompensa: 15, completavel: true,
      colorClass: 'text-emerald-700 dark:text-emerald-400', bgClass: 'bg-emerald-50 dark:bg-emerald-950/30', borderClass: 'border-emerald-200 dark:border-emerald-800/50',
    });
  }

  if (perdaNUT.perda_pontos >= 2) {
    missoes.push({
      id: 'missao-nutricao', icon: Apple, titulo: 'Comer melhor',
      descricao: 'Pequenas trocas na alimentação fazem diferença.',
      acaoImediata: 'Evite ultraprocessados nas próximas 3 refeições.',
      categoria: 'oportunidade', lossPoints: perdaNUT.perda_pontos, xpRecompensa: 10, completavel: true,
      colorClass: 'text-green-700 dark:text-green-400', bgClass: 'bg-green-50 dark:bg-green-950/30', borderClass: 'border-green-200 dark:border-green-800/50',
    });
  }

  if (perdaP.perda_pontos >= 3) {
    missoes.push({
      id: 'missao-respiracao', icon: Brain, titulo: 'Acalmar a mente',
      descricao: 'Sua cabeça está sob pressão — vale uma pausa.',
      acaoImediata: 'Faça 5 minutos de respiração lenta antes de dormir.',
      categoria: 'urgente', lossPoints: perdaP.perda_pontos, xpRecompensa: 15, completavel: true,
      colorClass: 'text-purple-700 dark:text-purple-400', bgClass: 'bg-purple-50 dark:bg-purple-950/30', borderClass: 'border-purple-200 dark:border-purple-800/50',
    });
  }

  if (perdaERG.perda_pontos >= 2) {
    missoes.push({
      id: 'missao-ergonomia', icon: Monitor, titulo: 'Cuidar da postura',
      descricao: 'Muito tempo na mesma posição cansa o corpo.',
      acaoImediata: 'A cada 50 min, levante e alongue por 2 minutos.',
      categoria: perdaERG.gatilho_critico ? 'urgente' : 'oportunidade',
      lossPoints: perdaERG.perda_pontos, xpRecompensa: 10, completavel: true,
      colorClass: 'text-violet-700 dark:text-violet-400', bgClass: 'bg-violet-50 dark:bg-violet-950/30', borderClass: 'border-violet-200 dark:border-violet-800/50',
    });
  }

  if (perdaI.perda_pontos >= 2) {
    missoes.push({
      id: 'missao-inercia', icon: Zap, titulo: 'Tirar algo da frente',
      descricao: 'Tarefas pendentes pesam mais do que parecem.',
      acaoImediata: 'Resolva uma tarefa que está te estressando hoje.',
      categoria: 'oportunidade', lossPoints: perdaI.perda_pontos, xpRecompensa: 15, completavel: true,
      colorClass: 'text-orange-700 dark:text-orange-400', bgClass: 'bg-orange-50 dark:bg-orange-950/30', borderClass: 'border-orange-200 dark:border-orange-800/50',
    });
  }

  if (perdaD.perda_pontos >= 8) {
    missoes.push({
      id: 'missao-dor', icon: AlertTriangle, titulo: 'Aliviar a dor',
      descricao: 'Sua dor está alta hoje — vamos cuidar dela.',
      acaoImediata: 'Aplique gelo ou faça relaxamento por 15 minutos.',
      categoria: 'urgente', lossPoints: perdaD.perda_pontos, xpRecompensa: 20, completavel: true,
      colorClass: 'text-red-700 dark:text-red-400', bgClass: 'bg-red-50 dark:bg-red-950/30', borderClass: 'border-red-200 dark:border-red-800/50',
    });
  }

  if (perdaC.perda_pontos >= 4) {
    missoes.push({
      id: 'missao-contexto', icon: Heart, titulo: 'Fazer algo bom pra você',
      descricao: 'Seu dia a dia está pesado — você merece uma pausa.',
      acaoImediata: 'Reserve 10 minutos para algo que te dá prazer.',
      categoria: 'importante', lossPoints: perdaC.perda_pontos, xpRecompensa: 10, completavel: true,
      colorClass: 'text-indigo-700 dark:text-indigo-400', bgClass: 'bg-indigo-50 dark:bg-indigo-950/30', borderClass: 'border-indigo-200 dark:border-indigo-800/50',
    });
  }

  // Positive reinforcements (no loss = strength)
  if (perdaR.perda_pontos === 0) {
    missoes.push({
      id: 'forca-sono', icon: Moon, titulo: '✅ Sono em dia',
      descricao: 'Seu sono está ótimo — continue assim!',
      acaoImediata: 'Manter essa rotina acelera sua recuperação.',
      categoria: 'positivo', lossPoints: 0, xpRecompensa: 5, completavel: false,
      colorClass: 'text-emerald-700 dark:text-emerald-400', bgClass: 'bg-emerald-50 dark:bg-emerald-950/30', borderClass: 'border-emerald-200 dark:border-emerald-800/50',
    });
  }
  if (perdaAF.perda_pontos === 0) {
    missoes.push({
      id: 'forca-atividade', icon: Dumbbell, titulo: '✅ Bem ativo(a)',
      descricao: 'Você está se movimentando bem!',
      acaoImediata: 'Mantenha a constância — está fazendo diferença.',
      categoria: 'positivo', lossPoints: 0, xpRecompensa: 5, completavel: false,
      colorClass: 'text-emerald-700 dark:text-emerald-400', bgClass: 'bg-emerald-50 dark:bg-emerald-950/30', borderClass: 'border-emerald-200 dark:border-emerald-800/50',
    });
  }

  // Sort: urgente > importante > oportunidade > positivo, then by loss
  const order = { urgente: 0, importante: 1, oportunidade: 2, positivo: 3 };
  missoes.sort((a, b) => order[a.categoria] - order[b.categoria] || b.lossPoints - a.lossPoints);

  return missoes;
}

const categoriaLabel: Record<string, string> = {
  urgente: 'Cuidar agora',
  importante: 'Importante',
  oportunidade: 'Boa ideia',
  positivo: 'Ponto forte',
};


export default function PacienteMetasDesafios({ pacienteId }: Props) {
  const [metas, setMetas] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [completedMissions, setCompletedMissions] = useState<Set<string>>(new Set());
  const [celebrate, setCelebrate] = useState(false);
  const { vibrate } = useHaptics();
  const [showDicas, setShowDicas] = useState(true);
  const [showFases, setShowFases] = useState(false);

  // Fetch MyID scores for health missions
  const { data: myidData } = useQuery({
    queryKey: ['metas-myid-scores', pacienteId],
    queryFn: async () => {
      // Try avaliacoes_identidade first
      const { data: avIdentidade } = await supabase
        .from('avaliacoes_identidade')
        .select('myid_score, myid_analysis, score_d, score_efi, score_p, score_i, score_r, score_c, score_n')
        .eq('paciente_id', pacienteId)
        .not('myid_score', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (avIdentidade?.[0]) {
        const av = avIdentidade[0];
        const analysis = av.myid_analysis as any;
        const cs = analysis?.componentScores || analysis?.component_scores || {};
        return {
          scores: {
            D: cs.D ?? (Number(av.score_d) || 0),
            EFI: cs.EFI ?? (Number(av.score_efi) || 0),
            P: cs.P ?? (Number(av.score_p) || 0),
            I: cs.I ?? (Number(av.score_i) || 0),
            R: cs.R ?? (Number(av.score_r) || 0),
            C: cs.C ?? (Number(av.score_c) || 0),
            AF: cs.AF ?? 5, HID: cs.HID ?? 5, NUT: cs.NUT ?? 5, ERG: cs.ERG ?? 5,
            N: cs.N ?? (Number(av.score_n) || 0),
          },
          myidScore: Number(av.myid_score) || 0,
        };
      }

      // Try myid_avaliacoes
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
          scores: {
            D: cs.D ?? 0, EFI: cs.EFI ?? 0, P: cs.P ?? 0, I: cs.I ?? 0,
            R: cs.R ?? 0, C: cs.C ?? 0, AF: cs.AF ?? 5, HID: cs.HID ?? 5,
            NUT: cs.NUT ?? 5, ERG: cs.ERG ?? 5, N: cs.N ?? 0,
          },
          myidScore: rp?.myid_100 ?? rp?.MyID_score ?? 0,
        };
      }

      return null;
    },
  });

  const myidScores = myidData?.scores || null;
  const missoesSaude = useMemo(() => gerarMissoesSaude(myidScores), [myidScores]);
  const insights = useMemo(
    () => myidData?.scores && myidData.myidScore
      ? gerarInsightsClinicosMyID(myidData.scores, myidData.myidScore)
      : null,
    [myidData]
  );

  // Load completed missions from localStorage (daily reset)
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const stored = localStorage.getItem(`missoes_${pacienteId}_${today}`);
    if (stored) {
      try { setCompletedMissions(new Set(JSON.parse(stored))); } catch {}
    }
  }, [pacienteId]);

  const toggleMission = (id: string) => {
    setCompletedMissions(prev => {
      const next = new Set(prev);
      const wasDone = next.has(id);
      if (wasDone) next.delete(id); else next.add(id);
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem(`missoes_${pacienteId}_${today}`, JSON.stringify([...next]));

      // Microceleração ao concluir (não ao desfazer)
      if (!wasDone) {
        vibrate('success');
        setCelebrate(false);
        // pequeno tick pra re-disparar o useEffect do ConfettiBurst
        setTimeout(() => setCelebrate(true), 10);
      }
      return next;
    });
  };

  useEffect(() => {
    const fetchMetas = async () => {
      const now = new Date();
      const weekAgo = subDays(now, 7);
      const metasList: Meta[] = [];

      const [diarioRes, treinosRes, streakRes] = await Promise.all([
        supabase.from('daily_logs')
          .select('id, created_at')
          .eq('paciente_id', pacienteId)
          .gte('created_at', weekAgo.toISOString()),
        supabase.from('studio_treinos')
          .select('id, titulo, frequencia')
          .eq('paciente_id', pacienteId)
          .eq('publicado', true)
          .eq('ativo', true),
        supabase.from('daily_logs')
          .select('created_at')
          .eq('paciente_id', pacienteId)
          .order('created_at', { ascending: false })
          .limit(30),
      ]);

      const diarios = diarioRes.data || [];
      const treinos = treinosRes.data || [];
      const execucoes: any[] = []; // studio_execucoes table not yet created

      let streakCount = 0;
      const streakLogs = streakRes.data || [];
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const checkDate = subDays(today, i);
        const dateStr = checkDate.toISOString().split('T')[0];
        const hasEntry = streakLogs.some(l => l.created_at.startsWith(dateStr));
        if (hasEntry) { streakCount++; } else if (i > 0) { break; }
      }
      setStreak(streakCount);

      const diasDiario = new Set(diarios.map(d => d.created_at.split('T')[0])).size;
      metasList.push({
        id: 'diario-semanal', titulo: 'Diário Consistente',
        descricao: 'Preencha o diário de saúde todos os dias esta semana',
        progresso: Math.min(100, (diasDiario / 7) * 100), meta: 7, atual: diasDiario,
        unidade: 'dias', icon: Heart, cor: 'text-rose-600', concluida: diasDiario >= 7, xpRecompensa: 50,
      });

      const totalTreinosMeta = treinos.reduce((acc, t) => acc + parseInt(t.frequencia?.match(/\d+/)?.[0] || '3'), 0);
      const totalTreinosFeitos = execucoes.length;
      metasList.push({
        id: 'treinos-semanal', titulo: 'Plano de Treino',
        descricao: 'Complete todos os treinos prescritos esta semana',
        progresso: totalTreinosMeta > 0 ? Math.min(100, (totalTreinosFeitos / totalTreinosMeta) * 100) : 0,
        meta: totalTreinosMeta || 3, atual: totalTreinosFeitos,
        unidade: 'treinos', icon: Dumbbell, cor: 'text-blue-600',
        concluida: totalTreinosFeitos >= totalTreinosMeta && totalTreinosMeta > 0, xpRecompensa: 75,
      });

      metasList.push({
        id: 'streak-5', titulo: 'Sequência de 5 Dias',
        descricao: 'Mantenha 5 dias consecutivos de diário preenchido',
        progresso: Math.min(100, (streakCount / 5) * 100), meta: 5, atual: streakCount,
        unidade: 'dias seguidos', icon: Flame, cor: 'text-orange-600',
        concluida: streakCount >= 5, xpRecompensa: 100,
      });

      setMetas(metasList);
      setLoading(false);
    };

    fetchMetas();
  }, [pacienteId]);

  if (loading) return null;

  const concluidas = metas.filter(m => m.concluida).length;
  const progressoGeral = metas.length > 0
    ? metas.reduce((acc, m) => acc + m.progresso, 0) / metas.length
    : 0;

  const missoesConcluiveis = missoesSaude.filter(m => m.completavel);
  const missoesPositivas = missoesSaude.filter(m => m.categoria === 'positivo');
  const missoesConcluidas = missoesConcluiveis.filter(m => completedMissions.has(m.id)).length;

  return (
    <div className="space-y-4">
      <ConfettiBurst trigger={celebrate} duration={2200} pieces={24} />
      {/* Header com streak */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Suas metas da semana</h2>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30">
            <Flame className="h-3 w-3 text-orange-600" />
            <span className="text-[10px] font-black text-orange-600">{streak} dias seguidos</span>
          </div>
        )}
      </div>


      {/* Progresso geral metas semanais */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/15">
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-foreground">
              {concluidas}/{metas.length} metas concluídas
            </span>
            <span className="text-[10px] font-bold text-primary">{progressoGeral.toFixed(0)}%</span>
          </div>
          <Progress value={progressoGeral} className="h-2" />
          {concluidas === metas.length && metas.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <Trophy className="icon-sm text-yellow-600" />
              <span className="text-[10px] font-bold text-yellow-700">
                Todas as metas concluídas! 🎉 +{metas.reduce((a, m) => a + m.xpRecompensa, 0)} XP
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de metas semanais */}
      {metas.map(meta => (
        <Card key={meta.id} className={meta.concluida ? 'opacity-75' : ''}>
          <CardContent className="p-3">
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                meta.concluida ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-muted'
              }`}>
                {meta.concluida ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <meta.icon className={`h-4 w-4 ${meta.cor}`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className={`text-xs font-bold ${meta.concluida ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {meta.titulo}
                  </p>
                  <Badge variant="outline" className="text-[8px] py-0 h-4 gap-0.5">
                    <Zap className="h-2 w-2" /> +{meta.xpRecompensa} XP
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mb-1.5">{meta.descricao}</p>
                <div className="flex items-center gap-2">
                  <Progress value={meta.progresso} className="h-1.5 flex-1" />
                  <span className="text-[10px] font-bold text-muted-foreground shrink-0">
                    {meta.atual}/{meta.meta} {meta.unidade}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* ── MISSÕES DE SAÚDE (Baseadas no MyID) ── */}
      {missoesConcluiveis.length > 0 && (
        <div className="space-y-3 pt-2">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowDicas(!showDicas)}
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground">Seu plano de hoje</h2>
            </div>

            <div className="flex items-center gap-2">
              {missoesConcluidas > 0 && (
                <span className="text-[10px] font-bold text-emerald-600">
                  {missoesConcluidas}/{missoesConcluiveis.length} ✓
                </span>
              )}
              {showDicas ? <ChevronUp className="icon-sm text-muted-foreground" /> : <ChevronDown className="icon-sm text-muted-foreground" />}
            </div>
          </div>

          {showDicas && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              {/* Missions progress */}
              {missoesConcluiveis.length > 0 && (
                <Card className="bg-violet-600 border-0 shadow-lg shadow-violet-200 dark:shadow-none overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-white/90">
                        {missoesConcluidas}/{missoesConcluiveis.length} missões do dia
                      </span>
                      <span className="text-[10px] font-bold text-white/60">
                        +{missoesConcluiveis.filter(m => completedMissions.has(m.id)).reduce((a, m) => a + m.xpRecompensa, 0)} XP ganho
                      </span>
                    </div>
                    <Progress
                      value={missoesConcluiveis.length > 0 ? (missoesConcluidas / missoesConcluiveis.length) * 100 : 0}
                      className="h-2 bg-white/20 [&>div]:bg-white"
                    />
                    {missoesConcluidas === missoesConcluiveis.length && missoesConcluiveis.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <Sparkles className="h-3 w-3 text-yellow-300" />
                        <span className="text-[10px] font-bold text-yellow-200">
                          Todas as missões do dia concluídas! 🎉
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Actionable missions */}
              {missoesConcluiveis.map(missao => {
                const isDone = completedMissions.has(missao.id);
                const Icon = missao.icon;
                return (
                  <Card
                    key={missao.id}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-sm active:scale-[0.99]",
                      isDone && "opacity-60",
                      missao.borderClass
                    )}
                    onClick={() => toggleMission(missao.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                          isDone ? 'bg-emerald-100 dark:bg-emerald-900/30' : missao.bgClass
                        )}>
                          {isDone ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Icon className={cn("h-4 w-4", missao.colorClass)} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className={cn("text-xs font-bold", isDone ? 'line-through text-muted-foreground' : missao.colorClass)}>
                              {missao.titulo}
                            </span>
                            <span className={cn("text-[8px] font-black px-1.5 py-0.5 rounded-full", missao.bgClass, missao.colorClass)}>
                              {categoriaLabel[missao.categoria]}
                            </span>
                            <Badge variant="outline" className="text-[8px] py-0 h-4 gap-0.5 ml-auto">
                              <Zap className="h-2 w-2" /> +{missao.xpRecompensa} XP
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground mb-0.5">{missao.descricao}</p>
                          <p className={cn("text-[10px] font-medium", isDone ? 'text-emerald-600' : 'text-foreground/70')}>
                            {isDone ? '✅ Missão concluída!' : `👉 ${missao.acaoImediata}`}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Pontos fortes */}
              {missoesPositivas.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-2">
                    <Heart className="h-3 w-3 text-emerald-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Seus Pontos Fortes</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    {missoesPositivas.map(m => (
                      <div key={m.id} className={cn("p-2.5 rounded-xl border", m.bgClass, m.borderClass)}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <m.icon className={cn("h-3 w-3", m.colorClass)} />
                          <span className={cn("text-[11px] font-bold", m.colorClass)}>{m.titulo}</span>
                        </div>
                        <p className="text-[10px] text-foreground/70">{m.acaoImediata}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── PLANO DE AÇÃO POR FASES (Clinical Insights) ── */}
      {insights && (
        <div className="space-y-3 pt-2">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowFases(!showFases)}
          >
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground">Seu Plano de Evolução</h2>
              {insights.driverInsight && (
                <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-bold border-primary/20 text-primary">
                  Foco: {insights.driverInsight.driverLabel}
                </Badge>
              )}
            </div>
            {showFases ? <ChevronUp className="icon-sm text-muted-foreground" /> : <ChevronDown className="icon-sm text-muted-foreground" />}
          </div>

          {showFases && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              {/* Driver card */}
              {insights.driverInsight && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="icon-sm text-primary" />
                      <span className="text-[11px] font-bold text-primary">
                        Prioridade: {insights.driverInsight.driverLabel} (−{insights.driverInsight.perda}pts)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {insights.driverInsight.intervencoes.slice(0, 3).map((i, idx) => (
                        <span key={idx} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          {i}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Treatment Phases */}
              {insights.fases.map(fase => (
                <Card key={fase.fase} className="border-border">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">{fase.icone}</span>
                      <span className="text-xs font-bold text-foreground">Fase {fase.fase}: {fase.titulo}</span>
                      <span className="text-[10px] text-muted-foreground">({fase.semanas})</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-2 font-medium">{fase.foco}</p>
                    <div className="flex flex-wrap gap-1">
                      {fase.intervencoes.slice(0, 4).map((interv, idx) => (
                        <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border text-foreground/70 flex items-center gap-1">
                          <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                          {interv}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-border/50">
                      <span className="text-[10px] font-bold text-primary">{fase.metaMyID}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Milestone missions */}
              <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/15">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold text-foreground">Marcos de Evolução</span>
                  </div>
                  <div className="space-y-1.5">
                    {insights.missoes.filter(m => m.tipo === 'marco').map(missao => (
                      <div key={missao.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-background/50">
                        <Trophy className="h-3 w-3 text-primary/60 shrink-0" />
                        <span className="text-[10px] text-foreground/70 flex-1">{missao.titulo}</span>
                        <Badge variant="outline" className="text-[8px] py-0 h-4 gap-0.5">
                          <Zap className="h-2 w-2" /> +{missao.xp} XP
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-primary font-bold mt-2 text-center">
                    🎯 {insights.metaFinal}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
