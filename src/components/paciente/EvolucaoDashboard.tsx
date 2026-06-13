import { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart3, Activity, Calendar, Target, Award, Download, Loader2, Eye, EyeOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, Cell,
} from 'recharts';
import type { EvolucaoRecord } from '@/hooks/useEvolucaoPaciente';

import { calcularPerdaDimensao } from '@/utils/myid/lossTable';

// ── Dimension configuration: demand (higher raw = worse) vs capacity (higher raw = better) ──
const DIMENSION_CONFIG: { key: string; dbKey: string; label: string; color: string; type: 'demand' | 'capacity' }[] = [
  { key: 'D', dbKey: 'score_d', label: 'Dor', color: '#ef4444', type: 'demand' },
  { key: 'EFI', dbKey: 'score_efi', label: 'Funcionalidade', color: '#f97316', type: 'demand' },
  { key: 'P', dbKey: 'score_p', label: 'Kinesiofobia', color: '#f59e0b', type: 'demand' },
  { key: 'I', dbKey: 'score_i', label: 'Inércia', color: '#fcd34d', type: 'demand' },
  { key: 'R', dbKey: 'score_r', label: 'Regulação', color: '#8b5cf6', type: 'capacity' },
  { key: 'C', dbKey: 'score_c', label: 'Contexto', color: '#6366f1', type: 'capacity' },
  { key: 'N', dbKey: 'score_n', label: 'Ruído', color: '#64748b', type: 'demand' },
];

const SCORE_COLORS: Record<string, string> = {};
DIMENSION_CONFIG.forEach(d => { SCORE_COLORS[d.dbKey] = d.color; });

interface Props {
  evolucoes: EvolucaoRecord[];
  pacienteNome?: string;
  terapeutaNome?: string;
}

/** Get the main score: prefer myid_score (0-100), recalculate if missing */
function getMainScore(ev: EvolucaoRecord): number {
  if (ev.myid_score != null && ev.myid_score > 0) return Number(ev.myid_score);
  // Fallback: recalculate from dimension scores using loss table
  const dims: { key: string; dbKey: string; type: 'demand' | 'capacity' }[] = [
    { key: 'D', dbKey: 'score_d', type: 'demand' },
    { key: 'EFI', dbKey: 'score_efi', type: 'demand' },
    { key: 'P', dbKey: 'score_p', type: 'demand' },
    { key: 'I', dbKey: 'score_i', type: 'demand' },
    { key: 'N', dbKey: 'score_n', type: 'demand' },
    { key: 'R', dbKey: 'score_r', type: 'capacity' },
    { key: 'C', dbKey: 'score_c', type: 'capacity' },
  ];
  let totalPerdas = 0;
  for (const d of dims) {
    const raw = Number((ev as any)[d.dbKey] || 0);
    const input = d.type === 'capacity' ? (10 - raw) : raw;
    totalPerdas += calcularPerdaDimensao(d.key, input).perda_pontos;
  }
  const score = Math.max(0, Math.min(100, 100 - totalPerdas));
  return score > 0 ? score : Number(ev.id_final ?? 0);
}

function isMyID100Scale(evolucoes: EvolucaoRecord[]): boolean {
  return evolucoes.some(ev => ev.myid_score != null && ev.myid_score > 0);
}

/**
 * For delta indicators: determine if a change is "improvement"
 * Demand dimensions (D, EFI, P, I, N): decrease = improvement (negative delta = good)
 * Capacity dimensions (R, C): increase = improvement (positive delta = good)
 */
function isDimensionImprovement(dimKey: string, delta: number): boolean {
  const cfg = DIMENSION_CONFIG.find(d => d.dbKey === dimKey || d.key === dimKey);
  if (!cfg) return delta < 0; // default: lower = better
  return cfg.type === 'capacity' ? delta > 0 : delta < 0;
}

export default function EvolucaoDashboard({ evolucoes, pacienteNome, terapeutaNome }: Props) {
  const [exportando, setExportando] = useState(false);
  const [visibleDims, setVisibleDims] = useState<Set<string>>(new Set());
  const toggleDim = (key: string) => setVisibleDims(prev => {
    const next = new Set(prev);
    if (next.has(key)) { next.delete(key); } else { next.add(key); }
    return next;
  });

  const handleExportPDF = async () => {
    setExportando(true);
    try {
      const { gerarPDFEvolucao } = await import('@/utils/pdfEvolucaoGenerator');
      await gerarPDFEvolucao({
        pacienteNome: pacienteNome || 'Paciente',
        terapeutaNome: terapeutaNome || 'Terapeuta',
        dataEmissao: new Date().toLocaleDateString('pt-BR'),
        evolucoes,
      });
    } finally {
      setExportando(false);
    }
  };
  const sorted = useMemo(() => [...evolucoes].sort((a, b) => a.numero_avaliacao - b.numero_avaliacao), [evolucoes]);

  const primeira = sorted[0];
  const ultima = sorted[sorted.length - 1];
  const useMyID100 = isMyID100Scale(sorted);
  const maxScore = 100;
  const scoreLabel = 'MyID-100';

  const totalAvaliacoes = sorted.length;
  const scoreAtual = getMainScore(ultima);
  const scoreInicial = getMainScore(primeira);
  const deltaScore = Number((scoreAtual - scoreInicial).toFixed(1));
  const classificacaoAtual = ultima?.classificacao || '—';

  // Radar: use loss-based "impacto" for demand dimensions, "deficit" for capacity
  const radarData = DIMENSION_CONFIG.map(dim => {
    const atualRaw = Number(((ultima as any)?.[dim.dbKey] || 0));
    const inicialRaw = Number(((primeira as any)?.[dim.dbKey] || 0));
    // Convert to "impact" (0-10 where 10 = maximum negative impact)
    const atualImpact = dim.type === 'capacity' ? (10 - atualRaw) : atualRaw;
    const inicialImpact = dim.type === 'capacity' ? (10 - inicialRaw) : inicialRaw;
    return {
      score: dim.label,
      atual: Number(atualImpact.toFixed(1)),
      inicial: Number(inicialImpact.toFixed(1)),
    };
  });

  const evolucaoData = sorted.map(ev => {
    const point: any = {
      name: `Av. ${ev.numero_avaliacao}`,
      Score: Number(getMainScore(ev).toFixed(1)),
    };
    DIMENSION_CONFIG.forEach(dim => {
      const raw = Number(((ev as any)[dim.dbKey] || 0));
      // Convert to "perda" (loss points) using the loss table
      const input = dim.type === 'capacity' ? (10 - raw) : raw;
      point[dim.key] = calcularPerdaDimensao(dim.key, input).perda_pontos;
    });
    return point;
  });

  const comparisonData = DIMENSION_CONFIG.map(dim => {
    const primeiraRaw = Number(((primeira as any)?.[dim.dbKey] || 0));
    const ultimaRaw = Number(((ultima as any)?.[dim.dbKey] || 0));
    // Show as "impact/loss" so higher bar = worse
    const primeiraImpact = dim.type === 'capacity' ? (10 - primeiraRaw) : primeiraRaw;
    const ultimaImpact = dim.type === 'capacity' ? (10 - ultimaRaw) : ultimaRaw;
    return {
      score: dim.key,
      Primeira: Number(primeiraImpact.toFixed(1)),
      Última: Number(ultimaImpact.toFixed(1)),
    };
  });

  const scoreDeltaData = DIMENSION_CONFIG.map(dim => {
    const first = Number(((primeira as any)?.[dim.dbKey] || 0));
    const last = Number(((ultima as any)?.[dim.dbKey] || 0));
    const delta = Number((last - first).toFixed(1));
    const improved = isDimensionImprovement(dim.key, delta);
    return {
      key: dim.key,
      label: dim.label,
      first: first.toFixed(1),
      last: last.toFixed(1),
      delta,
      color: dim.color,
      type: dim.type,
      improved,
    };
  });

  // For MyID-100: higher score = better, so positive delta = improvement
  const isImprovement = deltaScore > 0;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">Resumo da Evolução</h3>
        <Button size="sm" variant="outline" className="gap-2 text-xs" onClick={handleExportPDF} disabled={exportando}>
          {exportando ? <Loader2 className="icon-sm animate-spin" /> : <Download className="icon-sm" />}
          Exportar PDF
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Avaliações" value={totalAvaliacoes} icon={<Activity className="h-4 w-4" />} accent="primary" />
        <SummaryCard label={`${scoreLabel} Atual`} value={`${Math.round(scoreAtual)}/${maxScore}`} icon={<Target className="h-4 w-4" />} accent="info" />
        <SummaryCard label="Classificação" value={classificacaoAtual} icon={<Award className="h-4 w-4" />} accent="warning" />
        <SummaryCard
          label={`Variação ${scoreLabel}`}
          value={`${deltaScore > 0 ? '+' : ''}${deltaScore.toFixed(1)}`}
          icon={isImprovement ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          accent={isImprovement ? 'success' : 'danger'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Radar — "Impacto por Dimensão" (higher = worse) */}
        <div className="clinical-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm">Impacto por Dimensão</h4>
            </div>
            <Badge variant="outline" className="text-[10px]">1ª vs Última</Badge>
          </div>
          <p className="text-[9px] text-muted-foreground mb-2">Quanto mais expandido, maior o impacto negativo.</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {DIMENSION_CONFIG.map(d => (
              <span key={d.key} className="inline-flex items-center gap-1 text-[9px] font-bold text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                {d.key}
                <span className="opacity-50">{d.type === 'capacity' ? '🛡' : '🔥'}</span>
              </span>
            ))}
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid className="stroke-border" />
                <PolarAngleAxis dataKey="score" tick={{ fontSize: 10 }} />
                <Radar name="Primeira" dataKey="inicial" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.1} strokeDasharray="4 4" strokeWidth={1.5} />
                <Radar name="Atual" dataKey="atual" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Evolution Line — MyID-100 score + toggleable dimension losses */}
        <div className="clinical-card">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm">Evolução MyID-100</h4>
            </div>
            <Badge variant="outline" className="text-[10px]">{evolucaoData.length} avaliações</Badge>
          </div>
          {/* Dimension toggles */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {DIMENSION_CONFIG.map(dim => {
              const active = visibleDims.has(dim.key);
              return (
                <button
                  key={dim.key}
                  onClick={() => toggleDim(dim.key)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all ${
                    active
                      ? 'border-transparent text-white shadow-sm'
                      : 'border-border/60 text-muted-foreground hover:border-border bg-transparent'
                  }`}
                  style={active ? { backgroundColor: dim.color } : undefined}
                >
                  {active ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5 opacity-40" />}
                  {dim.key}
                </button>
              );
            })}
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucaoData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="Score" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 5, strokeWidth: 2 }} name={scoreLabel} activeDot={{ r: 7 }} />
                {DIMENSION_CONFIG.map(dim => (
                  visibleDims.has(dim.key) && (
                    <Line key={dim.key} type="monotone" dataKey={dim.key} stroke={dim.color} strokeWidth={1.5} dot={{ r: 3 }} name={`${dim.label} (perda)`} strokeDasharray="4 3" />
                  )
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Comparison Bar — dimension-colored bars */}
      <div className="clinical-card">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm">Comparação: Impacto Primeira vs Última</h4>
        </div>
        <p className="text-[9px] text-muted-foreground mb-3">Barras menores = melhora. Cores por dimensão.</p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="score" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 10]} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="Primeira" radius={[4, 4, 0, 0]} opacity={0.35} name="Primeira">
                {comparisonData.map((entry, idx) => (
                  <Cell key={idx} fill={DIMENSION_CONFIG[idx]?.color || '#94a3b8'} />
                ))}
              </Bar>
              <Bar dataKey="Última" radius={[4, 4, 0, 0]} name="Última">
                {comparisonData.map((entry, idx) => (
                  <Cell key={idx} fill={DIMENSION_CONFIG[idx]?.color || 'hsl(var(--primary))'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Delta Indicators — responsive grid */}
      <div className="clinical-card">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm">Variação por Dimensão</h4>
        </div>
        <p className="text-[9px] text-muted-foreground mb-3">
          🔻 Demanda: redução = melhora · 🔺 Capacidade: aumento = melhora
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {scoreDeltaData.map(s => (
            <div key={s.key} className="rounded-xl p-3 text-center border transition-all hover:shadow-sm"
              style={{ borderColor: `${s.color}30`, background: `${s.color}08` }}>
              <div className="flex items-center justify-center gap-1.5 mb-1.5">
                <div className="h-3 w-3 rounded-full" style={{ background: s.color }} />
                <span className="text-xs font-bold" style={{ color: s.color }}>{s.label}</span>
                <span className="text-[9px] text-muted-foreground/60">{s.type === 'capacity' ? '🛡' : '🔥'}</span>
              </div>
              <div className="text-2xl font-black text-foreground">{s.last}</div>
              <div className="flex items-center justify-center gap-1 mt-1.5">
                {s.delta === 0 ? (
                  <Minus className="h-3 w-3 text-muted-foreground" />
                ) : s.improved ? (
                  <TrendingUp className="icon-sm text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <TrendingDown className="icon-sm text-destructive" />
                )}
                <span className={`text-sm font-bold ${s.delta === 0 ? 'text-muted-foreground' : s.improved ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                  {s.delta > 0 ? '+' : ''}{s.delta}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">de {s.first}</div>
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
          {[...sorted].reverse().map((ev, idx) => {
            const isLatest = idx === 0;
            const evScore = getMainScore(ev);
            return (
              <div key={ev.id} className={`rounded-xl border p-3 flex items-center gap-3 transition-all ${isLatest ? 'border-primary bg-accent/20' : 'hover:bg-accent/10'}`}>
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${isLatest ? 'bg-primary/20' : 'bg-muted'}`}>
                  <span className={`text-sm font-bold ${isLatest ? 'text-primary' : 'text-muted-foreground'}`}>{ev.numero_avaliacao}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">
                      {new Date(ev.data_registro).toLocaleDateString('pt-BR')}
                    </span>
                    {ev.classificacao && (
                      <Badge variant="outline" className="text-[10px] h-4">{ev.classificacao}</Badge>
                    )}
                    {isLatest && (
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] h-4">Mais recente</Badge>
                    )}
                    {ev.dias_desde_anterior != null && ev.dias_desde_anterior > 0 && (
                      <span className="text-[10px] text-muted-foreground">({ev.dias_desde_anterior}d desde anterior)</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    MyID-100: {Math.round(evScore)}/100
                    {ev.delta_id_final != null && ev.delta_id_final !== 0 && (
                      <span className={ev.delta_id_final > 0 ? 'text-emerald-600' : 'text-red-500'}>
                        {' '}({ev.delta_id_final > 0 ? '+' : ''}{Number(ev.delta_id_final).toFixed(1)})
                      </span>
                    )}
                    {' · '}D:{Number(ev.score_d || 0).toFixed(1)} P:{Number(ev.score_p || 0).toFixed(1)} R:{Number(ev.score_r || 0).toFixed(1)} I:{Number(ev.score_i || 0).toFixed(1)} N:{Number(ev.score_n || 0).toFixed(1)}
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
