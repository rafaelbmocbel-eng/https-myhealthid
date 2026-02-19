import { useState, useMemo } from 'react';
import { FileText, TrendingUp, TrendingDown, Minus, BarChart3, ArrowRight, Calendar, CheckCircle2, Clock, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';

const BLOCOS = ['Anamnese', 'Dor', 'Funcionalidade', 'Cinesiofobia', 'Regulação'];

const SCORE_KEYS_MAP: Record<number, { key: string; label: string; color: string }[]> = {
  1: [{ key: 'scoreF', label: 'Score F', color: 'hsl(var(--primary))' }],
  2: [{ key: 'scoreD', label: 'Score D', color: '#ef4444' }],
  3: [{ key: 'scoreEFI', label: 'Score EFI', color: '#10b981' }],
  4: [{ key: 'scoreP', label: 'Score P', color: '#f59e0b' }],
  5: [
    { key: 'scoreR', label: 'Score R', color: '#8b5cf6' },
    { key: 'scoreC', label: 'Score C', color: '#3b82f6' },
  ],
};

const PIE_COLORS = ['#7c3aed', '#3b82f6', '#ef4444', '#10b981', '#f59e0b'];

interface LinkAvaliacao {
  id: string;
  created_at: string | null;
  data_ultimo_acesso: string | null;
  data_expiracao: string | null;
  status: string | null;
  acessos_totais: number | null;
}

interface RespostaPaciente {
  id: string;
  link_id: string;
  bloco_numero: number;
  dados_respostas: any;
  data_preenchimento: string | null;
  numero_tentativa: number | null;
}

interface Props {
  linksAvPaciente: LinkAvaliacao[];
  respostas: RespostaPaciente[];
}

function extractScores(dados: any): Record<string, number> {
  if (!dados || typeof dados !== 'object') return {};
  const scores: Record<string, number> = {};
  Object.entries(dados).forEach(([k, v]) => {
    if (k.startsWith('score') && typeof v === 'number') scores[k] = v;
  });
  return scores;
}

export default function QuestionariosComparacao({ linksAvPaciente, respostas }: Props) {
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);

  const respostasAgrupadas = useMemo(() => {
    return linksAvPaciente
      .filter(l => respostas.some(r => r.link_id === l.id))
      .map(link => {
        const respostasLink = respostas.filter(r => r.link_id === link.id);
        const blocosRecebidos = [...new Set(respostasLink.map(r => r.bloco_numero))].sort();
        const allScores: Record<string, number> = {};
        const blocoScores: Record<number, Record<string, number>> = {};

        blocosRecebidos.forEach(bn => {
          const resp = respostasLink
            .filter(r => r.bloco_numero === bn)
            .sort((a, b) => (b.numero_tentativa || 1) - (a.numero_tentativa || 1))[0];
          if (resp?.dados_respostas) {
            const scores = extractScores(resp.dados_respostas);
            blocoScores[bn] = scores;
            Object.assign(allScores, scores);
          }
        });

        return {
          link,
          blocosRecebidos,
          allScores,
          blocoScores,
          completo: blocosRecebidos.length === 5,
          data: link.data_ultimo_acesso || link.created_at,
        };
      });
  }, [linksAvPaciente, respostas]);

  if (respostasAgrupadas.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-xl border-dashed">
        <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Nenhum questionário recebido</p>
        <p className="text-sm mt-1">Gere e envie um link de avaliação para este paciente.</p>
      </div>
    );
  }

  // Summary stats
  const totalQuestionarios = respostasAgrupadas.length;
  const completos = respostasAgrupadas.filter(r => r.completo).length;
  const totalBlocos = respostasAgrupadas.reduce((acc, r) => acc + r.blocosRecebidos.length, 0);
  const taxaComplecao = totalQuestionarios > 0 ? Math.round((completos / totalQuestionarios) * 100) : 0;

  // Completion by block for pie chart
  const blocosCount = BLOCOS.map((nome, i) => ({
    name: nome,
    value: respostasAgrupadas.filter(r => r.blocosRecebidos.includes(i + 1)).length,
  }));

  // Evolution data for line chart (scores across submissions)
  const evolucaoData = respostasAgrupadas
    .slice()
    .reverse()
    .map((r, i) => ({
      name: `Q${i + 1}`,
      data: r.data ? format(parseISO(r.data), 'dd/MM', { locale: ptBR }) : `Q${i + 1}`,
      F: r.allScores.scoreF ?? null,
      D: r.allScores.scoreD ?? null,
      EFI: r.allScores.scoreEFI ?? null,
      P: r.allScores.scoreP ?? null,
      R: r.allScores.scoreR ?? null,
      C: r.allScores.scoreC ?? null,
    }));

  // Comparison bar data (latest vs first if 2+)
  const comparisonData = respostasAgrupadas.length >= 2
    ? (() => {
        const first = respostasAgrupadas[respostasAgrupadas.length - 1];
        const last = respostasAgrupadas[0];
        return ['scoreF', 'scoreD', 'scoreEFI', 'scoreP', 'scoreR', 'scoreC']
          .filter(k => first.allScores[k] !== undefined || last.allScores[k] !== undefined)
          .map(k => ({
            score: k.replace('score', ''),
            Primeiro: first.allScores[k] ?? 0,
            Último: last.allScores[k] ?? 0,
          }));
      })()
    : null;

  const selectedGroup = selectedLinkId ? respostasAgrupadas.find(r => r.link.id === selectedLinkId) : null;

  return (
    <div className="space-y-4">
      {/* Summary Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          label="Questionários"
          value={totalQuestionarios}
          icon={<FileText className="h-4 w-4" />}
          accent="primary"
        />
        <SummaryCard
          label="Completos"
          value={completos}
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent="success"
        />
        <SummaryCard
          label="Blocos Recebidos"
          value={totalBlocos}
          icon={<BarChart3 className="h-4 w-4" />}
          accent="info"
        />
        <SummaryCard
          label="Taxa Conclusão"
          value={`${taxaComplecao}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          accent="warning"
          isPercentage
          percentage={taxaComplecao}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Evolution Line Chart */}
        {evolucaoData.length >= 2 && (
          <div className="clinical-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h4 className="font-semibold text-sm">Evolução dos Scores</h4>
              </div>
              <Badge variant="outline" className="text-[10px]">{evolucaoData.length} envios</Badge>
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolucaoData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="F" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="F" connectNulls />
                  <Line type="monotone" dataKey="D" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="D" connectNulls />
                  <Line type="monotone" dataKey="P" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="P" connectNulls />
                  <Line type="monotone" dataKey="R" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="R" connectNulls />
                  <Line type="monotone" dataKey="EFI" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="EFI" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Completion Donut */}
        <div className="clinical-card">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-sm">Blocos Respondidos</h4>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-44 w-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={blocosCount}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {blocosCount.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 flex-1">
              {blocosCount.map((b, i) => (
                <div key={b.name} className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: PIE_COLORS[i] }} />
                  <span className="text-xs text-muted-foreground flex-1">{b.name}</span>
                  <span className="text-xs font-bold">{b.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Bar Chart */}
      {comparisonData && comparisonData.length > 0 && (
        <div className="clinical-card">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-sm">Comparação: Primeiro vs Último Questionário</h4>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="score" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Primeiro" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.5} />
                <Bar dataKey="Último" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Delta badges */}
          <div className="flex gap-2 flex-wrap mt-3">
            {comparisonData.map(d => {
              const delta = Number((d.Último - d.Primeiro).toFixed(1));
              return (
                <div key={d.score} className="bg-muted/50 rounded-lg px-3 py-1.5 text-center">
                  <div className="text-[10px] text-muted-foreground font-medium">{d.score}</div>
                  <div className="flex items-center gap-1 justify-center">
                    {delta > 0 ? <TrendingUp className="h-3 w-3 text-red-500" /> : delta < 0 ? <TrendingDown className="h-3 w-3 text-emerald-600" /> : <Minus className="h-3 w-3 text-muted-foreground" />}
                    <span className={`text-xs font-bold ${delta > 0 ? 'text-red-500' : delta < 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                      {delta > 0 ? '+' : ''}{delta}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Individual Submissions List */}
      <div className="clinical-card">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm">Histórico de Envios</h4>
        </div>
        <div className="space-y-2">
          {respostasAgrupadas.map((group, idx) => {
            const isSelected = selectedLinkId === group.link.id;
            return (
              <div key={group.link.id}>
                <div
                  className={`rounded-xl border p-3 cursor-pointer transition-all ${isSelected ? 'border-primary bg-accent/30 shadow-sm' : 'hover:border-primary/30 hover:bg-accent/10'}`}
                  onClick={() => setSelectedLinkId(isSelected ? null : group.link.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">Q{respostasAgrupadas.length - idx}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">
                          {group.data ? format(parseISO(group.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Data não disponível'}
                        </span>
                        {group.completo && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] h-4">Completo</Badge>}
                        {!group.completo && (
                          <Badge variant="outline" className="text-[10px] h-4 text-amber-600 border-amber-200 bg-amber-50">
                            {group.blocosRecebidos.length}/5 blocos
                          </Badge>
                        )}
                      </div>
                      {/* Block progress bar */}
                      <div className="flex gap-1 mt-1.5">
                        {[1, 2, 3, 4, 5].map(n => (
                          <div
                            key={n}
                            className={`h-1.5 flex-1 rounded-sm transition-colors ${group.blocosRecebidos.includes(n) ? 'bg-primary' : 'bg-muted'}`}
                            title={BLOCOS[n - 1]}
                          />
                        ))}
                      </div>
                    </div>
                    <Eye className={`h-4 w-4 transition-transform ${isSelected ? 'text-primary rotate-0' : 'text-muted-foreground'}`} />
                  </div>
                </div>

                {/* Expanded detail */}
                {isSelected && (
                  <div className="mt-2 ml-12 space-y-2 animate-slide-in">
                    {group.blocosRecebidos.map(bn => {
                      const scores = group.blocoScores[bn] || {};
                      const scoreEntries = Object.entries(scores);
                      return (
                        <div key={bn} className="bg-muted/30 rounded-lg p-3 border border-border/50">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs font-semibold">Bloco {bn} — {BLOCOS[bn - 1]}</span>
                          </div>
                          {scoreEntries.length > 0 ? (
                            <div className="flex gap-2 flex-wrap">
                              {scoreEntries.map(([k, v]) => (
                                <div key={k} className="bg-background rounded-md px-2.5 py-1 border">
                                  <span className="text-[10px] text-muted-foreground">{k.replace('score', '').toUpperCase()}</span>
                                  <span className="text-xs font-bold ml-1.5 text-primary">{v.toFixed(1)}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] text-muted-foreground">Sem scores calculados neste bloco</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Small summary card component
function SummaryCard({ label, value, icon, accent, isPercentage, percentage }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: 'primary' | 'success' | 'info' | 'warning';
  isPercentage?: boolean;
  percentage?: number;
}) {
  const accentStyles: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-emerald-50 text-emerald-600',
    info: 'bg-blue-50 text-blue-600',
    warning: 'bg-amber-50 text-amber-600',
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
      {isPercentage && percentage !== undefined && (
        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percentage}%` }} />
        </div>
      )}
    </div>
  );
}
