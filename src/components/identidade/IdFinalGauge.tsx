import { useMemo } from 'react';
import { Info, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  value: number;
  maxValue?: number;
  /** Compact mode hides legend bar */
  compact?: boolean;
}

const FAIXAS = [
  { label: 'Leve', min: 0, max: 10, color: 'hsl(152, 60%, 38%)', gradient: ['hsl(152,60%,45%)', 'hsl(142,71%,32%)'] },
  { label: 'Moderado', min: 10, max: 20, color: 'hsl(40, 95%, 52%)', gradient: ['hsl(45,95%,55%)', 'hsl(35,90%,42%)'] },
  { label: 'Severo', min: 20, max: 30, color: 'hsl(25, 90%, 52%)', gradient: ['hsl(25,95%,58%)', 'hsl(15,85%,42%)'] },
  { label: 'Crítico', min: 30, max: 40, color: 'hsl(0, 80%, 55%)', gradient: ['hsl(0,72%,55%)', 'hsl(0,72%,40%)'] },
  { label: 'Extremo', min: 40, max: 50, color: 'hsl(280, 70%, 45%)', gradient: ['hsl(280,70%,50%)', 'hsl(280,70%,35%)'] },
];

const FAIXA_DESCS: Record<string, string> = {
  'Leve': 'Impacto mínimo. A dor não interfere significativamente na vida diária.',
  'Moderado': 'Impacto moderado. A dor começa a limitar algumas atividades.',
  'Severo': 'Impacto significativo. A dor interfere em múltiplas dimensões.',
  'Crítico': 'Impacto elevado. Alto comprometimento funcional.',
  'Extremo': 'Impacto máximo. Requer intervenção urgente.',
};

export default function IdFinalGauge({ value, maxValue = 50, compact = false }: Props) {
  const faixaAtual = useMemo(() => {
    return FAIXAS.find(f => value >= f.min && value < f.max) || FAIXAS[FAIXAS.length - 1];
  }, [value]);

  const percentage = Math.min(value / maxValue, 1);

  // Arc geometry: 270° sweep from -225° to 45°
  const startAngle = -225;
  const totalAngle = 270;
  const cx = 120, cy = 120, r = 90;
  const gradId = `gauge-grad-${useMemo(() => Math.random().toString(36).slice(2, 6), [])}`;

  const polarToCartesian = (angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  // Background segments per faixa
  const arcSegments = FAIXAS.map((faixa) => {
    const fStart = startAngle + (faixa.min / maxValue) * totalAngle;
    const fEnd = startAngle + (Math.min(faixa.max, maxValue) / maxValue) * totalAngle;
    const start = polarToCartesian(fStart);
    const end = polarToCartesian(fEnd);
    const largeArc = (fEnd - fStart) > 180 ? 1 : 0;
    return { ...faixa, d: `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}` };
  });

  // Foreground active arc
  const currentAngle = startAngle + (percentage * totalAngle);
  const fgStart = polarToCartesian(startAngle);
  const fgEnd = polarToCartesian(currentAngle);
  const fgLargeArc = (percentage * totalAngle) > 180 ? 1 : 0;
  const fgPath = `M ${fgStart.x} ${fgStart.y} A ${r} ${r} 0 ${fgLargeArc} 1 ${fgEnd.x} ${fgEnd.y}`;

  // Tick marks
  const ticks = [0, 10, 20, 30, 40, 50];

  const getBadgeStyle = () => {
    switch (faixaAtual.label) {
      case 'Leve': return 'bg-green-100 text-green-800 border-green-300';
      case 'Moderado': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Severo': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Crítico': return 'bg-red-100 text-red-800 border-red-300';
      case 'Extremo': return 'bg-red-600 text-white border-red-700';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const isCritical = faixaAtual.label === 'Crítico' || faixaAtual.label === 'Extremo';

  return (
    <div className="flex flex-col items-center">
      {/* Gauge SVG */}
      <div className="relative w-full max-w-[260px]">
        <svg viewBox="0 0 240 165" className="w-full">
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={faixaAtual.gradient[0]} />
              <stop offset="100%" stopColor={faixaAtual.gradient[1]} />
            </linearGradient>
            <filter id={`glow-${gradId}`}>
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Background faixa segments */}
          {arcSegments.map((seg) => (
            <path
              key={seg.label}
              d={seg.d}
              fill="none"
              stroke={seg.color}
              strokeWidth="18"
              strokeLinecap="butt"
              opacity={seg.label === faixaAtual.label ? 0.25 : 0.1}
            />
          ))}

          {/* Active foreground arc with gradient + glow */}
          {percentage > 0 && (
            <path
              d={fgPath}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth="18"
              strokeLinecap="round"
              filter={`url(#glow-${gradId})`}
            />
          )}

          {/* End dot */}
          {percentage > 0 && (
            <circle cx={fgEnd.x} cy={fgEnd.y} r="5" fill={faixaAtual.color} stroke="white" strokeWidth="2.5" />
          )}

          {/* Tick marks */}
          {ticks.map(tick => {
            const tickPct = tick / maxValue;
            const tickAngle = startAngle + (tickPct * totalAngle);
            const outerR = r + 16;
            const pos = (() => {
              const rad = (tickAngle * Math.PI) / 180;
              return { x: cx + outerR * Math.cos(rad), y: cy + outerR * Math.sin(rad) };
            })();
            return (
              <text key={tick} x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle"
                fontSize="8" fill="hsl(220, 10%, 55%)" fontWeight="600" fontFamily="system-ui">
                {tick}
              </text>
            );
          })}

          {/* Center value */}
          <text x={cx} y={cy - 8} textAnchor="middle" fontSize="38" fontWeight="900"
            fill={faixaAtual.color} fontFamily="system-ui">
            {value.toFixed(1)}
          </text>
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="hsl(220, 10%, 55%)" fontFamily="system-ui">
            de {maxValue}
          </text>
        </svg>
      </div>

      {/* Classification badge */}
      <div className={`-mt-1 px-4 py-1.5 rounded-full border-2 font-bold text-sm flex items-center gap-1.5 ${getBadgeStyle()}`}>
        {isCritical && <AlertTriangle className="h-3.5 w-3.5" />}
        {faixaAtual.label}
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground text-center mt-2 max-w-xs leading-relaxed">
        {FAIXA_DESCS[faixaAtual.label]}
      </p>

      {/* Legend bar */}
      {!compact && (
        <div className="mt-4 w-full max-w-xs">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Escala de Referência</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  O ID Final (Equação da Dor) representa o impacto multidimensional da dor, considerando Dor, Cinesiofobia, Contexto, Regulação e Funcionalidade.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex gap-0.5 rounded-lg overflow-hidden h-3">
            {FAIXAS.map((f) => (
              <div
                key={f.label}
                className="flex-1 transition-opacity"
                style={{ backgroundColor: f.color, opacity: f.label === faixaAtual.label ? 1 : 0.25 }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            {[0, 10, 20, 30, 40, 50].map(v => (
              <span key={v} className="text-[9px] text-muted-foreground">{v}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
