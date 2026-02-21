import { useMemo } from 'react';
import { AlertTriangle, Shield, Heart, Brain, Activity, Zap, TrendingDown, TrendingUp, Target, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ScoresInput {
  score_e?: number;
  score_p?: number;
  score_c?: number;
  score_f?: number;
  score_d?: number;
  score_r?: number;
  score_efi?: number;
  id_final?: number;
  // Questionário parcial keys
  scoreF?: number;
  scoreD?: number;
  scoreEFI?: number;
  scoreP?: number;
  scoreR?: number;
  scoreC?: number;
}

interface Props {
  scores: ScoresInput;
  parcial?: boolean;
  className?: string;
}

interface DomainRisk {
  key: string;
  label: string;
  fullLabel: string;
  value: number;
  max: number;
  riskLevel: 'baixo' | 'moderado' | 'alto' | 'critico';
  icon: React.ElementType;
  impacto: string;
  recomendacao: string;
  inverted?: boolean; // true = higher is worse
}

const RISK_THRESHOLDS = {
  baixo: { max: 3, color: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  moderado: { max: 5, color: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  alto: { max: 7.5, color: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  critico: { max: 10, color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
};

function getRiskLevel(value: number): 'baixo' | 'moderado' | 'alto' | 'critico' {
  if (value <= 3) return 'baixo';
  if (value <= 5) return 'moderado';
  if (value <= 7.5) return 'alto';
  return 'critico';
}

const RISK_LABELS = {
  baixo: 'Baixo',
  moderado: 'Moderado',
  alto: 'Alto',
  critico: 'Crítico',
};

export default function IndicesRiscoComprometimento({ scores, parcial, className }: Props) {
  const domains = useMemo((): DomainRisk[] => {
    const s = {
      d: scores.score_d ?? scores.scoreD ?? null,
      p: scores.score_p ?? scores.scoreP ?? null,
      c: scores.score_c ?? scores.scoreC ?? null,
      f: scores.score_f ?? scores.scoreF ?? null,
      r: scores.score_r ?? scores.scoreR ?? null,
      efi: scores.score_efi ?? scores.scoreEFI ?? null,
      e: scores.score_e ?? null,
    };

    const result: DomainRisk[] = [];

    if (s.d !== null) result.push({
      key: 'dor', label: 'D', fullLabel: 'Índice de Dor', value: s.d, max: 10,
      riskLevel: getRiskLevel(s.d), icon: Heart, inverted: true,
      impacto: s.d > 7 ? 'Dor intensa compromete funcionalidade e qualidade de vida' : s.d > 5 ? 'Dor moderada limita atividades diárias' : 'Dor controlada',
      recomendacao: s.d > 7 ? 'Neuromodulação + terapia manual intensiva' : s.d > 5 ? 'Exercício terapêutico + educação em dor' : 'Manutenção do controle',
    });

    if (s.p !== null) result.push({
      key: 'cinesiofobia', label: 'P', fullLabel: 'Cinesiofobia', value: s.p, max: 10,
      riskLevel: getRiskLevel(s.p), icon: Brain, inverted: true,
      impacto: s.p > 7 ? 'Medo do movimento impede adesão ao tratamento' : s.p > 5 ? 'Comportamento de evitação moderado' : 'Boa relação com o movimento',
      recomendacao: s.p > 7 ? 'Psicoeducação + exposição gradual ao movimento' : s.p > 5 ? 'Educação em neurociência da dor' : 'Estimular atividade física regular',
    });

    if (s.c !== null) result.push({
      key: 'carga', label: 'C', fullLabel: 'Carga Contextual', value: s.c, max: 10,
      riskLevel: getRiskLevel(s.c), icon: Zap, inverted: true,
      impacto: s.c > 7 ? 'Estresse crônico dificulta recuperação' : s.c > 5 ? 'Fatores contextuais desfavoráveis' : 'Contexto favorável à recuperação',
      recomendacao: s.c > 7 ? 'Encaminhamento psicológico + manejo de estresse' : s.c > 5 ? 'Técnicas de relaxamento + suporte social' : 'Manter equilíbrio atual',
    });

    if (s.r !== null) result.push({
      key: 'regulacao', label: 'R', fullLabel: 'Regulação Neurovegetativa', value: s.r, max: 10,
      riskLevel: getRiskLevel(s.r), icon: Shield, inverted: true,
      impacto: s.r > 7 ? 'Desregulação severa: sono, energia e humor comprometidos' : s.r > 5 ? 'Padrões de sono e energia abaixo do ideal' : 'Boa regulação neurovegetativa',
      recomendacao: s.r > 7 ? 'Higiene do sono rigorosa + avaliação especializada' : s.r > 5 ? 'Regularizar rotina de sono e atividade' : 'Manutenção dos hábitos',
    });

    if (s.f !== null) result.push({
      key: 'contexto', label: 'F', fullLabel: 'Fatores Contextuais', value: s.f, max: 10,
      riskLevel: getRiskLevel(s.f), icon: AlertTriangle, inverted: true,
      impacto: s.f > 7 ? 'Comorbidades e hábitos aumentam risco' : s.f > 5 ? 'Fatores de risco moderados' : 'Perfil favorável',
      recomendacao: s.f > 7 ? 'Abordagem multidisciplinar essencial' : s.f > 5 ? 'Modificação de hábitos de vida' : 'Prevenção e educação',
    });

    if (s.efi !== null) result.push({
      key: 'funcionalidade', label: 'EFI', fullLabel: 'Funcionalidade', value: s.efi, max: 10,
      riskLevel: getRiskLevel(s.efi), icon: Activity, inverted: true,
      impacto: s.efi > 7 ? 'Incapacidade funcional significativa' : s.efi > 5 ? 'Limitações funcionais moderadas' : 'Boa capacidade funcional',
      recomendacao: s.efi > 7 ? 'Reabilitação funcional intensiva' : s.efi > 5 ? 'Exercícios funcionais progressivos' : 'Manutenção e prevenção',
    });

    if (s.e !== null) result.push({
      key: 'estrutural', label: 'E', fullLabel: 'Estrutural', value: s.e, max: 10,
      riskLevel: getRiskLevel(s.e), icon: Target, inverted: true,
      impacto: s.e > 7 ? 'Disfunções estruturais severas em múltiplas UCs' : s.e > 5 ? 'Disfunções moderadas localizadas' : 'Integridade estrutural preservada',
      recomendacao: s.e > 7 ? 'Terapia manual intensiva + estabilização' : s.e > 5 ? 'Mobilização articular + fortalecimento' : 'Manutenção e monitoramento',
    });

    // Sort by risk level (most compromised first)
    const order = { critico: 0, alto: 1, moderado: 2, baixo: 3 };
    result.sort((a, b) => order[a.riskLevel] - order[b.riskLevel] || b.value - a.value);

    return result;
  }, [scores]);

  if (domains.length === 0) return null;

  const criticos = domains.filter(d => d.riskLevel === 'critico');
  const altos = domains.filter(d => d.riskLevel === 'alto');
  const comprometidos = [...criticos, ...altos];

  // Calculate overall risk score (0-100)
  const overallRisk = Math.round(
    (domains.reduce((sum, d) => sum + d.value, 0) / (domains.length * 10)) * 100
  );
  const overallLevel = overallRisk > 75 ? 'critico' : overallRisk > 50 ? 'alto' : overallRisk > 30 ? 'moderado' : 'baixo';
  const overallStyle = RISK_THRESHOLDS[overallLevel];

  return (
    <div className={cn('clinical-card', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center', overallStyle.bg)}>
            <TrendingDown className={cn('h-4 w-4', overallStyle.text)} />
          </div>
          <div>
            <h3 className="font-bold text-sm">Índices de Risco Biopsicossocial</h3>
            <p className="text-[10px] text-muted-foreground">Demandas do questionário identidade</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {parcial && (
            <Badge variant="outline" className="text-[10px] border-amber-200 text-amber-600">Parcial</Badge>
          )}
          <div className={cn('px-2.5 py-1 rounded-full text-[11px] font-bold', overallStyle.bg, overallStyle.text)}>
            Risco: {overallRisk}%
          </div>
        </div>
      </div>

      {/* Comprometimento Summary */}
      {comprometidos.length > 0 && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            <span className="text-xs font-bold text-destructive">
              {comprometidos.length} domínio{comprometidos.length > 1 ? 's' : ''} comprometido{comprometidos.length > 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {comprometidos.map(d => d.fullLabel).join(', ')} — exigem atenção prioritária no plano terapêutico.
            A adesão ao tratamento nestes domínios pode melhorar significativamente a qualidade de vida.
          </p>
        </div>
      )}

      {/* Domain Bars */}
      <div className="space-y-2.5">
        {domains.map(d => {
          const style = RISK_THRESHOLDS[d.riskLevel];
          const pct = Math.min((d.value / d.max) * 100, 100);
          const Icon = d.icon;
          return (
            <div key={d.key} className={cn('rounded-lg border p-2.5 transition-all', style.border, style.bg, 'bg-opacity-30')}>
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className={cn('h-3.5 w-3.5 shrink-0', style.text)} />
                <span className="text-xs font-bold flex-1">{d.fullLabel}</span>
                <Badge className={cn('text-[9px] h-4 px-1.5', style.bg, style.text, 'border', style.border)}>
                  {RISK_LABELS[d.riskLevel]}
                </Badge>
                <span className="text-sm font-black tabular-nums w-12 text-right">{d.value.toFixed(1)}/10</span>
              </div>
              <div className="h-2 rounded-full bg-muted/60 overflow-hidden mb-1.5">
                <div className={cn('h-full rounded-full transition-all duration-700', style.color)} style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-start gap-1.5">
                <div className="flex-1">
                  <p className="text-[10px] text-muted-foreground leading-tight">{d.impacto}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <TrendingUp className="h-2.5 w-2.5 text-emerald-600" />
                  <span className="text-[10px] text-emerald-700 font-medium leading-tight">{d.recomendacao}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Adherence message */}
      <div className="mt-4 pt-3 border-t border-dashed flex items-start gap-2">
        <Target className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-foreground">Potencial de melhora com adesão ao tratamento</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
            {comprometidos.length > 0
              ? `Pacientes com perfil semelhante que aderem ao tratamento demonstram melhora de 40-60% nos domínios comprometidos após 8-12 semanas de intervenção.`
              : `Perfil biopsicossocial favorável. Manter acompanhamento preventivo e estimular hábitos saudáveis.`
            }
          </p>
        </div>
      </div>
    </div>
  );
}
