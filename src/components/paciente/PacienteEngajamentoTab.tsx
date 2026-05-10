import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Heart, Moon, Zap, AlertTriangle, Flame, Dumbbell,
  TrendingUp, TrendingDown, Minus, Calendar, Loader2,
  CheckCircle2, XCircle, SmilePlus
} from 'lucide-react';
import { format, parseISO, subDays, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar
} from 'recharts';
import { calculateWellnessIndex, analyzeWellnessTrend, WellnessSnapshot } from '@/utils/wellnessIndex';

interface Props {
  pacienteId: string;
  pacienteNome: string;
}

export default function PacienteEngajamentoTab({ pacienteId, pacienteNome }: Props) {
  const { user } = useAuth();

  // Daily logs from the last 30 days
  const { data: dailyLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['engajamento-daily-logs', pacienteId],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('paciente_id', pacienteId)
        .gte('created_at', since)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Exercise executions from the last 30 days
  const { data: execucoes = [], isLoading: loadingExec } = useQuery({
    queryKey: ['engajamento-execucoes', pacienteId],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      const { data, error } = await supabase
        .from('studio_execucoes')
        .select('*, treino:treino_id(titulo)')
        .eq('paciente_id', pacienteId)
        .gte('created_at', since)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!user,
  });

  const isLoading = loadingLogs || loadingExec;

  // Calculate wellness snapshots
  const snapshots: WellnessSnapshot[] = dailyLogs.map((log: any) => calculateWellnessIndex(log));
  const trendData = analyzeWellnessTrend(snapshots);
  const trend = trendData.slope;

  // Averages
  const avgMood = dailyLogs.length > 0 ? dailyLogs.reduce((s: number, l: any) => s + l.mood, 0) / dailyLogs.length : 0;
  const avgPain = dailyLogs.length > 0 ? dailyLogs.reduce((s: number, l: any) => s + l.pain, 0) / dailyLogs.length : 0;
  const avgEnergy = dailyLogs.length > 0 ? dailyLogs.reduce((s: number, l: any) => s + l.energy, 0) / dailyLogs.length : 0;
  const avgSleep = dailyLogs.length > 0 ? dailyLogs.reduce((s: number, l: any) => s + Number(l.sleep_hours), 0) / dailyLogs.length : 0;

  const currentIdx = snapshots.length > 0 ? snapshots[snapshots.length - 1].index : 0;

  // Smart alerts
  const alerts: { icon: any; text: string; severity: 'warning' | 'danger' | 'success' }[] = [];
  const recentLogs = dailyLogs.slice(-7);
  const highPainDays = recentLogs.filter((l: any) => l.pain >= 7).length;
  const lowSleepDays = recentLogs.filter((l: any) => Number(l.sleep_hours) < 5).length;
  const consecutiveLogs = dailyLogs.length;

  if (highPainDays >= 3) alerts.push({ icon: AlertTriangle, text: `Dor alta (≥7) em ${highPainDays} dos últimos 7 dias`, severity: 'danger' });
  if (lowSleepDays >= 3) alerts.push({ icon: Moon, text: `Sono insuficiente (<5h) em ${lowSleepDays} dos últimos 7 dias`, severity: 'warning' });
  if (consecutiveLogs >= 7) alerts.push({ icon: Flame, text: `${consecutiveLogs} registros no diário — boa adesão!`, severity: 'success' });
  if (execucoes.length >= 3 && execucoes.filter((e: any) => e.completo).length >= 3) {
    alerts.push({ icon: Dumbbell, text: `${execucoes.filter((e: any) => e.completo).length} treinos completos nos últimos 30 dias`, severity: 'success' });
  }
  if (dailyLogs.length === 0) alerts.push({ icon: XCircle, text: 'Paciente não registrou o diário neste período', severity: 'warning' });

  // Chart data
  const chartData = snapshots.map(s => ({
    date: format(parseISO(s.date), 'dd/MM', { locale: ptBR }),
    index: s.index,
  }));

  // Radar data
  const radarData = [
    { subject: 'Humor', value: (avgMood / 5) * 100 },
    { subject: 'Dor (inv)', value: ((10 - avgPain) / 10) * 100 },
    { subject: 'Energia', value: (avgEnergy / 5) * 100 },
    { subject: 'Sono', value: Math.min(100, (avgSleep / 9) * 100) },
  ];

  // Exercise stats
  const treinosCompletos = execucoes.filter((e: any) => e.completo).length;
  const treinosTotal = execucoes.length;
  const avgDor = execucoes.length > 0 ? execucoes.reduce((s: number, e: any) => s + (e.nota_dor || 0), 0) / execucoes.length : 0;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-primary/5 to-transparent p-4 rounded-xl border border-dashed border-primary/20">
        <div>
          <h3 className="text-sm font-black text-foreground tracking-tight uppercase">Engajamento do Paciente</h3>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5">Últimos 30 dias — Dados do Portal</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black text-primary">{currentIdx}</span>
          <p className="text-[9px] text-muted-foreground font-bold uppercase">Índice Bem-Estar</p>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-1.5">
          {alerts.map((alert, i) => (
            <div key={i} className={`flex items-center gap-2 p-2.5 rounded-lg text-xs font-medium ${
              alert.severity === 'danger' ? 'bg-destructive/10 text-destructive' :
              alert.severity === 'warning' ? 'bg-amber-50 text-amber-700' :
              'bg-emerald-50 text-emerald-700'
            }`}>
              <alert.icon className="icon-sm shrink-0" />
              {alert.text}
            </div>
          ))}
        </div>
      )}

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <Heart className="h-4 w-4 text-red-400 mx-auto mb-1" />
            <p className="text-lg font-black text-foreground">{avgPain.toFixed(1)}</p>
            <p className="text-[9px] text-muted-foreground uppercase font-bold">Dor Média</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <SmilePlus className="h-4 w-4 text-amber-500 mx-auto mb-1" />
            <p className="text-lg font-black text-foreground">{avgMood.toFixed(1)}</p>
            <p className="text-[9px] text-muted-foreground uppercase font-bold">Humor Médio</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Zap className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
            <p className="text-lg font-black text-foreground">{avgEnergy.toFixed(1)}</p>
            <p className="text-[9px] text-muted-foreground uppercase font-bold">Energia Média</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Moon className="h-4 w-4 text-indigo-400 mx-auto mb-1" />
            <p className="text-lg font-black text-foreground">{avgSleep.toFixed(1)}h</p>
            <p className="text-[9px] text-muted-foreground uppercase font-bold">Sono Médio</p>
          </CardContent>
        </Card>
      </div>

      {/* Wellness Trend Chart */}
      {chartData.length > 2 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-foreground uppercase">Índice de Bem-Estar</span>
              <div className="flex items-center gap-1 text-[10px]">
                {trend > 0.3 ? <TrendingUp className="h-3 w-3 text-emerald-500" /> :
                 trend < -0.3 ? <TrendingDown className="h-3 w-3 text-red-500" /> :
                 <Minus className="h-3 w-3 text-muted-foreground" />}
                <span className={trend > 0.3 ? 'text-emerald-600 font-bold' : trend < -0.3 ? 'text-red-500 font-bold' : 'text-muted-foreground'}>
                  {trend > 0 ? '+' : ''}{trend.toFixed(2)}/dia
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="wellnessGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} width={25} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="index" stroke="hsl(var(--primary))" fill="url(#wellnessGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Radar + Exercise Stats side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Radar */}
        {dailyLogs.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <span className="text-xs font-bold text-foreground uppercase block mb-2">Perfil Semanal</span>
              <ResponsiveContainer width="100%" height={160}>
                <RadarChart data={radarData}>
                  <PolarGrid strokeDasharray="3 3" opacity={0.2} />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Exercise Summary */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Dumbbell className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold text-foreground uppercase">Treinos</span>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-muted-foreground">Completados</span>
                  <span className="font-bold text-foreground">{treinosCompletos}/{treinosTotal}</span>
                </div>
                <Progress value={treinosTotal > 0 ? (treinosCompletos / treinosTotal) * 100 : 0} className="h-1.5" />
              </div>
              <div className="text-[10px] text-muted-foreground">
                <span>Dor média intra-treino: </span>
                <span className={`font-bold ${avgDor > 5 ? 'text-red-500' : avgDor > 3 ? 'text-amber-500' : 'text-emerald-600'}`}>
                  {avgDor.toFixed(1)}/10
                </span>
              </div>
              {/* Recent executions */}
              {execucoes.slice(0, 4).map((ex: any) => (
                <div key={ex.id} className="flex items-center justify-between py-1 border-b border-border last:border-0 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    {ex.completo ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-muted-foreground" />}
                    <span className="text-foreground font-medium truncate max-w-[100px]">{(ex.treino as any)?.titulo || 'Treino'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {ex.nota_dor != null && (
                      <span className={ex.nota_dor > 5 ? 'text-red-500 font-bold' : 'text-muted-foreground'}>
                        Dor: {ex.nota_dor}
                      </span>
                    )}
                    <span className="text-muted-foreground">
                      {ex.data_execucao ? format(parseISO(ex.data_execucao), 'd MMM', { locale: ptBR }) : '—'}
                    </span>
                  </div>
                </div>
              ))}
              {execucoes.length === 0 && (
                <p className="text-[10px] text-muted-foreground italic">Nenhum treino registrado neste período.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Log Timeline */}
      {dailyLogs.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <span className="text-xs font-bold text-foreground uppercase block mb-3">Registros Recentes do Diário</span>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {[...dailyLogs].reverse().slice(0, 10).map((log: any) => (
                <div key={log.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 text-[10px]">
                  <span className="text-muted-foreground w-12 shrink-0 font-medium">
                    {format(parseISO(log.created_at), 'dd/MM', { locale: ptBR })}
                  </span>
                  <div className="flex items-center gap-2 flex-1 flex-wrap">
                    <Badge variant="outline" className="text-[9px] py-0 h-4">
                      Dor {log.pain}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] py-0 h-4">
                      Humor {log.mood}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] py-0 h-4">
                      Energia {log.energy}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] py-0 h-4">
                      Sono {Number(log.sleep_hours).toFixed(0)}h
                    </Badge>
                  </div>
                  {log.notes && (
                    <span className="text-muted-foreground italic truncate max-w-[80px]" title={log.notes}>
                      📝 {log.notes}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {dailyLogs.length === 0 && execucoes.length === 0 && (
        <div className="text-center py-12 text-muted-foreground border rounded-xl border-dashed">
          <Heart className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sem dados de engajamento</p>
          <p className="text-sm mt-1">
            Quando o paciente usar o portal (diário, treinos), os dados aparecerão aqui.
          </p>
        </div>
      )}
    </div>
  );
}
