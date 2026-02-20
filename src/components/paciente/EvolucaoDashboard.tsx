import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart3, Activity, Calendar, Target, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, Cell,
} from 'recharts';

const SCORE_LABELS: Record<string, string> = {
  score_e: 'Estrutural',
  score_p: 'Cinesiofobia',
  score_c: 'Carga Contextual',
  score_f: 'Contextual',
  score_d: 'Dor',
  score_r: 'Regulação',
  score_efi: 'Funcionalidade',
};

const SCORE_KEYS = ['score_e', 'score_p', 'score_c', 'score_f', 'score_d', 'score_r', 'score_efi'];
const SCORE_COLORS: Record<string, string> = {
  score_e: '#3b82f6',
  score_p: '#f59e0b',
  score_c: '#06b6d4',
  score_f: '#10b981',
  score_d: '#ef4444',
  score_r: '#8b5cf6',
  score_efi: '#ec4899',
};

interface Avaliacao {
  id: string;
  data_avaliacao: string;
  classificacao?: string | null;
  id_final?: number | null;
  score_e?: number | null;
  score_p?: number | null;
  score_c?: number | null;
  score_f?: number | null;
  score_d?: number | null;
  score_r?: number | null;
  score_efi?: number | null;
  created_at: string;
}

interface Props {
  avaliacoes: Avaliacao[];
}

export default function EvolucaoDashboard({ avaliacoes }: Props) {
  const sorted = useMemo(() => [...avaliacoes].reverse(), [avaliacoes]);

  const primeira = sorted[0];
  const ultima = sorted[sorted.length - 1];

  // Summary stats
  const totalAvaliacoes = sorted.length;
  const idFinalAtual = ultima?.id_final ?? 0;
  const idFinalInicial = primeira?.id_final ?? 0;
  const deltaID = Number((idFinalAtual - idFinalInicial).toFixed(1));
  const classificacaoAtual = ultima?.classificacao || '—';

  // Radar data (última avaliação)
  const radarData = SCORE_KEYS.slice(0, 6).map(key => ({
    score: SCORE_LABELS[key],
    atual: Number(((ultima as any)?.[key] || 0).toFixed(1)),
    inicial: Number(((primeira as any)?.[key] || 0).toFixed(1)),
  }));

  // Evolution line data
  const evolucaoData = sorted.map((av, i) => ({
    name: `Av. ${i + 1}`,
    data: av.data_avaliacao,
    ID: Number((av.id_final || 0).toFixed(1)),
    E: Number((av.score_e || 0).toFixed(1)),
    P: Number((av.score_p || 0).toFixed(1)),
    C: Number((av.score_c || 0).toFixed(1)),
    F: Number((av.score_f || 0).toFixed(1)),
    D: Number((av.score_d || 0).toFixed(1)),
    R: Number((av.score_r || 0).toFixed(1)),
  }));

  // Comparison bar data
  const comparisonData = SCORE_KEYS.map(key => ({
    score: key.replace('score_', '').toUpperCase(),
    Primeira: Number(((primeira as any)?.[key] || 0).toFixed(1)),
    Última: Number(((ultima as any)?.[key] || 0).toFixed(1)),
    delta: Number((((ultima as any)?.[key] || 0) - ((primeira as any)?.[key] || 0)).toFixed(1)),
  }));

  // Per-score deltas for the delta row
  const scoreDeltaData = SCORE_KEYS.map(key => {
    const first = (primeira as any)?.[key] || 0;
    const last = (ultima as any)?.[key] || 0;
    const delta = Number((last - first).toFixed(1));
    return {
      key: key.replace('score_', '').toUpperCase(),
      first: Number(first.toFixed(1)),
      last: Number(last.toFixed(1)),
      delta,
      color: SCORE_COLORS[key],
    };
  });

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          label="Avaliações"
          value={totalAvaliacoes}
          icon={<Activity className="h-4 w-4" />}
          accent="primary"
        />
        <SummaryCard
          label="ID Final Atual"
          value={`${idFinalAtual.toFixed(1)}/50`}
          icon={<Target className="h-4 w-4" />}
          accent="info"
        />
        <SummaryCard
          label="Classificação"
          value={classificacaoAtual}
          icon={<Award className="h-4 w-4" />}
          accent="warning"
        />
        <SummaryCard
          label="Variação ID"
          value={`${deltaID > 0 ? '+' : ''}${deltaID}`}
          icon={deltaID <= 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
          accent={deltaID <= 0 ? 'success' : 'danger'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Radar: Primeira vs Última */}
        <div className="clinical-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm">Perfil Comparativo</h4>
            </div>
            <Badge variant="outline" className="text-[10px]">1ª vs Última</Badge>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid className="stroke-border" />
                <PolarAngleAxis dataKey="score" tick={{ fontSize: 10 }} />
                <Radar name="Primeira" dataKey="inicial" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.15} strokeDasharray="4 4" />
                <Radar name="Atual" dataKey="atual" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Evolution Line Chart */}
        <div className="clinical-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm">Evolução dos Scores</h4>
            </div>
            <Badge variant="outline" className="text-[10px]">{evolucaoData.length} avaliações</Badge>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucaoData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  labelFormatter={(label, payload) => {
                    const d = payload?.[0]?.payload?.data;
                    return d ? `${label} — ${d}` : label;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="ID" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} name="ID Final" />
                <Line type="monotone" dataKey="E" stroke="#3b82f6" strokeWidth={1.5} dot={{ r: 3 }} name="Estrutural" />
                <Line type="monotone" dataKey="D" stroke="#ef4444" strokeWidth={1.5} dot={{ r: 3 }} name="Dor" />
                <Line type="monotone" dataKey="P" stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 3 }} name="Kinesiophobia" />
                <Line type="monotone" dataKey="F" stroke="#10b981" strokeWidth={1.5} dot={{ r: 3 }} name="Funcional" />
                <Line type="monotone" dataKey="R" stroke="#8b5cf6" strokeWidth={1.5} dot={{ r: 3 }} name="Regulação" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Comparison Bar Chart */}
      <div className="clinical-card">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm">Comparação: Primeira vs Última Avaliação</h4>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="score" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="Primeira" fill="#94a3b8" radius={[4, 4, 0, 0]} opacity={0.6} />
              <Bar dataKey="Última" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Delta Indicators */}
      <div className="clinical-card">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm">Variação por Score</h4>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {scoreDeltaData.map(s => (
            <div key={s.key} className="bg-muted/50 rounded-xl p-3 text-center border border-border/50">
              <div className="flex items-center justify-center gap-1 mb-1">
                <div className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                <span className="text-xs font-semibold text-muted-foreground">{s.key}</span>
              </div>
              <div className="text-lg font-bold text-foreground">{s.last}</div>
              <div className="flex items-center justify-center gap-1 mt-1">
                {s.delta < 0 ? (
                  <TrendingDown className="h-3 w-3 text-emerald-600" />
                ) : s.delta > 0 ? (
                  <TrendingUp className="h-3 w-3 text-red-500" />
                ) : (
                  <Minus className="h-3 w-3 text-muted-foreground" />
                )}
                <span className={`text-xs font-bold ${s.delta < 0 ? 'text-emerald-600' : s.delta > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {s.delta > 0 ? '+' : ''}{s.delta}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">de {s.first}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="clinical-card">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm">Linha do Tempo</h4>
        </div>
        <div className="space-y-2">
          {[...avaliacoes].map((av, idx) => {
            const num = avaliacoes.length - idx;
            const isLatest = idx === 0;
            return (
              <div key={av.id} className={`rounded-xl border p-3 flex items-center gap-3 transition-all ${isLatest ? 'border-primary bg-accent/20' : 'hover:bg-accent/10'}`}>
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${isLatest ? 'bg-primary/20' : 'bg-muted'}`}>
                  <span className={`text-sm font-bold ${isLatest ? 'text-primary' : 'text-muted-foreground'}`}>{num}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{av.data_avaliacao}</span>
                    {av.classificacao && (
                      <Badge variant="outline" className="text-[10px] h-4">{av.classificacao}</Badge>
                    )}
                    {isLatest && (
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] h-4">Mais recente</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    ID: {(av.id_final || 0).toFixed(1)}/50 · E:{(av.score_e || 0).toFixed(1)} P:{(av.score_p || 0).toFixed(1)} D:{(av.score_d || 0).toFixed(1)} F:{(av.score_f || 0).toFixed(1)} R:{(av.score_r || 0).toFixed(1)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon, accent }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: 'primary' | 'success' | 'info' | 'warning' | 'danger';
}) {
  const accentStyles: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-emerald-50 text-emerald-600',
    info: 'bg-blue-50 text-blue-600',
    warning: 'bg-amber-50 text-amber-600',
    danger: 'bg-red-50 text-red-500',
  };

  return (
    <div className="clinical-card !p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${accentStyles[accent]}`}>
          {icon}
        </div>
      </div>
      <div className="text-xl font-bold text-foreground">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
