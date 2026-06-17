import { cn } from '@/lib/utils';
import { Moon, Zap, Droplets, Utensils, Brain, Activity, AlertTriangle } from 'lucide-react';

interface Props {
  scores: {
    R?: number | null;    // Regulação (sono/estresse) — ≥7 ruim
    AF?: number | null;   // Atividade Física — ≥6 ruim
    HID?: number | null;  // Hidratação — ≥7 ruim
    NUT?: number | null;  // Nutrição — ≥6 ruim
    C?: number | null;    // Contexto social — ≥6 ruim
    P?: number | null;    // Psicológico — ≥5 ruim
    I?: number | null;    // Inércia — ≥6 ruim
    D?: number | null;    // Dor — qualquer valor
    ERG?: number | null;  // Ergonomia — ≥6 ruim
  };
  alergias?: string | null;
  medicamentos?: string | null;
  mostrar?: boolean; // default true
}

type ChipVariant = 'green' | 'amber' | 'orange' | 'red' | 'blue';

interface ChipData {
  icon: React.ReactNode;
  label: string;
  status: string;
  variant: ChipVariant;
  tooltip?: string;
}

function scoreToVariant(score: number, thresholds: { bad: number; warn: number }): ChipVariant {
  if (score >= thresholds.bad) return 'orange';
  if (score >= thresholds.warn) return 'amber';
  return 'green';
}

function avg(...values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null && v > 0);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function countItems(text: string): number {
  // Split by comma, newline, or semicolon and filter empty strings
  return text.split(/[,\n;]+/).filter((s) => s.trim().length > 0).length;
}

const variantClasses: Record<ChipVariant, string> = {
  green:  'bg-emerald-50 text-emerald-700 border border-emerald-200',
  amber:  'bg-amber-50 text-amber-700 border border-amber-200',
  orange: 'bg-orange-50 text-orange-700 border border-orange-200',
  red:    'bg-red-50 text-red-700 border border-red-300 font-bold',
  blue:   'bg-blue-50 text-blue-700 border border-blue-200',
};

export function PainelContexto({ scores, alergias, medicamentos, mostrar = true }: Props) {
  if (!mostrar) return null;

  const chips: ChipData[] = [];

  // 1. Sono & Regulação (R) — ≥7 ruim, thresholds: warn=4, bad=7
  const R = scores.R ?? null;
  if (R != null && R > 0) {
    const variant = scoreToVariant(R, { warn: 4, bad: 7 });
    const statusMap: Record<ChipVariant, string> = {
      green: 'Adequado', amber: 'Atenção', orange: 'Comprometido', red: 'Comprometido', blue: 'Adequado',
    };
    chips.push({
      icon: <Moon className="h-3 w-3" />,
      label: 'Sono',
      status: statusMap[variant],
      variant,
    });
  }

  // 2. Atividade Física (AF + I combined avg) — ≥7 ruim (warn=4, bad=7)
  const afAvg = avg(scores.AF, scores.I);
  if (afAvg != null) {
    const variant = scoreToVariant(afAvg, { warn: 4, bad: 7 });
    const statusMap: Record<ChipVariant, string> = {
      green: 'Ativo', amber: 'Moderado', orange: 'Reduzida', red: 'Reduzida', blue: 'Ativo',
    };
    chips.push({
      icon: <Activity className="h-3 w-3" />,
      label: 'Atividade',
      status: statusMap[variant],
      variant,
    });
  }

  // 3. Hidratação (HID) — ≥7 ruim (warn=4, bad=7)
  const HID = scores.HID ?? null;
  if (HID != null && HID > 0) {
    const variant = scoreToVariant(HID, { warn: 4, bad: 7 });
    const statusMap: Record<ChipVariant, string> = {
      green: 'Adequada', amber: 'Atenção', orange: 'Insuficiente', red: 'Insuficiente', blue: 'Adequada',
    };
    chips.push({
      icon: <Droplets className="h-3 w-3" />,
      label: 'Hidratação',
      status: statusMap[variant],
      variant,
    });
  }

  // 4. Nutrição (NUT) — ≥7 ruim (warn=4, bad=7); never alarming language
  const NUT = scores.NUT ?? null;
  if (NUT != null && NUT > 0) {
    const variant = scoreToVariant(NUT, { warn: 4, bad: 7 });
    const statusMap: Record<ChipVariant, string> = {
      green: 'Equilibrada', amber: 'Atenção', orange: 'Atenção', red: 'Atenção', blue: 'Equilibrada',
    };
    chips.push({
      icon: <Utensils className="h-3 w-3" />,
      label: 'Nutrição',
      status: statusMap[variant],
      variant,
    });
  }

  // 5. Psicossocial (avg of P and C) — ≥7 ruim (warn=4, bad=7)
  const psicAvg = avg(scores.P, scores.C);
  if (psicAvg != null) {
    const variant = scoreToVariant(psicAvg, { warn: 4, bad: 7 });
    const statusMap: Record<ChipVariant, string> = {
      green: 'Equilibrado', amber: 'Atenção', orange: 'Elevado', red: 'Elevado', blue: 'Equilibrado',
    };
    chips.push({
      icon: <Brain className="h-3 w-3" />,
      label: 'Psicossocial',
      status: statusMap[variant],
      variant,
    });
  }

  // 6. Ergonomia (ERG) — only show if ERG ≥ 4
  const ERG = scores.ERG ?? null;
  if (ERG != null && ERG >= 4) {
    const variant: ChipVariant = ERG >= 7 ? 'orange' : 'amber';
    const status = ERG >= 7 ? 'Sobrecarga postural' : 'Atenção postural';
    chips.push({
      icon: <Zap className="h-3 w-3" />,
      label: 'Ergonomia',
      status,
      variant,
    });
  }

  // 7. Alergias — red badge if non-empty
  const hasAlergias = alergias != null && alergias.trim().length > 0;
  if (hasAlergias) {
    const truncated = alergias!.length > 60 ? alergias!.slice(0, 60) + '…' : alergias!;
    chips.push({
      icon: <AlertTriangle className="h-3 w-3" />,
      label: 'Alergias registradas',
      status: '',
      variant: 'red',
      tooltip: truncated,
    });
  }

  // 8. Medicamentos — blue badge if non-empty
  const hasMedicamentos = medicamentos != null && medicamentos.trim().length > 0;
  if (hasMedicamentos) {
    const count = countItems(medicamentos!);
    chips.push({
      icon: <span className="text-[10px] leading-none">💊</span>,
      label: 'Em uso',
      status: count > 1 ? `${count} medicamentos` : '1 medicamento',
      variant: 'blue',
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
        Contexto de Saúde
      </p>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip, idx) => (
          <span
            key={idx}
            title={chip.tooltip}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold',
              variantClasses[chip.variant],
            )}
          >
            {chip.icon}
            {chip.label}
            {chip.status ? ` · ${chip.status}` : ''}
          </span>
        ))}
      </div>
    </div>
  );
}
