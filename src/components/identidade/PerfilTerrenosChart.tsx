import { useMemo, useState } from 'react';
import { AvaliacaoIdentidade } from '@/types/identidade';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ── Ring data definitions ────────────────────────────────────────
interface RingSegment {
  id: string;
  label: string;
  value: number;
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

  const modificaveis: RingSegment[] = [
    { id: 'sono', label: 'Sono', value: b5.qualidadeSono ?? 5, maxValue: 10, category: 'modificavel', color: '#6366f1', icon: '🌙' },
    { id: 'hidratacao', label: 'Hidratação', value: Math.min((b1.litrosAgua ?? 2) * 2.5, 10), maxValue: 10, category: 'modificavel', color: '#38bdf8', icon: '💧' },
    { id: 'sedentarismo', label: 'Sedentarismo', value: Math.min((b1.horasSedentario ?? 8) / 1.6, 10), maxValue: 10, category: 'modificavel', color: '#22c55e', icon: '🪑' },
    { id: 'estresse', label: 'Estresse', value: b5.nivelStress ?? 5, maxValue: 10, category: 'modificavel', color: '#ec4899', icon: '🧠' },
    { id: 'fadiga', label: 'Fadiga', value: b5.fadigaDia ?? 5, maxValue: 10, category: 'modificavel', color: '#f97316', icon: '⚡' },
    { id: 'tabagismo', label: 'Tabagismo', value: b1.tabagismo ? 8 : 0, maxValue: 10, category: 'modificavel', color: '#ef4444', icon: '🚬' },
    { id: 'trabalho', label: 'Trabalho', value: b5.cargaLaboral ?? b1.interferenciaTrbalho ?? 5, maxValue: 10, category: 'modificavel', color: '#eab308', icon: '💼' },
    { id: 'lazer', label: 'Atividade Física', value: b1.atividadeFisica === 'nenhuma' ? 0 : b1.atividadeFisica === 'leve' ? 3 : b1.atividadeFisica === 'moderada' ? 6 : 9, maxValue: 10, category: 'modificavel', color: '#14b8a6', icon: '🏃' },
  ];

  const naoModificaveis: RingSegment[] = [
    { id: 'comorbidades', label: 'Doenças de Base', value: Math.min((b1.historicoMedico?.length ?? 0) * 2, 10), maxValue: 10, category: 'nao_modificavel', color: '#dc2626', icon: '🏥' },
    { id: 'historico_familiar', label: 'Hist. Familiar', value: b1.historicoFamiliarPeso ?? 0, maxValue: 10, category: 'nao_modificavel', color: '#a855f7', icon: '🧬' },
    { id: 'trauma', label: 'Trauma/Evento', value: b1.eventoPrecipitante ? 7 : 0, maxValue: 10, category: 'nao_modificavel', color: '#8b5cf6', icon: '⚠️' },
    { id: 'cronicidade', label: 'Cronicidade', value: getCronicidadeScore(b1.duracao), maxValue: 10, category: 'nao_modificavel', color: '#e11d48', icon: '⏳' },
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
  const regionPositions: Record<string, { cx: number; cy: number }> = {
    cabeca: { cx: 0, cy: -55 },
    pescoco: { cx: 0, cy: -44 },
    ombroDireito: { cx: -20, cy: -32 },
    ombroEsquerdo: { cx: 20, cy: -32 },
    colunaToracica: { cx: 0, cy: -22 },
    abdomen: { cx: 0, cy: -8 },
    colunaLombar: { cx: 0, cy: 6 },
    sacroPelvica: { cx: 0, cy: 16 },
    bracoDireito: { cx: -30, cy: -14 },
    bracoEsquerdo: { cx: 30, cy: -14 },
    cotoveloAntebracoDireito: { cx: -36, cy: 2 },
    cotoveloAntebracoEsquerdo: { cx: 36, cy: 2 },
    maoDireita: { cx: -40, cy: 18 },
    maoEsquerda: { cx: 40, cy: 18 },
    coxaDireita: { cx: -10, cy: 30 },
    coxaEsquerda: { cx: 10, cy: 30 },
    joelhoDireito: { cx: -10, cy: 42 },
    joelhoEsquerdo: { cx: 10, cy: 42 },
    pernaDireita: { cx: -10, cy: 52 },
    pernaEsquerda: { cx: 10, cy: 52 },
    peDireito: { cx: -12, cy: 60 },
    peEsquerdo: { cx: 12, cy: 60 },
  };

  return regioes.map(r => {
    const pos = regionPositions[r.id] || { cx: 0, cy: 0 };
    return { ...pos, intensity: r.intensidade, nome: r.nome };
  });
}

// ── SVG Ring Chart ───────────────────────────────────────────────
function ConcentricRingsSVG({ segments, painPoints, hoveredRing, onHoverRing }: {
  segments: RingSegment[];
  painPoints: PainPoint[];
  hoveredRing: string | null;
  onHoverRing: (id: string | null) => void;
}) {
  const cx = 250;
  const cy = 250;

  const modificaveis = segments.filter(s => s.category === 'modificavel');
  const naoModificaveis = segments.filter(s => s.category === 'nao_modificavel');
  const allRings = [...modificaveis, ...naoModificaveis];

  const ringWidth = 14;
  const ringGap = 4;
  const bodyRadius = 68;
  const startRadius = bodyRadius + 18;

  const dividerRadius = startRadius + modificaveis.length * (ringWidth + ringGap) + ringGap / 2;

  return (
    <svg viewBox="0 0 500 500" className="w-full max-w-[500px] mx-auto" style={{ aspectRatio: '1/1' }}>
      <defs>
        <radialGradient id="terreno-bg-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.06" />
          <stop offset="60%" stopColor="hsl(var(--primary))" stopOpacity="0.02" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </radialGradient>
        <filter id="terreno-ring-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="terreno-pain-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background */}
      <circle cx={cx} cy={cy} r={240} fill="url(#terreno-bg-glow)" />

      {/* Divider circle between zones */}
      <circle cx={cx} cy={cy} r={dividerRadius} fill="none"
        stroke="hsl(var(--foreground))" strokeWidth="1" strokeDasharray="6,4" opacity="0.15" />

      {/* Zone labels on the divider */}
      <text x={cx} y={cy - dividerRadius - 6} fontSize="9" fill="hsl(var(--muted-foreground))"
        textAnchor="middle" fontWeight="700" letterSpacing="1.5" opacity="0.5">
        REGULATÓRIOS / NÃO MODIFICÁVEIS
      </text>
      <text x={cx} y={cy - startRadius + 6} fontSize="9" fill="hsl(var(--muted-foreground))"
        textAnchor="middle" fontWeight="700" letterSpacing="1.5" opacity="0.5">
        MODIFICÁVEIS
      </text>

      {/* Rings */}
      {allRings.map((segment, i) => {
        const radius = startRadius + i * (ringWidth + ringGap);
        const circumference = 2 * Math.PI * radius;
        const fillPercent = Math.max(segment.value / segment.maxValue, 0.03);
        const dashLength = circumference * fillPercent;
        const gapLength = circumference - dashLength;
        const isHovered = hoveredRing === segment.id;
        const baseOpacity = segment.value > 0 ? 0.75 : 0.15;
        const opacity = isHovered ? 1 : baseOpacity;
        const width = isHovered ? ringWidth + 2 : ringWidth - 1;

        // Angle for label placement (at the end of the arc)
        const angleRad = -Math.PI / 2 + (2 * Math.PI * fillPercent);
        const labelX = cx + (radius + ringWidth / 2 + 10) * Math.cos(angleRad);
        const labelY = cy + (radius + ringWidth / 2 + 10) * Math.sin(angleRad);

        return (
          <g key={segment.id}
            onMouseEnter={() => onHoverRing(segment.id)}
            onMouseLeave={() => onHoverRing(null)}
            className="cursor-pointer"
          >
            {/* Background track */}
            <circle cx={cx} cy={cy} r={radius} fill="none"
              stroke="hsl(var(--muted))" strokeWidth={ringWidth} opacity={0.25} />

            {/* Filled arc */}
            <circle cx={cx} cy={cy} r={radius} fill="none"
              stroke={segment.color} strokeWidth={width}
              strokeDasharray={`${dashLength} ${gapLength}`}
              strokeDashoffset={circumference * 0.25}
              strokeLinecap="round"
              opacity={opacity}
              className="transition-all duration-300"
              filter={segment.value >= 7 || isHovered ? 'url(#terreno-ring-glow)' : undefined}
            />

            {/* Icon at right side */}
            <text x={cx + radius + ringWidth / 2 + 6} y={cy + 4}
              fontSize="11" textAnchor="start" opacity={isHovered ? 1 : 0.7}>
              {segment.icon}
            </text>

            {/* Value label on hover */}
            {isHovered && (
              <g>
                <rect x={cx + radius + ringWidth / 2 + 20} y={cy - 10}
                  width={Math.max(segment.label.length * 6 + 30, 80)} height={22}
                  rx="4" fill="hsl(var(--popover))" stroke="hsl(var(--border))" strokeWidth="0.5"
                  opacity="0.95" />
                <text x={cx + radius + ringWidth / 2 + 25} y={cy + 4}
                  fontSize="10" fill="hsl(var(--foreground))" fontWeight="600">
                  {segment.label}: {segment.value.toFixed(0)}/10
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Center: Body silhouette — LARGER and clearer */}
      <g transform={`translate(${cx}, ${cy})`}>
        {/* Subtle body background circle */}
        <circle cx={0} cy={0} r={bodyRadius} fill="hsl(var(--muted))" opacity="0.08" />

        {/* Body outline — scaled up */}
        <path
          d={`
            M 0 -60
            C 11 -60 16 -54 16 -48
            C 16 -42 11 -38 7 -36
            L 8 -33
            C 22 -30 28 -25 30 -19
            L 38 0
            C 40 5 38 10 36 14
            L 25 6
            L 19 -10
            C 17 -16 14 -19 11 -22
            L 11 -14
            C 11 -3 11 8 12 20
            C 13 28 15 34 15 40
            L 15 50
            C 15 56 16 60 18 64
            C 14 66 11 66 8 63
            L 7 52
            L 5 40
            L 3 28
            L 0 20
            L -3 28
            L -5 40
            L -7 52
            L -8 63
            C -11 66 -14 66 -18 64
            C -16 60 -15 56 -15 50
            L -15 40
            C -15 34 -13 28 -12 20
            C -11 8 -11 -3 -11 -14
            L -11 -22
            C -14 -19 -17 -16 -19 -10
            L -25 6
            L -36 14
            C -38 10 -40 5 -38 0
            L -30 -19
            C -28 -25 -22 -30 -8 -33
            L -7 -36
            C -11 -38 -16 -42 -16 -48
            C -16 -54 -11 -60 0 -60 Z
          `}
          fill="hsl(var(--foreground))"
          opacity="0.08"
          stroke="hsl(var(--foreground))"
          strokeWidth="1"
          strokeOpacity="0.2"
        />

        {/* Spine line */}
        <line x1={0} y1={-36} x2={0} y2={20} stroke="hsl(var(--foreground))" strokeWidth="0.5" strokeDasharray="2,3" opacity="0.1" />

        {/* Pain points — larger and more visible */}
        {painPoints.map((pt, i) => {
          const r = Math.max(3, Math.min(pt.intensity * 0.7, 7));
          const color = pt.intensity <= 3 ? '#fbbf24' : pt.intensity <= 6 ? '#f97316' : '#ef4444';
          return (
            <g key={i}>
              {/* Outer glow */}
              <circle cx={pt.cx} cy={pt.cy} r={r + 4} fill={color} opacity="0.15" filter="url(#terreno-pain-glow)">
                <animate attributeName="r" values={`${r + 2};${r + 5};${r + 2}`} dur="2.5s" repeatCount="indefinite" />
              </circle>
              {/* Main dot */}
              <circle cx={pt.cx} cy={pt.cy} r={r} fill={color} opacity="0.9"
                stroke="white" strokeWidth="0.5" strokeOpacity="0.4" />
            </g>
          );
        })}

        {/* Center label if no pain points */}
        {painPoints.length === 0 && (
          <text x={0} y={4} fontSize="9" fill="hsl(var(--muted-foreground))" textAnchor="middle" opacity="0.4">
            Sem dor mapeada
          </text>
        )}
      </g>
    </svg>
  );
}

// ── Legend ────────────────────────────────────────────────────────
function RingLegend({ segments, hoveredRing, onHoverRing }: {
  segments: RingSegment[];
  hoveredRing: string | null;
  onHoverRing: (id: string | null) => void;
}) {
  const modificaveis = segments.filter(s => s.category === 'modificavel');
  const naoModificaveis = segments.filter(s => s.category === 'nao_modificavel');

  const LegendItem = ({ seg }: { seg: RingSegment }) => {
    const isHovered = hoveredRing === seg.id;
    const pct = (seg.value / seg.maxValue) * 100;
    return (
      <div
        className={`flex items-center gap-2.5 py-1.5 px-2 rounded-lg transition-all duration-200 cursor-pointer ${isHovered ? 'bg-muted/60 scale-[1.02]' : 'hover:bg-muted/30'}`}
        onMouseEnter={() => onHoverRing(seg.id)}
        onMouseLeave={() => onHoverRing(null)}
      >
        <span className="text-sm shrink-0">{seg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-xs font-medium text-foreground truncate">{seg.label}</span>
            <span className="text-xs font-bold tabular-nums ml-2" style={{ color: seg.color }}>
              {seg.value.toFixed(0)}
            </span>
          </div>
          {/* Mini progress bar */}
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: seg.color, opacity: seg.value > 0 ? 0.85 : 0.2 }} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 mt-3 pt-3 border-t border-border/50">
      <div>
        <div className="flex items-center gap-1.5 mb-1 px-2">
          <div className="h-2 w-2 rounded-full bg-success" />
          <p className="text-[10px] uppercase font-bold text-success tracking-wider">Modificáveis</p>
        </div>
        {modificaveis.map(s => <LegendItem key={s.id} seg={s} />)}
      </div>
      <div>
        <div className="flex items-center gap-1.5 mb-1 px-2">
          <div className="h-2 w-2 rounded-full bg-destructive" />
          <p className="text-[10px] uppercase font-bold text-destructive tracking-wider">Regulatórios / Não Modificáveis</p>
        </div>
        {naoModificaveis.map(s => <LegendItem key={s.id} seg={s} />)}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────
export default function PerfilTerrenosChart({ avaliacao, className }: Props) {
  const [hoveredRing, setHoveredRing] = useState<string | null>(null);
  const segments = useMemo(() => extractRingSegments(avaliacao), [avaliacao]);
  const painPoints = useMemo(() => extractPainPoints(avaliacao), [avaliacao]);

  const modificaveis = segments.filter(s => s.category === 'modificavel');
  const naoModificaveis = segments.filter(s => s.category === 'nao_modificavel');
  const avgModificavel = modificaveis.reduce((s, r) => s + r.value, 0) / (modificaveis.length || 1);
  const avgNaoModificavel = naoModificaveis.reduce((s, r) => s + r.value, 0) / (naoModificaveis.length || 1);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Perfil de Terrenos</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  <p><strong>Anéis internos</strong> = fatores modificáveis (hábitos de vida). <strong>Anéis externos</strong> = fatores regulatórios/não-modificáveis. <strong>Centro</strong> = mapa de dor do paciente. Passe o mouse para detalhes.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-[10px] gap-1 border-success/40 text-success font-semibold">
              <div className="h-1.5 w-1.5 rounded-full bg-success" />
              Modificável: {avgModificavel.toFixed(1)}
            </Badge>
            <Badge variant="outline" className="text-[10px] gap-1 border-destructive/40 text-destructive font-semibold">
              <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
              Regulatório: {avgNaoModificavel.toFixed(1)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ConcentricRingsSVG
          segments={segments}
          painPoints={painPoints}
          hoveredRing={hoveredRing}
          onHoverRing={setHoveredRing}
        />
        <RingLegend
          segments={segments}
          hoveredRing={hoveredRing}
          onHoverRing={setHoveredRing}
        />
      </CardContent>
    </Card>
  );
}
