import { Activity, AlertCircle, Clock, BarChart3, Dumbbell, PersonStanding } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
} from 'recharts';
import { calcularTerrenos } from '@/utils/calculations';

interface ScoresParciais {
  scores: Record<string, number>;
  blocosRecebidos: number[];
  totalBlocos: number;
  completo: boolean;
  linkId: string;
  data: string | null;
  blocoDados?: Record<number, any>;
}

interface Props {
  scoresParciais: ScoresParciais;
  onIniciarAvaliacao: () => void;
}

const SCORE_MAP: { key: string; label: string; dbKey: string }[] = [
  { key: 'scoreF', label: 'Contexto (F)', dbKey: 'score_f' },
  { key: 'scoreD', label: 'Dor (D)', dbKey: 'score_d' },
  { key: 'scoreEFI', label: 'Funcionalidade (EFI)', dbKey: 'score_efi' },
  { key: 'scoreP', label: 'Cinesiofobia (P)', dbKey: 'score_p' },
  { key: 'scoreR', label: 'Regulação (R)', dbKey: 'score_r' },
  { key: 'scoreC', label: 'Contexto Carga (C)', dbKey: 'score_c' },
];

const BLOCO_LABELS: Record<number, string> = {
  1: 'Anamnese e Mapeamento da Dor',
  3: 'Funcionalidade',
  4: 'Comportamento',
  5: 'Regulação Neurovegetativa',
};

const EXPECTED_BLOCOS = [1, 3, 4, 5];

export default function DashboardParcial({ scoresParciais, onIniciarAvaliacao }: Props) {
  const { scores, blocosRecebidos, blocoDados } = scoresParciais;

  // Build available scores for display
  const availableScores = SCORE_MAP
    .filter(s => scores[s.key] !== undefined)
    .map(s => ({
      ...s,
      value: Number(Number(scores[s.key]).toFixed(1)),
    }));

  // Build radar data (parcial — sem E)
  const radarData = availableScores.map(s => ({
    score: s.label.replace(/\s*\(.*\)/, ''),
    valor: s.value,
  }));

  const completionPct = (blocosRecebidos.length / EXPECTED_BLOCOS.length) * 100;

  // Terrenos calculation if enough data exists
  const terrenos = (blocoDados?.[1] && blocoDados?.[4] && blocoDados?.[5])
    ? calcularTerrenos(blocoDados[1], blocoDados[4], blocoDados[5], scores.scoreD || 0)
    : null;

  return (
    <div className="space-y-4">
      {/* Banner de status parcial */}
      <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-700 p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-sm text-foreground">Dashboard Parcial — Questionário Identidade Recebido</h3>
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
                Aguardando Estrutural
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              O paciente respondeu o questionário. Complete a avaliação estrutural (8 UCs) para calcular o Índice de Dor Final.
            </p>

            {/* Progress das etapas recebidas */}
            <div className="flex items-center gap-2 mb-2">
              <Progress value={completionPct} className="h-1.5 flex-1" />
              <span className="text-[10px] text-muted-foreground font-medium">{blocosRecebidos.length}/{EXPECTED_BLOCOS.length} etapas</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {EXPECTED_BLOCOS.map(b => {
                const received = blocosRecebidos.includes(b);
                return (
                  <div
                    key={b}
                    className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium ${received
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground'
                      }`}
                  >
                    {received ? '✓' : '○'} {BLOCO_LABELS[b]}
                  </div>
                );
              })}
            </div>
          </div>
          <Button
            size="sm"
            className="bg-identidade hover:bg-identidade/90 text-identidade-foreground gap-1.5 shrink-0"
            onClick={onIniciarAvaliacao}
          >
            <Dumbbell className="icon-sm" />
            Completar Avaliação
          </Button>
        </div>
      </div>

      {/* Scores parciais */}
      {availableScores.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Radar parcial */}
          {radarData.length >= 3 && (
            <div className="clinical-card">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-6 w-6 rounded-md bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <BarChart3 className="icon-sm text-amber-600" />
                </div>
                <h4 className="font-semibold text-sm">Perfil Parcial (Questionário Identidade)</h4>
                <Badge variant="outline" className="ml-auto text-[10px] border-amber-200 text-amber-600">Parcial</Badge>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid className="stroke-border" />
                    <PolarAngleAxis dataKey="score" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <Radar name="Score" dataKey="valor" stroke="hsl(var(--identidade))" fill="hsl(var(--identidade))" fillOpacity={0.15} strokeWidth={2} strokeDasharray="5 3" />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Barras dos scores disponíveis */}
          <div className="clinical-card">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-6 w-6 rounded-md bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Activity className="icon-sm text-amber-600" />
              </div>
              <h4 className="font-semibold text-sm">Scores Disponíveis</h4>
            </div>
            <div className="space-y-3">
              {availableScores.map(s => {
                const pct = Math.min((s.value / 10) * 100, 100);
                return (
                  <div key={s.key} className="flex items-center gap-3">
                    <div className="w-32 text-xs font-medium text-muted-foreground shrink-0">
                      {s.label}
                    </div>
                    <div className="flex-1 h-4 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-identidade/60 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold w-10 text-right text-foreground">{s.value}</span>
                  </div>
                );
              })}

              {/* Score E placeholder */}
              <div className="flex items-center gap-3 opacity-50">
                <div className="w-32 text-xs font-medium text-muted-foreground shrink-0 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Estrutural (E)
                </div>
                <div className="flex-1 h-4 rounded-full bg-muted overflow-hidden border border-dashed border-border">
                  <div className="h-full" />
                </div>
                <span className="text-sm font-bold w-10 text-right text-muted-foreground">—</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-dashed">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertCircle className="icon-sm text-amber-500" />
                <span>O <strong>ID Final</strong> será calculado após a avaliação estrutural presencial.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Terreno Modificável vs Não Modificável (Silhueta) -- Adicionado para visibilidade total */}
      {terrenos && (
        <div className="clinical-card border-2 border-primary/20 bg-gradient-to-br from-card to-primary/5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex-1 space-y-4 w-full">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <PersonStanding className="h-5 w-5 text-primary" />
                Terreno Modulável vs Não-Modificável
              </h3>
              <p className="text-sm text-muted-foreground">
                Baseado nas respostas do questionário. Os terrenos <strong>amplificam</strong> os sintomas.
                <br />Fator Amplificador: <strong>{terrenos.amplificadorDor.toFixed(2)}x</strong>
              </p>

              <div className="space-y-4 mt-6">
                <div>
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-sm font-bold text-green-600">Modificáveis ({terrenos.porcentagemMod}%)</span>
                    <span className="text-xs text-muted-foreground">{terrenos.itensModificaveis.length} itens</span>
                  </div>
                  <div className="h-3 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${terrenos.porcentagemMod}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-sm font-bold text-red-500">Não-Modificáveis ({terrenos.porcentagemNaoMod}%)</span>
                    <span className="text-xs text-muted-foreground">{terrenos.itensNaoModificaveis.length} itens</span>
                  </div>
                  <div className="h-3 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-red-400 transition-all" style={{ width: `${terrenos.porcentagemNaoMod}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="relative w-40 h-40 flex-shrink-0 flex items-center justify-center bg-card rounded-full border-4 border-muted shadow-inner">
              <PersonStanding className="h-20 w-20 text-primary opacity-80" strokeWidth={1} />
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="80" cy="80" r="76" className="stroke-secondary fill-none" strokeWidth="6" />
                <circle cx="80" cy="80" r="76" className="stroke-green-500 fill-none transition-all duration-1000" strokeWidth="6" strokeDasharray="477" strokeDashoffset={477 - (477 * terrenos.porcentagemMod) / 100} strokeLinecap="round" />
              </svg>
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="80" cy="80" r="66" className="stroke-secondary fill-none" strokeWidth="4" />
                <circle cx="80" cy="80" r="66" className="stroke-red-400 fill-none transition-all duration-1000" strokeWidth="4" strokeDasharray="414" strokeDashoffset={414 - (414 * terrenos.porcentagemNaoMod) / 100} strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
