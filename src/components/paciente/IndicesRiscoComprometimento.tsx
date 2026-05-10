import { useMemo } from 'react';
import { AlertTriangle, Shield, Heart, Brain, Activity, Zap, Target, Droplets, Cigarette, Wine, Footprints, BedDouble, Armchair, Waves, Utensils, Monitor, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calcularPerdaDimensao, DIMENSION_LABELS, DIMENSION_COLORS } from '@/utils/myid/lossTable';

interface ScoresInput {
  D?: number; EFI?: number; P?: number; I?: number; N?: number;
  R?: number; C?: number; AF?: number; HID?: number; NUT?: number; ERG?: number;
  score_e?: number; score_p?: number; score_c?: number; score_f?: number;
  score_d?: number; score_r?: number; score_efi?: number;
  scoreF?: number; scoreD?: number; scoreEFI?: number; scoreP?: number; scoreR?: number; scoreC?: number;
  id_final?: number;
}

interface HabitoAlerta {
  icon: React.ElementType;
  label: string;
  valor: string;
  status: 'critico' | 'alerta';
}

interface Props {
  scores: ScoresInput;
  parcial?: boolean;
  className?: string;
  dadosAvaliacao?: any;
}

interface DomainRisk {
  key: string;
  label: string;
  rawValue: number;
  lossPoints: number;
  riskLevel: 'baixo' | 'moderado' | 'alto' | 'critico';
  icon: React.ElementType;
  dica: string;
  color: string;
  type: 'demand' | 'capacity';
}

const RISK_STYLES = {
  baixo: { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  moderado: { bar: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  alto: { bar: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  critico: { bar: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
};

function getDica(key: string, riskLevel: string): string {
  const dicas: Record<string, Record<string, string>> = {
    D: { baixo: 'Dor controlada', moderado: 'Educação em dor', alto: 'Neuromodulação', critico: 'Intervenção urgente' },
    EFI: { baixo: 'Boa capacidade', moderado: 'Exercícios progressivos', alto: 'Reabilitação ativa', critico: 'Reabilitação intensiva' },
    P: { baixo: 'Boa relação com movimento', moderado: 'Exposição gradual', alto: 'Psicoeducação', critico: 'Psicoeducação intensiva' },
    I: { baixo: 'Estável', moderado: 'Monitorar mudanças', alto: 'Adaptar progressão', critico: 'Instabilidade sistêmica' },
    R: { baixo: 'Boa regulação', moderado: 'Regularizar rotina', alto: 'Sono prioritário', critico: 'Avaliação especializada' },
    C: { baixo: 'Contexto favorável', moderado: 'Manejo de estresse', alto: 'Suporte psicossocial', critico: 'Encaminhamento psicológico' },
    AF: { baixo: 'Ativo', moderado: 'Aumentar frequência', alto: 'Atividade prioritária', critico: 'Inatividade crítica' },
    HID: { baixo: 'Hidratação ótima', moderado: 'Aumentar ingestão', alto: 'Hidratação insuficiente', critico: 'Desidratação' },
    NUT: { baixo: 'Nutrição ótima', moderado: 'Ajustar dieta', alto: 'Nutrição inadequada', critico: 'Déficit nutricional' },
    ERG: { baixo: 'Ergonomia boa', moderado: 'Ajustar postura', alto: 'Ergonomia ruim', critico: 'Ergonomia crítica' },
    N: { baixo: 'Ruído mínimo', moderado: 'Monitorar sinais', alto: 'Ruído moderado', critico: 'Ruído alto - investigar' },
  };
  return dicas[key]?.[riskLevel] || '—';
}

const ICON_MAP: Record<string, React.ElementType> = {
  D: Heart, EFI: Activity, P: Brain, I: Zap, R: Shield, C: AlertTriangle,
  AF: Footprints, HID: Waves, NUT: Utensils, ERG: Monitor, N: Volume2,
};

const DIMENSION_DEFS: { key: string; type: 'demand' | 'capacity'; getVal: (s: ScoresInput) => number | null }[] = [
  { key: 'D', type: 'demand', getVal: s => s.D ?? s.score_d ?? s.scoreD ?? null },
  { key: 'EFI', type: 'demand', getVal: s => s.EFI ?? s.score_efi ?? s.scoreEFI ?? null },
  { key: 'P', type: 'demand', getVal: s => s.P ?? s.score_p ?? s.scoreP ?? null },
  { key: 'I', type: 'demand', getVal: s => s.I ?? null },
  { key: 'R', type: 'capacity', getVal: s => s.R ?? s.score_r ?? s.scoreR ?? null },
  { key: 'C', type: 'capacity', getVal: s => s.C ?? s.score_c ?? s.scoreC ?? null },
  { key: 'AF', type: 'capacity', getVal: s => s.AF ?? null },
  { key: 'HID', type: 'capacity', getVal: s => s.HID ?? null },
  { key: 'NUT', type: 'capacity', getVal: s => s.NUT ?? null },
  { key: 'ERG', type: 'capacity', getVal: s => s.ERG ?? null },
  { key: 'N', type: 'demand', getVal: s => s.N ?? null },
];

function extractHabitos(dadosAvaliacao: any): HabitoAlerta[] {
  if (!dadosAvaliacao) return [];
  const alertas: HabitoAlerta[] = [];
  const b1 = dadosAvaliacao.bloco1;
  if (b1) {
    if (b1.atividadeFisica === 'nenhuma') alertas.push({ icon: Footprints, label: 'Sedentário', valor: 'Sem atividade', status: 'critico' });
    if ((b1.litrosAgua ?? 2) < 1.5) alertas.push({ icon: Droplets, label: 'Hidratação', valor: `${b1.litrosAgua ?? 0}L/dia`, status: 'alerta' });
    if (b1.tabagismo) alertas.push({ icon: Cigarette, label: 'Tabagismo', valor: 'Ativo', status: 'critico' });
    if (b1.alcool === 'frequente') alertas.push({ icon: Wine, label: 'Álcool', valor: 'Frequente', status: 'critico' });
    if (b1.horasSedentario >= 10) alertas.push({ icon: Armchair, label: 'Sedentarismo', valor: `${b1.horasSedentario}h/dia`, status: 'critico' });
    else if (b1.horasSedentario >= 8) alertas.push({ icon: Armchair, label: 'Sedentarismo', valor: `${b1.horasSedentario}h/dia`, status: 'alerta' });
    if ((b1.qualidadeSono ?? 5) <= 3) alertas.push({ icon: BedDouble, label: 'Sono ruim', valor: `${b1.qualidadeSono}/10`, status: 'critico' });
  }
  return alertas;
}

export default function IndicesRiscoComprometimento({ scores, parcial, className, dadosAvaliacao }: Props) {
  const domains = useMemo((): DomainRisk[] => {
    const result: DomainRisk[] = [];
    for (const dim of DIMENSION_DEFS) {
      const raw = dim.getVal(scores);
      if (raw === null || raw === undefined) continue;
      const lossInput = dim.type === 'capacity' ? (10 - raw) : raw;
      const perda = calcularPerdaDimensao(dim.key, lossInput);

      let riskLevel: 'baixo' | 'moderado' | 'alto' | 'critico';
      if (perda.perda_pontos === 0) riskLevel = 'baixo';
      else if (perda.perda_pontos <= 3) riskLevel = 'moderado';
      else if (perda.perda_pontos <= 8) riskLevel = 'alto';
      else riskLevel = 'critico';

      result.push({
        key: dim.key,
        label: DIMENSION_LABELS[dim.key] || dim.key,
        rawValue: raw,
        lossPoints: perda.perda_pontos,
        riskLevel,
        icon: ICON_MAP[dim.key] || Target,
        dica: getDica(dim.key, riskLevel),
        color: DIMENSION_COLORS[dim.key] || '#64748b',
        type: dim.type,
      });
    }
    result.sort((a, b) => b.lossPoints - a.lossPoints);
    return result;
  }, [scores]);

  const habitos = useMemo(() => extractHabitos(dadosAvaliacao), [dadosAvaliacao]);

  if (domains.length === 0 && habitos.length === 0) return null;

  const criticos = domains.filter(d => d.riskLevel === 'critico' || d.riskLevel === 'alto');
  const totalLoss = domains.reduce((sum, d) => sum + d.lossPoints, 0);
  const overallLevel = totalLoss > 60 ? 'critico' : totalLoss > 35 ? 'alto' : totalLoss > 15 ? 'moderado' : 'baixo';

  return (
    <div className={cn('clinical-card p-3', className)}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-xs flex items-center gap-1.5">
          <AlertTriangle className="icon-sm text-destructive" />
          Risco Biopsicossocial (MyID-100)
          {parcial && <span className="text-[9px] text-amber-600 font-normal">(parcial)</span>}
        </h3>
        {domains.length > 0 && (
          <div className={cn(
            'text-[10px] font-bold px-2 py-0.5 rounded-full',
            RISK_STYLES[overallLevel].bg, RISK_STYLES[overallLevel].text
          )}>
            -{totalLoss}pts perdidos
          </div>
        )}
      </div>

      {criticos.length > 0 && (
        <p className="text-[10px] text-destructive mb-2 leading-tight">
          ⚠ {criticos.length} dimensão(ões) comprometida(s): {criticos.map(d => d.label).join(', ')}
        </p>
      )}

      {domains.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {domains.map(d => {
            const style = RISK_STYLES[d.riskLevel];
            const pct = Math.min((d.lossPoints / 20) * 100, 100);
            const Icon = d.icon;
            return (
              <div key={d.key} className={cn('rounded-lg border p-2', style.border, style.bg, 'bg-opacity-40')}>
                <div className="flex items-center gap-1 mb-1">
                  <Icon className={cn('h-3 w-3 shrink-0', style.text)} />
                  <span className="text-[11px] font-semibold flex-1 truncate">{d.label}</span>
                  <span className="text-[9px] font-bold text-muted-foreground">{d.type === 'capacity' ? '🛡' : '🔥'}</span>
                  <span className="text-xs font-black tabular-nums">-{d.lossPoints}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden mb-1">
                  <div className={cn('h-full rounded-full', style.bar)} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[9px] text-muted-foreground leading-tight">💡 {d.dica}</p>
                  <span className="text-[8px] text-muted-foreground/60">bruto: {d.rawValue.toFixed(1)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {habitos.length > 0 && (
        <div className={cn(domains.length > 0 && 'mt-2')}>
          <div className="flex flex-wrap gap-1.5">
            {habitos.map((h, i) => {
              const Icon = h.icon;
              const isCritico = h.status === 'critico';
              return (
                <div key={i} className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium',
                  isCritico
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                )}>
                  <Icon className="h-3 w-3 shrink-0" />
                  <span className="font-semibold">{h.label}</span>
                  <span className="opacity-70">{h.valor}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
