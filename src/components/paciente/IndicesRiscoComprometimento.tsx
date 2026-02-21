import { useMemo } from 'react';
import { AlertTriangle, Shield, Heart, Brain, Activity, Zap, Target } from 'lucide-react';
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
  value: number;
  riskLevel: 'baixo' | 'moderado' | 'alto' | 'critico';
  icon: React.ElementType;
  dica: string;
}

const RISK_STYLES = {
  baixo: { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', badge: '🟢' },
  moderado: { bar: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', badge: '🟡' },
  alto: { bar: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', badge: '🟠' },
  critico: { bar: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', badge: '🔴' },
};

function getRiskLevel(value: number): 'baixo' | 'moderado' | 'alto' | 'critico' {
  if (value <= 3) return 'baixo';
  if (value <= 5) return 'moderado';
  if (value <= 7.5) return 'alto';
  return 'critico';
}

function getDica(key: string, value: number): string {
  const dicas: Record<string, string[]> = {
    dor: ['Dor controlada', 'Educação em dor', 'Neuromodulação urgente'],
    cinesiofobia: ['Boa relação com movimento', 'Exposição gradual', 'Psicoeducação intensiva'],
    carga: ['Contexto favorável', 'Manejo de estresse', 'Encaminhamento psicológico'],
    regulacao: ['Boa regulação', 'Regularizar rotina', 'Avaliação especializada'],
    contexto: ['Perfil favorável', 'Modificar hábitos', 'Abordagem multidisciplinar'],
    funcionalidade: ['Boa capacidade', 'Exercícios progressivos', 'Reabilitação intensiva'],
    estrutural: ['Integridade preservada', 'Mobilização + fortalecimento', 'Terapia manual intensiva'],
  };
  const arr = dicas[key] || ['—', '—', '—'];
  return value <= 4 ? arr[0] : value <= 7 ? arr[1] : arr[2];
}

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

    const map: { key: string; field: keyof typeof s; label: string; icon: React.ElementType }[] = [
      { key: 'dor', field: 'd', label: 'Dor', icon: Heart },
      { key: 'cinesiofobia', field: 'p', label: 'Cinesiofobia', icon: Brain },
      { key: 'carga', field: 'c', label: 'Carga Contextual', icon: Zap },
      { key: 'regulacao', field: 'r', label: 'Regulação', icon: Shield },
      { key: 'contexto', field: 'f', label: 'Fat. Contextuais', icon: AlertTriangle },
      { key: 'funcionalidade', field: 'efi', label: 'Funcionalidade', icon: Activity },
      { key: 'estrutural', field: 'e', label: 'Estrutural', icon: Target },
    ];

    const result: DomainRisk[] = [];
    for (const m of map) {
      const val = s[m.field];
      if (val === null) continue;
      const level = getRiskLevel(val);
      result.push({ key: m.key, label: m.label, value: val, riskLevel: level, icon: m.icon, dica: getDica(m.key, val) });
    }

    const order = { critico: 0, alto: 1, moderado: 2, baixo: 3 };
    result.sort((a, b) => order[a.riskLevel] - order[b.riskLevel] || b.value - a.value);
    return result;
  }, [scores]);

  if (domains.length === 0) return null;

  const criticos = domains.filter(d => d.riskLevel === 'critico' || d.riskLevel === 'alto');
  const overallRisk = Math.round(
    (domains.reduce((sum, d) => sum + d.value, 0) / (domains.length * 10)) * 100
  );
  const overallLevel = overallRisk > 75 ? 'critico' : overallRisk > 50 ? 'alto' : overallRisk > 30 ? 'moderado' : 'baixo';

  return (
    <div className={cn('clinical-card p-3', className)}>
      {/* Header compacto */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-xs flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
          Risco Biopsicossocial
          {parcial && <span className="text-[9px] text-amber-600 font-normal">(parcial)</span>}
        </h3>
        <div className={cn(
          'text-[10px] font-bold px-2 py-0.5 rounded-full',
          RISK_STYLES[overallLevel].bg, RISK_STYLES[overallLevel].text
        )}>
          {overallRisk}% risco
        </div>
      </div>

      {/* Alerta resumido */}
      {criticos.length > 0 && (
        <p className="text-[10px] text-destructive mb-2 leading-tight">
          ⚠ {criticos.length} domínio{criticos.length > 1 ? 's' : ''} comprometido{criticos.length > 1 ? 's' : ''}: {criticos.map(d => d.label).join(', ')}
        </p>
      )}

      {/* Grid compacto 2 colunas */}
      <div className="grid grid-cols-2 gap-1.5">
        {domains.map(d => {
          const style = RISK_STYLES[d.riskLevel];
          const pct = Math.min((d.value / 10) * 100, 100);
          const Icon = d.icon;
          return (
            <div key={d.key} className={cn('rounded-lg border p-2', style.border, style.bg, 'bg-opacity-40')}>
              <div className="flex items-center gap-1 mb-1">
                <Icon className={cn('h-3 w-3 shrink-0', style.text)} />
                <span className="text-[11px] font-semibold flex-1 truncate">{d.label}</span>
                <span className="text-xs font-black tabular-nums">{d.value.toFixed(1)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden mb-1">
                <div className={cn('h-full rounded-full', style.bar)} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[9px] text-muted-foreground leading-tight">💡 {d.dica}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
