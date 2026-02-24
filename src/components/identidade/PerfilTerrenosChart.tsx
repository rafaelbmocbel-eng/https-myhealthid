import { useMemo } from 'react';
import { AvaliacaoIdentidade, Bloco1Data, Bloco5Data } from '@/types/identidade';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ── Ring data definitions ────────────────────────────────────────
interface RingSegment {
  id: string;
  label: string;
  value: number; // 0-10
  maxValue: number;
  category: 'modificavel' | 'nao_modificavel';
  color: string;
  icon: string;
}

interface PainPoint {
  cx: number;
  cy: number;
  intensity: number;
  nome: string;
}

interface Props {
  avaliacao: AvaliacaoIdentidade;
  className?: string;
}

// ── Extract ring data from assessment ────────────────────────────
function extractRingSegments(avaliacao: AvaliacaoIdentidade): RingSegment[] {
  const b1 = avaliacao.bloco1;
  const b5 = avaliacao.bloco5;

  // Modifiable factors (inner rings — closer to center)
  const modificaveis: RingSegment[] = [
    {
      id: 'sono',
      label: 'Qualidade do Sono',
      value: b5.qualidadeSono ?? 5,
      maxValue: 10,
      category: 'modificavel',
      color: 'hsl(var(--score-r))',
      icon: '🌙',
    },
    {
      id: 'hidratacao',
      label: 'Hidratação',
      value: Math.min((b1.litrosAgua ?? 2) * 2.5, 10), // 0-4L mapped to 0-10
      maxValue: 10,
      category: 'modificavel',
      color: 'hsl(200, 70%, 50%)',
      icon: '💧',
    },
    {
      id: 'sedentarismo',
      label: 'Sedentarismo',
      value: Math.min((b1.horasSedentario ?? 8) / 1.6, 10), // 0-16h mapped
      maxValue: 10,
      category: 'modificavel',
      color: 'hsl(var(--score-f))',
      icon: '🪑',
    },
    {
      id: 'estresse',
      label: 'Estresse',
      value: b5.nivelStress ?? 5,
      maxValue: 10,
      category: 'modificavel',
      color: 'hsl(var(--score-p))',
      icon: '🧠',
    },
    {
      id: 'fadiga',
      label: 'Fadiga',
      value: b5.fadigaDia ?? 5,
      maxValue: 10,
      category: 'modificavel',
      color: 'hsl(var(--score-c))',
      icon: '⚡',
    },
    {
      id: 'tabagismo',
      label: 'Tabagismo',
      value: b1.tabagismo ? 8 : 0,
      maxValue: 10,
      category: 'modificavel',
      color: 'hsl(0, 60%, 55%)',
      icon: '🚬',
    },
    {
      id: 'trabalho',
      label: 'Carga de Trabalho',
      value: b5.cargaLaboral ?? b1.interferenciaTrbalho ?? 5,
      maxValue: 10,
      category: 'modificavel',
      color: 'hsl(var(--accent))',
      icon: '💼',
    },
    {
      id: 'lazer',
      label: 'Atividade Física/Lazer',
      value: b1.atividadeFisica === 'nenhuma' ? 0 : b1.atividadeFisica === 'leve' ? 3 : b1.atividadeFisica === 'moderada' ? 6 : 9,
      maxValue: 10,
      category: 'modificavel',
      color: 'hsl(var(--success))',
      icon: '🏃',
    },
  ];

  // Non-modifiable factors (outer rings)
  const naoModificaveis: RingSegment[] = [
    {
      id: 'comorbidades',
      label: 'Doenças de Base',
      value: Math.min((b1.historicoMedico?.length ?? 0) * 2, 10),
      maxValue: 10,
      category: 'nao_modificavel',
      color: 'hsl(var(--severity-critico))',
      icon: '🏥',
    },
    {
      id: 'historico_familiar',
      label: 'Histórico Familiar',
      value: b1.historicoFamiliarPeso ?? 0,
      maxValue: 10,
      category: 'nao_modificavel',
      color: 'hsl(var(--severity-extremo))',
      icon: '🧬',
    },
    {
      id: 'trauma',
      label: 'Evento Precipitante',
      value: b1.eventoPrecipitante ? 7 : 0,
      maxValue: 10,
      category: 'nao_modificavel',
      color: 'hsl(var(--score-d))',
      icon: '⚠️',
    },
    {
      id: 'cronicidade',
      label: 'Cronicidade',
      value: getCronicidadeScore(b1.duracao),
      maxValue: 10,
      category: 'nao_modificavel',
      color: 'hsl(var(--severity-severo))',
      icon: '⏳',
    },
  ];

  return [...modificaveis, ...naoModificaveis];
}

function getCronicidadeScore(duracao: string): number {
  switch (duracao) {
    case '<2 semanas': return 1;
    case '2-4 semanas': return 3;
    case '1-3 meses': return 5;
    case '3-6 meses': return 6;
    case '6-12 meses': return 8;
    case '>1 ano': return 10;
    default: return 3;
  }
}

function extractPainPoints(avaliacao: AvaliacaoIdentidade): PainPoint[] {
  const regioes = avaliacao.bloco2?.regioes || [];
  // Map pain regions to positions within a small body outline (centered)
  const regionPositions: Record<string, { cx: number; cy: number }> = {
    cabeca: { cx: 0, cy: -38 },
    pescoco: { cx: 0, cy: -30 },
    ombroDireito: { cx: -14, cy: -22 },
    ombroEsquerdo: { cx: 14, cy: -22 },
    colunaToracica: { cx: 0, cy: -15 },
    abdomen: { cx: 0, cy: -5 },
    colunaLombar: { cx: 0, cy: 5 },
    sacroPelvica: { cx: 0, cy: 12 },
    bracoDireito: { cx: -22, cy: -10 },
    bracoEsquerdo: { cx: 22, cy: -10 },
    cotoveloAntebracoDireito: { cx: -26, cy: 2 },
    cotoveloAntebracoEsquerdo: { cx: 26, cy: 2 },
    maoDireita: { cx: -30, cy: 14 },
    maoEsquerda: { cx: 30, cy: 14 },
    coxaDireita: { cx: -8, cy: 22 },
    coxaEsquerda: { cx: 8, cy: 22 },
    joelhoDireito: { cx: -8, cy: 30 },
    joelhoEsquerdo: { cx: 8, cy: 30 },
    pernaDireita: { cx: -8, cy: 36 },
    pernaEsquerda: { cx: 8, cy: 36 },
    peDireito: { cx: -10, cy: 42 },
    peEsquerdo: { cx: 10, cy: 42 },
  };

  return regioes.map(r => {
    const pos = regionPositions[r.id] || { cx: 0, cy: 0 };
    return { ...pos, intensity: r.intensidade, nome: r.nome };
  });
}

// ── SVG Ring Chart Component ─────────────────────────────────────
function ConcentricRingsSVG({ segments, painPoints }: { segments: RingSegment[]; painPoints: PainPoint[] }) {
  const cx = 200;
  const cy = 200;
  const bodyRadius = 52;

  const modificaveis = segments.filter(s => s.category === 'modificavel');
  const naoModificaveis = segments.filter(s => s.category === 'nao_modificavel');

  // Inner rings = modifiable (closer to body), outer = non-modifiable
  const allRings = [...modificaveis, ...naoModificaveis];
  const ringWidth = 12;
  const ringGap = 3;
  const startRadius = bodyRadius + 14;

  return (
    <svg viewBox="0 0 400 400" className="w-full max-w-[420px] mx-auto">
      <defs>
        <radialGradient id="body-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.08" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </radialGradient>
        <filter id="ring-glow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background glow */}
      <circle cx={cx} cy={cy} r={startRadius + allRings.length * (ringWidth + ringGap) + 10} fill="url(#body-glow)" />

      {/* Divider label: non-modifiable zone */}
      {naoModificaveis.length > 0 && (
        <circle
          cx={cx} cy={cy}
          r={startRadius + modificaveis.length * (ringWidth + ringGap) + ringGap}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="0.5"
          strokeDasharray="4,4"
          opacity="0.5"
        />
      )}

      {/* Rings */}
      {allRings.map((segment, i) => {
        const radius = startRadius + i * (ringWidth + ringGap);
        const circumference = 2 * Math.PI * radius;
        const fillPercent = Math.max(segment.value / segment.maxValue, 0.02);
        const dashLength = circumference * fillPercent;
        const gapLength = circumference - dashLength;
        const opacity = segment.value > 0 ? 0.7 + (segment.value / segment.maxValue) * 0.3 : 0.15;

        return (
          <g key={segment.id}>
            {/* Background track */}
            <circle
              cx={cx} cy={cy} r={radius}
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth={ringWidth}
              opacity={0.3}
            />
            {/* Filled arc */}
            <circle
              cx={cx} cy={cy} r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={ringWidth - 2}
              strokeDasharray={`${dashLength} ${gapLength}`}
              strokeDashoffset={circumference * 0.25} // start from top
              strokeLinecap="round"
              opacity={opacity}
              className="transition-all duration-700"
              filter={segment.value >= 7 ? 'url(#ring-glow)' : undefined}
            />
            {/* Label */}
            <text
              x={cx + radius + 2}
              y={cy - 2}
              fontSize="7"
              fill="hsl(var(--muted-foreground))"
              opacity="0.7"
              textAnchor="start"
            >
              {segment.icon}
            </text>
          </g>
        );
      })}

      {/* Zone labels */}
      <text x={cx} y={cy - startRadius - modificaveis.length * (ringWidth + ringGap) - naoModificaveis.length * (ringWidth + ringGap) - 8}
        fontSize="8" fill="hsl(var(--muted-foreground))" textAnchor="middle" fontWeight="600" opacity="0.6">
        NÃO MODIFICÁVEIS
      </text>
      <text x={cx} y={cy - startRadius - 8}
        fontSize="8" fill="hsl(var(--muted-foreground))" textAnchor="middle" fontWeight="600" opacity="0.6">
        MODIFICÁVEIS
      </text>

      {/* Center: Simplified body silhouette */}
      <g transform={`translate(${cx}, ${cy})`}>
        {/* Mini body outline */}
        <path
          d={`
            M 0 -42
            C 8 -42 12 -38 12 -34
            C 12 -30 8 -27 5 -26
            L 6 -24
            C 16 -22 20 -18 22 -14
            L 28 0
            C 29 4 28 8 26 10
            L 18 4
            L 14 -8
            C 12 -12 10 -14 8 -16
            L 8 -10
            C 8 -2 8 6 9 14
            C 10 20 11 24 11 28
            L 11 36
            C 11 40 12 42 13 45
            C 10 46 8 46 6 44
            L 5 36
            L 4 28
            L 2 20
            L 0 14
            L -2 20
            L -4 28
            L -5 36
            L -6 44
            C -8 46 -10 46 -13 45
            C -12 42 -11 40 -11 36
            L -11 28
            C -11 24 -10 20 -9 14
            C -8 6 -8 -2 -8 -10
            L -8 -16
            C -10 -14 -12 -12 -14 -8
            L -18 4
            L -26 10
            C -28 8 -29 4 -28 0
            L -22 -14
            C -20 -18 -16 -22 -6 -24
            L -5 -26
            C -8 -27 -12 -30 -12 -34
            C -12 -38 -8 -42 0 -42 Z
          `}
          fill="hsl(var(--muted-foreground))"
          opacity="0.12"
          stroke="hsl(var(--muted-foreground))"
          strokeWidth="0.6"
          strokeOpacity="0.3"
        />

        {/* Pain points */}
        {painPoints.map((pt, i) => {
          const r = Math.max(2, Math.min(pt.intensity / 2, 5));
          const color = pt.intensity <= 3 ? '#fbbf24' : pt.intensity <= 6 ? '#f97316' : '#ef4444';
          return (
            <g key={i}>
              <circle cx={pt.cx} cy={pt.cy} r={r + 2} fill={color} opacity="0.2">
                <animate attributeName="r" values={`${r + 1};${r + 3};${r + 1}`} dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx={pt.cx} cy={pt.cy} r={r} fill={color} opacity="0.85" />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// ── Legend Component ─────────────────────────────────────────────
function RingLegend({ segments }: { segments: RingSegment[] }) {
  const modificaveis = segments.filter(s => s.category === 'modificavel');
  const naoModificaveis = segments.filter(s => s.category === 'nao_modificavel');

  const LegendItem = ({ seg }: { seg: RingSegment }) => (
    <div className="flex items-center gap-2 text-xs">
      <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: seg.color, opacity: seg.value > 0 ? 0.8 : 0.2 }} />
      <span className="text-muted-foreground truncate">{seg.icon} {seg.label}</span>
      <span className="ml-auto font-mono font-semibold tabular-nums" style={{ color: seg.color }}>
        {seg.value.toFixed(0)}
      </span>
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-4">
      <div>
        <p className="text-[10px] uppercase font-bold text-success tracking-wider mb-1">Modificáveis</p>
        {modificaveis.map(s => <LegendItem key={s.id} seg={s} />)}
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold text-destructive tracking-wider mb-1">Não Modificáveis</p>
        {naoModificaveis.map(s => <LegendItem key={s.id} seg={s} />)}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────
export default function PerfilTerrenosChart({ avaliacao, className }: Props) {
  const segments = useMemo(() => extractRingSegments(avaliacao), [avaliacao]);
  const painPoints = useMemo(() => extractPainPoints(avaliacao), [avaliacao]);

  const modificaveis = segments.filter(s => s.category === 'modificavel');
  const naoModificaveis = segments.filter(s => s.category === 'nao_modificavel');
  const avgModificavel = modificaveis.reduce((s, r) => s + r.value, 0) / (modificaveis.length || 1);
  const avgNaoModificavel = naoModificaveis.reduce((s, r) => s + r.value, 0) / (naoModificaveis.length || 1);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Perfil de Terrenos</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  <p>Anéis internos representam fatores <strong>modificáveis</strong> (hábitos de vida). Anéis externos representam fatores <strong>não-modificáveis</strong> (genética, traumas). O centro mostra as regiões de dor do paciente.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-[10px] border-success/30 text-success">
              Modificável: {avgModificavel.toFixed(1)}
            </Badge>
            <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">
              Fixo: {avgNaoModificavel.toFixed(1)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ConcentricRingsSVG segments={segments} painPoints={painPoints} />
        <RingLegend segments={segments} />
      </CardContent>
    </Card>
  );
}
