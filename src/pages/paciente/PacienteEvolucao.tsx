import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, TrendingUp, TrendingDown, Minus, Zap, Brain, Target, Flame, AlertTriangle, ChevronRight, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, Legend, BarChart, Bar, Cell
} from 'recharts';
import {
  type DailyLogEntry,
  calculateWellnessSeries,
  analyzeWellnessTrend,
  generateAlerts,
  getWellnessLevel,
  projectNextMyID,
  estimateMyIDCorrelation,
  type WellnessSnapshot,
  type WellnessTrend,
  type WellnessAlert,
  type MyIDCorrelation,
} from '@/utils/wellnessIndex';

interface MyIDScore {
  date: string;
  myid_score: number;
  score_d?: number;
  score_f?: number;
  score_p?: number;
  score_e?: number;
  score_efi?: number;
  id_final?: number;
}

export default function PacienteEvolucao() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<DailyLogEntry[]>([]);
  const [myidScores, setMyidScores] = useState<MyIDScore[]>([]);
  const [notas, setNotas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pacienteId, setPacienteId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: pac } = await supabase
        .from('pacientes')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!pac) { setLoading(false); return; }
      setPacienteId(pac.id);

      const [logsRes, evolRes, notasRes] = await Promise.all([
        supabase.from('daily_logs').select('*').eq('paciente_id', pac.id)
          .order('created_at', { ascending: true }).limit(90),
        supabase.from('evolucao_paciente').select('*').eq('paciente_id', pac.id)
          .order('data_registro', { ascending: true }),
        (supabase as any).from('notas_prontuario').select('*').eq('paciente_id', pac.id)
          .order('created_at', { ascending: false }).limit(50),
      ]);

      setLogs((logsRes.data as DailyLogEntry[]) || []);
      setMyidScores(
        (evolRes.data || []).map((e: any) => ({
          date: e.data_registro,
          myid_score: e.myid_score ?? e.id_final ?? 0,
          score_d: e.score_d,
          score_f: e.score_f,
          score_p: e.score_p,
          score_e: e.score_e,
          score_efi: e.score_efi,
          id_final: e.id_final,
        }))
      );
      setNotas(notasRes.data || []);
      setLoading(false);
    })();
  }, [user]);

  const snapshots = useMemo(() => calculateWellnessSeries(logs), [logs]);
  const trend = useMemo(() => analyzeWellnessTrend(snapshots), [snapshots]);
  const alerts = useMemo(() => generateAlerts(logs, trend), [logs, trend]);
  const correlations = useMemo(() => estimateMyIDCorrelation(snapshots, myidScores), [snapshots, myidScores]);
  const currentLevel = useMemo(() => getWellnessLevel(trend.weekAvg), [trend]);
  const projection = useMemo(() => {
    const lastMyID = myidScores.length > 0 ? myidScores[myidScores.length - 1].myid_score : 0;
    return projectNextMyID(lastMyID, trend, trend.weekAvg);
  }, [myidScores, trend]);

  const chartData = useMemo(() => {
    return snapshots.slice(-30).map(s => ({
      date: format(parseISO(s.date), 'dd/MM'),
      'Bem-Estar': s.index,
      'Dor (inv)': s.painNorm,
      Humor: s.moodNorm,
      Energia: s.energyNorm,
      Sono: s.sleepNorm,
    }));
  }, [snapshots]);

  const radarData = useMemo(() => {
    if (snapshots.length === 0) return [];
    const recent = snapshots.slice(-7);
    const avg = (key: keyof WellnessSnapshot) =>
      Math.round(recent.reduce((s, x) => s + (x[key] as number), 0) / recent.length);
    return [
      { dim: 'Humor', value: avg('moodNorm'), fullMark: 100 },
      { dim: 'Dor (inv)', value: avg('painNorm'), fullMark: 100 },
      { dim: 'Energia', value: avg('energyNorm'), fullMark: 100 },
      { dim: 'Sono', value: avg('sleepNorm'), fullMark: 100 },
    ];
  }, [snapshots]);

  if (loading) {
    return (
      <ProtectedPatientRoute>
        <PacienteLayout>
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </PacienteLayout>
      </ProtectedPatientRoute>
    );
  }

  const TrendIcon = trend.direction === 'improving' ? TrendingUp : trend.direction === 'declining' ? TrendingDown : Minus;
  const trendColor = trend.direction === 'improving' ? 'text-emerald-600' : trend.direction === 'declining' ? 'text-red-500' : 'text-muted-foreground';

  const TIPO_ICON: Record<string, string> = {
    myid_resposta: '📋', avaliacao_profissional: '🩺', sessao_confirmada: '✅',
    diario_paciente: '📱', treino_executado: '🏋️', conduta_diretriz: '🧠', geral: '📝',
    avaliacao_voz: '🎙️',
  };

  return (
    <ProtectedPatientRoute>
      <PacienteLayout>
        <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
          <div>
            <h1 className="text-lg font-black text-foreground flex items-center gap-2">
              <Flame className="h-5 w-5 text-primary" />
              Evolução e Prontuários
            </h1>
            <p className="text-xs text-muted-foreground">Seu bem-estar diário e histórico clínico</p>
          </div>

          <Tabs defaultValue="evolucao" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-10">
              <TabsTrigger value="evolucao" className="gap-1.5 text-xs">
                <TrendingUp className="icon-sm" /> Evolução
              </TabsTrigger>
              <TabsTrigger value="prontuario" className="gap-1.5 text-xs">
                <FileText className="icon-sm" /> Prontuário
              </TabsTrigger>
            </TabsList>

            <TabsContent value="evolucao" className="mt-4 space-y-5">
              {/* Main wellness gauge */}
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Índice de Bem-Estar</p>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-4xl font-black text-foreground">{trend.weekAvg}</span>
                        <span className="text-lg text-muted-foreground">/100</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <TrendIcon className={`icon-sm ${trendColor}`} />
                        <span className={`text-xs font-bold ${trendColor}`}>
                          {trend.delta > 0 ? '+' : ''}{trend.delta} pts vs semana anterior
                        </span>
                      </div>
                    </div>
                    <div className="text-center">
                      <span className="text-4xl">{currentLevel.emoji}</span>
                      <p className={`text-xs font-bold mt-1 ${currentLevel.color}`}>{currentLevel.label}</p>
                      {trend.streak > 0 && (
                        <Badge variant="outline" className="mt-1 text-[9px] gap-0.5 border-amber-200 text-amber-700 bg-amber-50">
                          <Flame className="h-2.5 w-2.5" /> {trend.streak}d
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Alerts */}
              {alerts.length > 0 && (
                <div className="space-y-2">
                  {alerts.map((alert, i) => (
                    <Card key={i} className={`${
                      alert.type === 'critical' ? 'border-red-200 bg-red-50/50' :
                      alert.type === 'warning' ? 'border-amber-200 bg-amber-50/50' :
                      'border-emerald-200 bg-emerald-50/50'
                    }`}>
                      <CardContent className="p-3 flex items-start gap-2.5">
                        <span className="text-lg shrink-0">{alert.icon}</span>
                        <div>
                          <p className="text-xs font-bold text-foreground">{alert.title}</p>
                          <p className="text-[11px] text-muted-foreground">{alert.message}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Wellness Trend Chart */}
              {chartData.length >= 3 && (
                <Card>
                  <CardContent className="p-4">
                    <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Evolução do Bem-Estar
                    </h2>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                          <defs>
                            <linearGradient id="wellnessGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                          <YAxis tick={{ fontSize: 9 }} domain={[0, 100]} />
                          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                          <Area type="monotone" dataKey="Bem-Estar" stroke="hsl(var(--primary))" fill="url(#wellnessGrad)" strokeWidth={2.5} dot={{ r: 2 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Radar: Current Profile */}
              {radarData.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      Perfil Semanal
                    </h2>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarData}>
                          <PolarGrid stroke="hsl(var(--border))" />
                          <PolarAngleAxis dataKey="dim" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 8 }} />
                          <Radar name="Atual" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} strokeWidth={2} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* MyID Correlation */}
              {correlations.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                      <Brain className="h-4 w-4 text-primary" />
                      Conexão Diário → MyID
                    </h2>
                    <div className="space-y-3">
                      {correlations.map(c => (
                        <div key={c.dimension} className="flex items-start gap-3">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-black ${
                            c.correlation > 0.6 ? 'bg-emerald-100 text-emerald-700' :
                            c.correlation > 0.3 ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {c.dimension}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-foreground">{c.label}</span>
                              <span className={`text-[10px] font-bold ${
                                c.correlation > 0.6 ? 'text-emerald-600' : c.correlation > 0.3 ? 'text-amber-600' : 'text-red-500'
                              }`}>
                                {c.correlation > 0.6 ? 'Alta' : c.correlation > 0.3 ? 'Média' : 'Baixa'} conexão
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{c.insight}</p>
                            <div className="w-full h-1.5 rounded-full bg-muted mt-1.5">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  c.correlation > 0.6 ? 'bg-emerald-500' : c.correlation > 0.3 ? 'bg-amber-500' : 'bg-red-400'
                                }`}
                                style={{ width: `${c.correlation * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Projection */}
              {myidScores.length > 0 && (
                <Card className="border-primary/20">
                  <CardContent className="p-4">
                    <h2 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      Projeção MyID
                    </h2>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground">Atual</p>
                        <span className="text-2xl font-black text-foreground">
                          {Math.round(myidScores[myidScores.length - 1].myid_score)}
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground">Projetado</p>
                        <span className={`text-2xl font-black ${
                          projection.projected > myidScores[myidScores.length - 1].myid_score
                            ? 'text-emerald-600' : 'text-foreground'
                        }`}>
                          {projection.projected}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[9px] ml-auto">
                        Confiança: {projection.confidence}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2 italic">{projection.message}</p>
                  </CardContent>
                </Card>
              )}

              {/* Empty state */}
              {logs.length < 3 && (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Flame className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">
                      {logs.length === 0 ? 'Comece registrando no Diário de Saúde' : `Mais ${3 - logs.length} registro(s) para ativar a Evolução`}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Quanto mais registros, mais precisa será sua evolução.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="prontuario" className="mt-4 space-y-3">
              {notas.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">Nenhum registro no prontuário</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Os registros clínicos aparecerão aqui automaticamente.</p>
                  </CardContent>
                </Card>
              ) : (
                notas.map((nota: any) => (
                  <Card key={nota.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-lg shrink-0">{TIPO_ICON[nota.tipo] || '📝'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-xs font-bold text-foreground truncate">{nota.titulo}</h3>
                          </div>
                          <p className="text-[10px] text-muted-foreground mb-2">
                            {format(parseISO(nota.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                          <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                            {nota.descricao}
                          </pre>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
