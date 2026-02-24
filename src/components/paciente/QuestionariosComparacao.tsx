import { useState, useMemo } from 'react';
import { FileText, TrendingUp, TrendingDown, Minus, BarChart3, ArrowRight, Calendar, CheckCircle2, Clock, Eye, Brain, Bed, Activity, ClipboardList, Zap, Moon, AlertTriangle, Heart, Briefcase, Home, Dumbbell, Users, PersonStanding } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';

const BLOCOS = ['Anamnese e Mapeamento da Dor', 'Funcionalidade', 'Comportamento', 'Regulação Neurovegetativa'];
import { calcularTerrenos } from '@/utils/calculations';

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

/* ── Score Gauge Mini ── */
function ScoreGaugeMini({ value, max = 10, label, color, subtitle }: { value: number; max?: number; label: string; color: string; subtitle?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  const getLevel = (v: number) => {
    if (v <= 3) return { text: 'Baixo', bg: 'bg-emerald-100 text-emerald-700' };
    if (v <= 6) return { text: 'Moderado', bg: 'bg-amber-100 text-amber-700' };
    return { text: 'Alto', bg: 'bg-red-100 text-red-700' };
  };
  const level = getLevel(value);
  return (
    <div className="rounded-xl border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${level.bg}`}>{level.text}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-black" style={{ color }}>{value.toFixed(1)}</span>
        <span className="text-xs text-muted-foreground">/{max}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

/* ── Visual Bar Item ── */
function VisualBarItem({ label, value, max = 10, icon: Icon, color }: { label: string; value: number; max?: number; icon?: any; color?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  const barColor = color || (value <= 3 ? '#10b981' : value <= 6 ? '#f59e0b' : '#ef4444');
  return (
    <div className="flex items-center gap-3">
      {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      <div className="w-24 text-xs font-medium text-muted-foreground shrink-0 truncate">{label}</div>
      <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
      <span className="text-xs font-bold w-8 text-right">{value.toFixed(1)}</span>
    </div>
  );
}

/* ── Bloco 1 Detail: Anamnese + Dor ── */
function Bloco1Detail({ dados }: { dados: any }) {
  if (!dados) return null;
  const regioes = dados.regioes || [];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <ScoreGaugeMini value={dados.scoreF ?? 0} label="Score F — Contexto" color="hsl(var(--primary))" subtitle="Fatores contextuais e histórico" />
        <ScoreGaugeMini value={dados.scoreD ?? 0} label="Score D — Dor" color="#ef4444" subtitle="Intensidade multidimensional" />
      </div>
      {/* Anamnese resumo */}
      <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
        <span className="text-[10px] font-bold text-muted-foreground uppercase">Anamnese</span>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {dados.queixaPrincipal && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Queixa: </span>
              <span className="font-medium">{dados.queixaPrincipal}</span>
            </div>
          )}
          {dados.duracao && (
            <div><span className="text-muted-foreground">Duração: </span><span className="font-medium">{dados.duracao}</span></div>
          )}
          {dados.profissao && (
            <div><span className="text-muted-foreground">Profissão: </span><span className="font-medium">{dados.profissao}</span></div>
          )}
        </div>
        {/* Life factors */}
        <div className="space-y-1.5 mt-2">
          <VisualBarItem label="Impacto QV" value={dados.impactoQualidadeVida ?? 0} icon={Heart} />
          <VisualBarItem label="Interf. Trabalho" value={dados.interferenciaTrbalho ?? 0} icon={Briefcase} />
          <VisualBarItem label="Sedentarismo" value={dados.horasSedentario ?? 0} max={16} icon={Home} color="#6366f1" />
        </div>
        {dados.historicoMedico && dados.historicoMedico.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-2">
            {dados.historicoMedico.map((c: string) => (
              <Badge key={c} variant="outline" className="text-[10px] h-5">{c}</Badge>
            ))}
          </div>
        )}
      </div>
      {/* Regiões de dor */}
      {regioes.length > 0 && (
        <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase">{regioes.length} Região(ões) de Dor</span>
          </div>
          <div className="space-y-2">
            {regioes.map((reg: any, i: number) => (
              <div key={i} className="rounded-lg bg-background p-2.5 border space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{reg.nome || `Região ${i + 1}`}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-black" style={{ color: reg.intensidade > 6 ? '#ef4444' : reg.intensidade > 3 ? '#f59e0b' : '#10b981' }}>
                      {reg.intensidade}
                    </span>
                    <span className="text-[10px] text-muted-foreground">/10</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{
                    width: `${(reg.intensidade / 10) * 100}%`,
                    backgroundColor: reg.intensidade > 6 ? '#ef4444' : reg.intensidade > 3 ? '#f59e0b' : '#10b981',
                  }} />
                </div>
                <div className="flex gap-1 flex-wrap">
                  {reg.tipos?.map((t: string) => (
                    <span key={t} className="text-[9px] bg-muted px-1.5 py-0.5 rounded-md font-medium">{t}</span>
                  ))}
                  {reg.irradiacao && <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-md font-medium">Irradiação</span>}
                  {reg.frequencia && <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md font-medium">{reg.frequencia}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Bloco 3 Detail: Funcionalidade ── */
function Bloco3Detail({ dados }: { dados: any }) {
  if (!dados) return null;
  const ITEMS = [
    { key: 'trabalho', label: 'Trabalho/Estudo', icon: Briefcase },
    { key: 'domesticas', label: 'Atividades Domésticas', icon: Home },
    { key: 'exercicio', label: 'Exercício/Esporte', icon: Dumbbell },
    { key: 'independencia', label: 'Independência', icon: Heart },
    { key: 'vidaSocial', label: 'Vida Social', icon: Users },
  ];
  return (
    <div className="space-y-3">
      <ScoreGaugeMini value={dados.scoreEFI ?? 0} label="Score EFI — Funcionalidade" color="#10b981" subtitle="Impacto funcional global (0=sem impacto, 10=incapacitante)" />
      <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
        <span className="text-[10px] font-bold text-muted-foreground uppercase">Dimensões Funcionais</span>
        <div className="space-y-1.5">
          {ITEMS.map(item => (
            <VisualBarItem key={item.key} label={item.label} value={dados[item.key] ?? 0} icon={item.icon} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Bloco 4 Detail: Cinesiofobia TSK-11 ── */
function Bloco4Detail({ dados }: { dados: any }) {
  if (!dados) return null;
  const respostas: number[] = dados.respostas || [];
  const TSK_SHORT = [
    'Medo de piorar', 'Medo de machucar', 'Evitar movimentos', 'Evitar dor',
    'Dor = prejuízo', 'Inatividade segura', 'Dor = algo errado', 'Risco lesão grave',
    'Sem controle', 'Não mover em dor', 'Mostrar dor',
  ];
  const OPCOES_LABEL = ['', 'Discordo Fort.', 'Discordo', 'Concordo', 'Concordo Fort.'];

  return (
    <div className="space-y-3">
      <ScoreGaugeMini value={dados.scoreP ?? 0} label="Score P — Cinesiofobia (TSK-11)" color="#f59e0b" subtitle="Medo do movimento (0=nenhum, 10=máximo)" />
      <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
        <span className="text-[10px] font-bold text-muted-foreground uppercase">Respostas Individuais</span>
        <div className="space-y-1.5">
          {respostas.map((resp, idx) => {
            if (idx >= TSK_SHORT.length) return null;
            const barColor = resp >= 3 ? '#f59e0b' : '#10b981';
            const pct = (resp / 4) * 100;
            return (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground w-4 shrink-0">{idx + 1}</span>
                <div className="w-24 text-[10px] text-muted-foreground shrink-0 truncate" title={TSK_SHORT[idx]}>{TSK_SHORT[idx]}</div>
                <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                </div>
                <span className="text-[10px] font-medium w-20 text-right text-muted-foreground truncate">{OPCOES_LABEL[resp] || '—'}</span>
              </div>
            );
          })}
        </div>
        {(dados.scoreP ?? 0) > 7.5 && (
          <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span className="text-[10px] font-medium text-amber-700">Cinesiofobia acentuada — amplificador +2 no ID Final</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Bloco 5 Detail: Regulação Neurovegetativa ── */
function Bloco5Detail({ dados }: { dados: any }) {
  if (!dados) return null;

  const SONO_ITEMS = [
    { key: 'qualidadeSono', label: 'Qualidade', inv: true },
    { key: 'horasSono', label: 'Horas', inv: true },
    { key: 'acordaNaNoite', label: 'Despertar noturno', inv: false },
    { key: 'dorAfetaSono', label: 'Dor afeta sono', inv: false },
    { key: 'descansadoAoAcordar', label: 'Descansado', inv: true },
  ];
  const ENERGIA_ITEMS = [
    { key: 'energiaAoAcordar', label: 'Energia manhã', inv: true },
    { key: 'fadigaDia', label: 'Fadiga diurna', inv: false },
    { key: 'precisaCochiblar', label: 'Precisa cochilar', inv: false },
    { key: 'motivacao', label: 'Motivação', inv: true },
    { key: 'resistenciaFisica', label: 'Resistência', inv: true },
  ];
  const PSICO_ITEMS = [
    { key: 'nivelStress', label: 'Stress', inv: false },
    { key: 'humorGeral', label: 'Humor', inv: true },
    { key: 'concentracao', label: 'Concentração', inv: true },
    { key: 'preocupacaoSaude', label: 'Preocupação', inv: false },
    { key: 'sensacaoControle', label: 'Controle', inv: true },
  ];
  const CARGA_ITEMS = [
    { key: 'cargaLaboral', label: 'Carga laboral' },
    { key: 'relacionamentos', label: 'Relacionamentos' },
    { key: 'situacaoFinanceira', label: 'Financeiro' },
    { key: 'eventosEstressantes', label: 'Eventos stress' },
  ];

  // R sub-scores: alto = ruim
  const getSubColor = (v: number) => v <= 3 ? '#10b981' : v <= 6 ? '#f59e0b' : '#ef4444';

  const renderSubSection = (title: string, icon: any, items: { key: string; label: string; inv?: boolean }[], scoreKey: string, scoreLabel: string) => {
    const Icon = icon;
    const scoreVal = dados[scoreKey] ?? 0;
    return (
      <div className="rounded-lg bg-background p-3 border space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold">{title}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm font-black" style={{ color: getSubColor(scoreVal) }}>{scoreVal.toFixed(1)}</span>
            <span className="text-[10px] text-muted-foreground">/10</span>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${(scoreVal / 10) * 100}%`, backgroundColor: getSubColor(scoreVal) }} />
        </div>
        <div className="space-y-1">
          {items.map(item => {
            const val = dados[item.key] ?? 5;
            // For inverted items (high=good): show inverted bar color
            const effectiveVal = item.inv ? 10 - val : val;
            const barColor = effectiveVal <= 3 ? '#10b981' : effectiveVal <= 6 ? '#f59e0b' : '#ef4444';
            return (
              <div key={item.key} className="flex items-center gap-2">
                <div className="w-24 text-[10px] text-muted-foreground shrink-0 truncate">{item.label}</div>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(val / 10) * 100}%`, backgroundColor: barColor }} />
                </div>
                <span className="text-[10px] font-bold w-6 text-right">{val}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <ScoreGaugeMini value={dados.scoreR ?? 0} label="Score R — Regulação" color="#8b5cf6" subtitle="Regulação neurovegetativa (alto=ruim)" />
        <ScoreGaugeMini value={dados.scoreC ?? 0} label="Score C — Carga" color="#3b82f6" subtitle="Carga contextual (alto=ruim)" />
      </div>
      <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
        <span className="text-[10px] font-bold text-muted-foreground uppercase">Subdimensões</span>
        <div className="space-y-2">
          {renderSubSection('Sono (R1)', Moon, SONO_ITEMS, 'scoreR1', 'R1')}
          {renderSubSection('Energia (R2)', Zap, ENERGIA_ITEMS, 'scoreR2', 'R2')}
          {renderSubSection('Psicológico (R3)', Brain, PSICO_ITEMS, 'scoreR3', 'R3')}
          {renderSubSection('Carga Contextual (C)', Activity, CARGA_ITEMS.map(i => ({ ...i, inv: false })), 'scoreC', 'C')}
        </div>
      </div>
      {(dados.scoreR ?? 0) > 8 && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 border border-red-200">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
          <span className="text-[10px] font-medium text-red-700">Regulação crítica (R {'>'} 8) — amplificador +3 no ID Final</span>
        </div>
      )}
    </div>
  );
}

/* ── Render detail by block number ── */
function BlocoDetailRenderer({ blocoNum, dados }: { blocoNum: number; dados: any }) {
  switch (blocoNum) {
    case 1: return <Bloco1Detail dados={dados} />;
    case 3: return <Bloco3Detail dados={dados} />;
    case 4: return <Bloco4Detail dados={dados} />;
    case 5: return <Bloco5Detail dados={dados} />;
    default: return null;
  }
}

const BLOCO_ICONS: Record<number, any> = {
  1: ClipboardList,
  3: Activity,
  4: Brain,
  5: Bed,
};

export default function QuestionariosComparacao({ linksAvPaciente, respostas }: Props) {
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [expandedBloco, setExpandedBloco] = useState<number | null>(null);

  const respostasAgrupadas = useMemo(() => {
    return linksAvPaciente
      .filter(l => respostas.some(r => r.link_id === l.id))
      .map(link => {
        const respostasLink = respostas.filter(r => r.link_id === link.id);
        const blocosRecebidos = [...new Set(respostasLink.map(r => r.bloco_numero))].sort();
        const allScores: Record<string, number> = {};
        const blocoScores: Record<number, Record<string, number>> = {};
        const blocoDados: Record<number, any> = {};

        blocosRecebidos.forEach(bn => {
          const resp = respostasLink
            .filter(r => r.bloco_numero === bn)
            .sort((a, b) => (b.numero_tentativa || 1) - (a.numero_tentativa || 1))[0];
          if (resp?.dados_respostas) {
            const scores = extractScores(resp.dados_respostas);
            blocoScores[bn] = scores;
            blocoDados[bn] = resp.dados_respostas;
            Object.assign(allScores, scores);
          }
        });

        return {
          link,
          blocosRecebidos,
          allScores,
          blocoScores,
          blocoDados,
          completo: blocosRecebidos.length >= 4,
          data: link.data_ultimo_acesso || link.created_at,
        };
      });
  }, [linksAvPaciente, respostas]);

  if (respostasAgrupadas.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-xl border-dashed">
        <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Nenhum Questionário Identidade recebido</p>
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
  const BLOCO_NUMS = [1, 3, 4, 5];
  const blocosCount = BLOCOS.map((nome, i) => ({
    name: nome,
    value: respostasAgrupadas.filter(r => r.blocosRecebidos.includes(BLOCO_NUMS[i])).length,
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
        <SummaryCard label="Questionários" value={totalQuestionarios} icon={<FileText className="h-4 w-4" />} accent="primary" />
        <SummaryCard label="Completos" value={completos} icon={<CheckCircle2 className="h-4 w-4" />} accent="success" />
        <SummaryCard label="Blocos Recebidos" value={totalBlocos} icon={<BarChart3 className="h-4 w-4" />} accent="info" />
        <SummaryCard label="Taxa Conclusão" value={`${taxaComplecao}%`} icon={<TrendingUp className="h-4 w-4" />} accent="warning" isPercentage percentage={taxaComplecao} />
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
                  <Pie data={blocosCount} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
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
            <h4 className="font-semibold text-sm">Comparação: Primeiro vs Último Questionário Identidade</h4>
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
          <h4 className="font-semibold text-sm">Histórico — Questionário Identidade</h4>
        </div>
        <div className="space-y-2">
          {respostasAgrupadas.map((group, idx) => {
            const isSelected = selectedLinkId === group.link.id;
            return (
              <div key={group.link.id}>
                <div
                  className={`rounded-xl border p-3 cursor-pointer transition-all ${isSelected ? 'border-primary bg-accent/30 shadow-sm' : 'hover:border-primary/30 hover:bg-accent/10'}`}
                  onClick={() => { setSelectedLinkId(isSelected ? null : group.link.id); setExpandedBloco(null); }}
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
                            {group.blocosRecebidos.length}/4 etapas
                          </Badge>
                        )}
                      </div>
                      {/* Block progress bar */}
                      <div className="flex gap-1 mt-1.5">
                        {BLOCO_NUMS.map((n, i) => (
                          <div
                            key={n}
                            className={`h-1.5 flex-1 rounded-sm transition-colors ${group.blocosRecebidos.includes(n) ? 'bg-primary' : 'bg-muted'}`}
                            title={BLOCOS[i]}
                          />
                        ))}
                      </div>
                    </div>
                    <Eye className={`h-4 w-4 transition-transform ${isSelected ? 'text-primary rotate-0' : 'text-muted-foreground'}`} />
                  </div>
                </div>

                {/* Expanded detail with rich visual blocks */}
                {isSelected && (
                  <div className="mt-2 space-y-2 animate-slide-in">
                    {/* Quick score overview radar */}
                    {Object.keys(group.allScores).length >= 3 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-xl border bg-card p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <BarChart3 className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs font-semibold">Visão Geral dos Scores</span>
                          </div>
                          <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                              <RadarChart data={Object.entries(group.allScores).map(([k, v]) => ({
                                score: k.replace('score', '').toUpperCase(),
                                valor: Number(v.toFixed(1)),
                              }))}>
                                <PolarGrid className="stroke-border" />
                                <PolarAngleAxis dataKey="score" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                                <Radar name="Score" dataKey="valor" stroke="hsl(var(--identidade))" fill="hsl(var(--identidade))" fillOpacity={0.2} strokeWidth={2} />
                              </RadarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Terrenos Profile for this submission */}
                        {group.blocoDados[1] && group.blocoDados[4] && group.blocoDados[5] && (() => {
                          const terrenos = calcularTerrenos(group.blocoDados[1], group.blocoDados[4], group.blocoDados[5], group.allScores.scoreD || 0);
                          return (
                            <div className="rounded-xl border bg-card p-4 flex flex-col justify-center">
                              <div className="flex items-center gap-2 mb-3">
                                <PersonStanding className="h-3.5 w-3.5 text-primary" />
                                <span className="text-xs font-semibold">Perfil de Terrenos</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="space-y-3 flex-1">
                                  <div>
                                    <div className="flex justify-between text-[10px] mb-1">
                                      <span className="font-bold text-green-600">Modificáveis</span>
                                      <span>{terrenos.porcentagemMod}%</span>
                                    </div>
                                    <Progress value={terrenos.porcentagemMod} className="h-1.5 bg-green-100" />
                                  </div>
                                  <div>
                                    <div className="flex justify-between text-[10px] mb-1">
                                      <span className="font-bold text-red-500">Fixos</span>
                                      <span>{terrenos.porcentagemNaoMod}%</span>
                                    </div>
                                    <Progress value={terrenos.porcentagemNaoMod} className="h-1.5 bg-red-100" />
                                  </div>
                                  <div className="pt-1">
                                    <Badge variant="outline" className="text-[10px] w-full justify-center py-1 border-primary/20 text-primary">
                                      Amp: {terrenos.amplificadorDor.toFixed(2)}x
                                    </Badge>
                                  </div>
                                </div>
                                <div className="relative w-24 h-24 shrink-0 flex items-center justify-center bg-muted/30 rounded-full border-2 border-muted overflow-hidden">
                                  <PersonStanding className="h-12 w-12 text-primary opacity-60" />
                                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                                    <circle cx="48" cy="48" r="44" className="stroke-green-500/10 fill-none" strokeWidth="4" />
                                    <circle cx="48" cy="48" r="44" className="stroke-green-500 fill-none transition-all" strokeWidth="4" strokeDasharray="276" strokeDashoffset={276 - (276 * terrenos.porcentagemMod) / 100} />
                                  </svg>
                                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                                    <circle cx="48" cy="48" r="38" className="stroke-red-400/10 fill-none" strokeWidth="3" />
                                    <circle cx="48" cy="48" r="38" className="stroke-red-400 fill-none transition-all" strokeWidth="3" strokeDasharray="238" strokeDashoffset={238 - (238 * terrenos.porcentagemNaoMod) / 100} />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Block accordion */}
                    {group.blocosRecebidos.map(bn => {
                      const BlocoIcon = BLOCO_ICONS[bn] || FileText;
                      const isExpanded = expandedBloco === bn;
                      const scores = group.blocoScores[bn] || {};
                      const scoreEntries = Object.entries(scores);
                      return (
                        <div key={bn} className="rounded-xl border bg-card overflow-hidden">
                          <div
                            className={`flex items-center gap-3 p-3 cursor-pointer transition-all hover:bg-accent/30 ${isExpanded ? 'bg-accent/20 border-b' : ''}`}
                            onClick={(e) => { e.stopPropagation(); setExpandedBloco(isExpanded ? null : bn); }}
                          >
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <BlocoIcon className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-semibold">{BLOCOS[BLOCO_NUMS.indexOf(bn)] ?? `Bloco ${bn}`}</span>
                            </div>
                            {scoreEntries.length > 0 && (
                              <div className="flex gap-1.5">
                                {scoreEntries.map(([k, v]) => (
                                  <div key={k} className="bg-muted rounded-md px-2 py-0.5 flex items-center gap-1">
                                    <span className="text-[9px] text-muted-foreground font-medium">{k.replace('score', '').toUpperCase()}</span>
                                    <span className="text-xs font-bold text-primary">{v.toFixed(1)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          </div>
                          {isExpanded && (
                            <div className="p-4 animate-slide-in">
                              <BlocoDetailRenderer blocoNum={bn} dados={group.blocoDados[bn]} />
                            </div>
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
