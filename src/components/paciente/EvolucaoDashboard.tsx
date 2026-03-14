import { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart3, Activity, Calendar, Target, Award, Download, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar,
} from 'recharts';
import type { EvolucaoRecord } from '@/hooks/useEvolucaoPaciente';
import { gerarPDFEvolucao } from '@/utils/pdfEvolucaoGenerator';

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

interface Props {
  evolucoes: EvolucaoRecord[];
  pacienteNome?: string;
  terapeutaNome?: string;
}

export default function EvolucaoDashboard({ evolucoes, pacienteNome, terapeutaNome }: Props) {
  const [exportando, setExportando] = useState(false);

  const handleExportPDF = async () => {
    setExportando(true);
    try {
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

  const totalAvaliacoes = sorted.length;
  const idFinalAtual = Number(ultima?.id_final ?? 0);
  const idFinalInicial = Number(primeira?.id_final ?? 0);
  const deltaID = Number((idFinalAtual - idFinalInicial).toFixed(1));
  const classificacaoAtual = ultima?.classificacao || '—';

  const radarData = SCORE_KEYS.slice(0, 6).map(key => ({
    score: SCORE_LABELS[key],
    atual: Number(((ultima as any)?.[key] || 0).toFixed(1)),
    inicial: Number(((primeira as any)?.[key] || 0).toFixed(1)),
  }));

  const evolucaoData = sorted.map(ev => ({
    name: `Av. ${ev.numero_avaliacao}`,
    ID: Number((ev.id_final || 0).toFixed(1)),
    E: Number((ev.score_e || 0).toFixed(1)),
    P: Number((ev.score_p || 0).toFixed(1)),
    C: Number((ev.score_c || 0).toFixed(1)),
    F: Number((ev.score_f || 0).toFixed(1)),
    D: Number((ev.score_d || 0).toFixed(1)),
    R: Number((ev.score_r || 0).toFixed(1)),
  }));

  const comparisonData = SCORE_KEYS.map(key => ({
    score: key.replace('score_', '').toUpperCase(),
    Primeira: Number(((primeira as any)?.[key] || 0).toFixed(1)),
    Última: Number(((ultima as any)?.[key] || 0).toFixed(1)),
  }));

  const scoreDeltaData = SCORE_KEYS.map(key => {
    const deltaKey = key.replace('score_', 'delta_');
    const cumulativeDelta = Number(
      (Number((ultima as any)?.[key] || 0) - Number((primeira as any)?.[key] || 0)).toFixed(1)
    );
    return {
      key: key.replace('score_', '').toUpperCase(),
      first: Number(((primeira as any)?.[key] || 0).toFixed(1)),
      last: Number(((ultima as any)?.[key] || 0).toFixed(1)),
      delta: cumulativeDelta,
      color: SCORE_COLORS[key],
    };
  });

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">Resumo da Evolução</h3>
        <Button size="sm" variant="outline" className="gap-2 text-xs" onClick={handleExportPDF} disabled={exportando}>
          {exportando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Exportar PDF
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Avaliações" value={totalAvaliacoes} icon={<Activity className="h-4 w-4" />} accent="primary" />
        <SummaryCard label="ID Final Atual" value={`${idFinalAtual.toFixed(1)}/50`} icon={<Target className="h-4 w-4" />} accent="info" />
        <SummaryCard label="Classificação" value={classificacaoAtual} icon={<Award className="h-4 w-4" />} accent="warning" />
        <SummaryCard
          label="Variação ID"
          value={`${deltaID > 0 ? '+' : ''}${deltaID}`}
          icon={deltaID <= 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
          accent={deltaID <= 0 ? 'success' : 'danger'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Radar */}
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

        {/* Evolution Line */}
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
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
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

      {/* Comparison Bar */}
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
          {[...sorted].reverse().map((ev, idx) => {
            const isLatest = idx === 0;
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
                    ID: {(ev.id_final || 0).toFixed(1)}/50
                    {ev.delta_id_final != null && ev.delta_id_final !== 0 && (
                      <span className={ev.delta_id_final < 0 ? 'text-emerald-600' : 'text-red-500'}>
                        {' '}({ev.delta_id_final > 0 ? '+' : ''}{ev.delta_id_final.toFixed(1)})
                      </span>
                    )}
                    {' · '}E:{(ev.score_e || 0).toFixed(1)} P:{(ev.score_p || 0).toFixed(1)} D:{(ev.score_d || 0).toFixed(1)} F:{(ev.score_f || 0).toFixed(1)} R:{(ev.score_r || 0).toFixed(1)}
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
