import { useMemo } from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  value: number;
  maxValue?: number;
}

const FAIXAS = [
  { label: 'Leve', min: 0, max: 10, color: 'hsl(152, 60%, 38%)', desc: 'Impacto mínimo. A dor não interfere significativamente na vida diária.' },
  { label: 'Moderado', min: 10, max: 20, color: 'hsl(40, 95%, 52%)', desc: 'Impacto moderado. A dor começa a limitar algumas atividades e afeta o bem-estar.' },
  { label: 'Severo', min: 20, max: 30, color: 'hsl(25, 90%, 52%)', desc: 'Impacto significativo. A dor interfere em múltiplas dimensões da vida diária.' },
  { label: 'Crítico', min: 30, max: 40, color: 'hsl(0, 80%, 55%)', desc: 'Impacto elevado. A dor domina várias áreas, com alto comprometimento funcional.' },
  { label: 'Extremo', min: 40, max: 50, color: 'hsl(280, 70%, 45%)', desc: 'Impacto máximo. A dor é altamente limitante e requer intervenção urgente.' },
];

export default function IdFinalGauge({ value, maxValue = 50 }: Props) {
  const faixaAtual = useMemo(() => {
    return FAIXAS.find(f => value >= f.min && value < f.max) || FAIXAS[FAIXAS.length - 1];
  }, [value]);

  // SVG gauge arc
  const percentage = Math.min(value / maxValue, 1);
  const startAngle = -135;
  const endAngle = 135;
  const totalAngle = endAngle - startAngle; // 270 degrees
  const needleAngle = startAngle + (percentage * totalAngle);

  const cx = 120, cy = 120, r = 90;

  const polarToCartesian = (angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  // Generate arc segments for each faixa
  const arcSegments = FAIXAS.map((faixa) => {
    const fStart = startAngle + (faixa.min / maxValue) * totalAngle;
    const fEnd = startAngle + (faixa.max / maxValue) * totalAngle;
    const start = polarToCartesian(fStart);
    const end = polarToCartesian(fEnd);
    const largeArc = (fEnd - fStart) > 180 ? 1 : 0;
    const d = `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
    return { ...faixa, d };
  });

  // Needle endpoint
  const needleEnd = polarToCartesian(needleAngle);

  return (
    <div className="flex flex-col items-center">
      {/* Gauge SVG */}
      <div className="relative" style={{ width: 240, height: 160 }}>
        <svg width="240" height="160" viewBox="0 0 240 160">
          {/* Arc segments */}
          {arcSegments.map((seg) => (
            <path
              key={seg.label}
              d={seg.d}
              fill="none"
              stroke={seg.color}
              strokeWidth="16"
              strokeLinecap="butt"
              opacity={seg.label === faixaAtual.label ? 1 : 0.3}
            />
          ))}
          {/* Needle */}
          <line
            x1={cx}
            y1={cy}
            x2={needleEnd.x}
            y2={needleEnd.y}
            stroke="hsl(var(--foreground))"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r="6" fill="hsl(var(--identidade))" />
          <circle cx={cx} cy={cy} r="3" fill="hsl(var(--identidade-foreground))" />
        </svg>
        {/* Center value */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
          <div className="text-3xl font-extrabold" style={{ color: faixaAtual.color }}>
            {value.toFixed(1)}
          </div>
          <div className="text-xs text-muted-foreground">de {maxValue}</div>
        </div>
      </div>

      {/* Classification badge */}
      <div
        className="mt-2 px-4 py-1.5 rounded-full text-sm font-bold text-white"
        style={{ backgroundColor: faixaAtual.color }}
      >
        {faixaAtual.label}
      </div>

      {/* Explanation */}
      <p className="text-xs text-muted-foreground text-center mt-2 max-w-xs leading-relaxed">
        {faixaAtual.desc}
      </p>

      {/* Faixas legend */}
      <div className="mt-4 w-full">
        <div className="flex items-center gap-1 mb-2">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Escala de Referência</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3 w-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                O ID Final (Equação da Dor) representa o impacto multidimensional da dor na vida do paciente, considerando Dor, Cinesiofobia, Contexto, Regulação e Funcionalidade.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex gap-1 rounded-lg overflow-hidden h-3">
          {FAIXAS.map((f) => (
            <div
              key={f.label}
              className="flex-1 relative"
              style={{ backgroundColor: f.color, opacity: f.label === faixaAtual.label ? 1 : 0.35 }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-muted-foreground">0</span>
          <span className="text-[9px] text-muted-foreground">10</span>
          <span className="text-[9px] text-muted-foreground">20</span>
          <span className="text-[9px] text-muted-foreground">30</span>
          <span className="text-[9px] text-muted-foreground">40</span>
          <span className="text-[9px] text-muted-foreground">50</span>
        </div>
      </div>
    </div>
  );
}
