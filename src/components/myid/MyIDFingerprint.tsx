import React, { useMemo, useState, useCallback, useEffect } from 'react';
import type { FingerprintRing } from '@/types/myid';
import { getThermalColor } from '@/utils/myidCalculations';
import { classificarMyID100 } from '@/utils/myid/lossTable';

interface Props {
  rings: FingerprintRing[];
  myidScore: number;
  className?: string;
  onRingClick?: (ring: FingerprintRing) => void;
  onRingHover?: (ringKey: string | null) => void;
  highlightedKey?: string | null;
  hasRedFlags?: boolean;
  compact?: boolean;
}

function scoreStatusLabel(score: number): string {
  return classificarMyID100(score).nome;
}
function scoreStatusColor(score: number): string {
  return classificarMyID100(score).cor;
}

const SHORT_LABELS: Record<string, string> = {
  D: 'D', EFI: 'EFI', P: 'P', I: 'I', R: 'R', C: 'C',
  AF: 'AF', HID: 'HID', NUT: 'NUT', ERG: 'ERG', N: 'N', MED: 'MED',
};

const FULL_LABELS: Record<string, string> = {
  D: 'Dor', EFI: 'Eficiência', P: 'Psicossocial', I: 'Incapacidade',
  R: 'Regulação', C: 'Cinesiofobia', AF: 'Ativ. Física', HID: 'Hidratação',
  NUT: 'Nutrição', ERG: 'Ergonomia', N: 'Neurológico', MED: 'Medicação',
};

export default function MyIDFingerprint({
  rings, myidScore, className = '', onRingClick, onRingHover,
  highlightedKey, hasRedFlags = false, compact = false,
}: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [revealProgress, setRevealProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!revealed) return;
    let frame = 0;
    const total = rings.length;
    const interval = setInterval(() => {
      frame++;
      setRevealProgress(frame);
      if (frame >= total) clearInterval(interval);
    }, 80);
    return () => clearInterval(interval);
  }, [revealed, rings.length]);

  const innerRings = rings.filter(r => r.type === 'inner');
  const outerRings = rings.filter(r => r.type === 'outer');
  const allRings = [...innerRings, ...outerRings];

  // HD viewBox for maximum sharpness and detail
  const vw = 1200;
  const vh = 1200;
  const cx = vw / 2;
  const cy = vh / 2;

  const ridgeData = useMemo(() => {
    const baseR = 90;
    const maxRadius = 560;
    const totalRings = allRings.length || 1;
    const spacing = Math.min(42, (maxRadius - baseR) / totalRings);

    return allRings.map((ring, i) => {
      const r = baseR + i * spacing;
      const rx = r;
      const ry = r;
      const valuePct = Math.max(ring.value / 10, 0.08);
      const color = ring.color || getThermalColor(ring.value);
      const opacity = 0.55 + (ring.value / 10) * 0.45;
      const openingAngle = Math.max(16 - i * 0.7, 3);
      const startAngle = 90 + openingAngle;
      const availableSweep = 360 - openingAngle * 2;
      const filledSweep = availableSweep * Math.max(valuePct, 0.20);

      return {
        ...ring, rx, ry, startAngle, availableSweep, filledSweep,
        gapPositions: i < 3 ? [] : [0.3, 0.7],
        gapSize: 4, isInner: ring.type === 'inner', index: i,
        strokeWidth: Math.max(34 - i * 1, 18),
        computedColor: color, computedOpacity: opacity,
      };
    });
  }, [allRings]);

  const arcPath = useCallback((rx: number, ry: number, startDeg: number, sweepDeg: number) => {
    if (sweepDeg < 0.5) return '';
    const toRad = (d: number) => (d * Math.PI) / 180;
    const s = toRad(startDeg);
    const e = toRad(startDeg + sweepDeg);
    const x1 = cx + rx * Math.cos(s);
    const y1 = cy + ry * Math.sin(s);
    const x2 = cx + rx * Math.cos(e);
    const y2 = cy + ry * Math.sin(e);
    const largeArc = sweepDeg > 180 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rx.toFixed(2)} ${ry.toFixed(2)} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }, [cx, cy]);

  const centerColor = scoreStatusColor(myidScore);
  const label = scoreStatusLabel(myidScore);

  const handleRidgeClick = (ridge: any, idx: number) => {
    setSelectedIdx(selectedIdx === idx ? null : idx);
    if (onRingClick) onRingClick(ridge);
  };

  const highlightedIdx = highlightedKey
    ? ridgeData.findIndex(r => r.scoreKey === highlightedKey) : null;

  const activeIdx = highlightedIdx !== null && highlightedIdx >= 0
    ? highlightedIdx : selectedIdx !== null ? selectedIdx : hoveredIdx;

  // progress values now computed inline in SVG with r=84

  return (
    <div className={`relative w-full ${className}`} role="img" aria-label={`Impressão digital MyID com score ${Math.round(myidScore)} de 100 - ${label}`}>
      <svg
        viewBox={`0 0 ${vw} ${vh}`}
        className="w-full mx-auto"
        style={{
          filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.08))',
        }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="fp-glow-hi" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="fp-glow-med" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="fp-core-glow">
            <feGaussianBlur stdDeviation="18" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="fp-highlight-glow">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <radialGradient id="fp-center-g" cx="50%" cy="50%">
            <stop offset="0%" stopColor={centerColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={centerColor} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="fp-bg-g" cx="50%" cy="44%" r="50%">
            <stop offset="0%" stopColor="hsl(220, 20%, 50%)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="hsl(220, 20%, 50%)" stopOpacity="0" />
          </radialGradient>
          <filter id="fp-pulse-glow">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="fp-label-shadow">
            <feDropShadow dx="0" dy="1" stdDeviation="3" floodOpacity="0.2" />
          </filter>
        </defs>

        <ellipse cx={cx} cy={cy} rx={580} ry={580} fill="url(#fp-bg-g)" />

        {/* ── Center: progress ring + score + status ── */}
        <circle cx={cx} cy={cy} r={100} fill="url(#fp-center-g)" filter="url(#fp-core-glow)" />

        {/* Background track */}
        <circle cx={cx} cy={cy} r={84} fill="none" stroke={centerColor} strokeWidth="5" opacity="0.1"
          transform={`rotate(-90, ${cx}, ${cy})`} />
        {/* Progress arc */}
        <circle cx={cx} cy={cy} r={84} fill="none" stroke={centerColor} strokeWidth="7"
          strokeDasharray={2 * Math.PI * 84} strokeDashoffset={(2 * Math.PI * 84) - (2 * Math.PI * 84 * Math.min(myidScore, 100)) / 100}
          strokeLinecap="round" opacity="0.65"
          transform={`rotate(-90, ${cx}, ${cy})`}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)' }} />

        <text x={cx} y={cy - 20} textAnchor="middle" fontSize="66" fontWeight="900" fill={centerColor} dominantBaseline="central"
          style={{ transition: 'fill 0.3s ease' }}>
          {Math.round(myidScore)}
        </text>
        <text x={cx} y={cy + 24} textAnchor="middle" fontSize="20" fontWeight="700" fill={centerColor} opacity="0.5">
          /100
        </text>
        <text x={cx} y={cy + 56} textAnchor="middle" fontSize="19" fontWeight="800" fill={centerColor} opacity="0.85"
          letterSpacing="2">
          {label.toUpperCase()}
        </text>

        {/* ── Ridges ── */}
        {ridgeData.map((ridge, ridgeIdx) => {
          const segments: { start: number; sweep: number }[] = [];
          const gaps = [...ridge.gapPositions].sort();
          if (gaps.length === 0) {
            segments.push({ start: ridge.startAngle, sweep: ridge.availableSweep });
          } else {
            let lastEnd = 0;
            gaps.forEach((gapPos) => {
              const segEnd = gapPos * ridge.availableSweep;
              const segSweep = segEnd - lastEnd;
              if (segSweep > 2) segments.push({ start: ridge.startAngle + lastEnd, sweep: segSweep - ridge.gapSize / 2 });
              lastEnd = segEnd + ridge.gapSize / 2;
            });
            const lastSweep = ridge.availableSweep - lastEnd;
            if (lastSweep > 2) segments.push({ start: ridge.startAngle + lastEnd, sweep: lastSweep });
          }

          const isActive = activeIdx === ridgeIdx;
          // Never fully dim — always keep other rings visible
          const isDimmed = false;
          const isRevealed = revealProgress > ridgeIdx;

          // Label position at the end of the filled arc
          const labelAngleDeg = ridge.startAngle + ridge.filledSweep + 8;
          const labelRad = (labelAngleDeg * Math.PI) / 180;
          const labelDist = ridge.rx + 4;
          const lx = cx + labelDist * Math.cos(labelRad);
          const ly = cy + labelDist * Math.sin(labelRad);

          return (
            <g key={ridge.scoreKey}
              role="button"
              aria-label={`${ridge.label}: ${ridge.value.toFixed(1)} de 10`}
              onMouseEnter={() => { setHoveredIdx(ridgeIdx); onRingHover?.(ridge.scoreKey); }}
              onMouseLeave={() => { setHoveredIdx(null); onRingHover?.(null); }}
              onClick={() => handleRidgeClick(ridge, ridgeIdx)}
              style={{
                cursor: 'pointer',
                opacity: isRevealed ? 1 : 0,
                transform: isRevealed ? 'none' : 'scale(0.97)',
                transition: `opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${ridgeIdx * 60}ms, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${ridgeIdx * 60}ms`,
              }}
            >
              {/* Background track */}
              {segments.map((seg, si) => {
                const path = arcPath(ridge.rx, ridge.ry, seg.start, seg.sweep);
                if (!path) return null;
                return <path key={`bg-${si}`} d={path} fill="none" stroke={ridge.computedColor}
                  strokeWidth={ridge.strokeWidth} strokeLinecap="round"
                  opacity={isDimmed ? 0.03 : 0.09} style={{ transition: 'opacity 0.3s ease' }} />;
              })}

              {/* Filled arc */}
              {segments.map((seg, si) => {
                const segStart = seg.start - ridge.startAngle;
                const fillEnd = ridge.filledSweep;
                if (segStart >= fillEnd) return null;
                const filledPortion = Math.min(seg.sweep, fillEnd - segStart);
                if (filledPortion < 1) return null;
                const path = arcPath(ridge.rx, ridge.ry, seg.start, filledPortion);
                if (!path) return null;
                return <path key={`fill-${si}`} d={path} fill="none" stroke={ridge.computedColor}
                  strokeWidth={isActive ? ridge.strokeWidth + 6 : ridge.strokeWidth} strokeLinecap="round"
                  opacity={isActive ? 1 : ridge.computedOpacity}
                  filter={isActive ? 'url(#fp-highlight-glow)' : ridge.value >= 7 ? 'url(#fp-glow-hi)' : ridge.value >= 4 ? 'url(#fp-glow-med)' : undefined}
                  style={{ transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }} />;
              })}

              {/* Permanent label */}
              {!compact && !isDimmed && (
                <text
                  x={lx} y={ly}
                  textAnchor="start"
                  fontSize="18"
                  fontWeight="800"
                  fill={ridge.computedColor}
                  opacity={isActive ? 1 : 0.7}
                  dominantBaseline="central"
                  letterSpacing="0.8"
                  filter="url(#fp-label-shadow)"
                  style={{ transition: 'opacity 0.3s ease', pointerEvents: 'none' }}
                >
                  {SHORT_LABELS[ridge.scoreKey] || ridge.scoreKey}
                </text>
              )}

              {/* Active tooltip */}
              {isActive && (() => {
                const tipAngleDeg = ridge.startAngle + ridge.availableSweep * 0.5;
                const tipRad = (tipAngleDeg * Math.PI) / 180;
                const dist = ridge.rx + 72;
                const tx = cx + dist * Math.cos(tipRad);
                const ty = cy + dist * Math.sin(tipRad);
                const fullLabel = FULL_LABELS[ridge.scoreKey] || ridge.label;
                const displayText = `${fullLabel}: ${ridge.value.toFixed(1)}`;
                const textWidth = displayText.length * 12 + 40;
                return (
                  <g style={{ pointerEvents: 'none' }}>
                    <rect x={tx - textWidth / 2} y={ty - 26} width={textWidth} height={52} rx={14}
                      fill={ridge.computedColor} opacity={0.94} stroke="white" strokeWidth="2.5" />
                    <text x={tx} y={ty + 1} textAnchor="middle" fontSize="21" fontWeight="800"
                      fill="white" letterSpacing="0.4" dominantBaseline="central">{displayText}</text>
                  </g>
                );
              })()}
            </g>
          );
        })}

        {/* Red flags pulse */}
        {hasRedFlags && (
          <g style={{ animation: 'fpPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>
            <circle cx={cx} cy={cy} r={500} fill="none" stroke="hsl(0, 72%, 51%)" strokeWidth="2.5" strokeDasharray="5 10" opacity="0.5" />
            <circle cx={cx} cy={cy} r={510} fill="none" stroke="hsl(0, 72%, 51%)" strokeWidth="8" opacity="0.12" filter="url(#fp-pulse-glow)" />
            <text x={cx} y={cy - 530} textAnchor="middle" fill="hsl(0, 72%, 51%)" fontSize="16" fontWeight="900" letterSpacing="2.5">
              SINAIS DE ALERTA DETECTADOS
            </text>
          </g>
        )}

        <style>{`@keyframes fpPulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.9; } }`}</style>

        {/* ── Legend bar ── */}
        <g transform={`translate(80, ${vh - 55})`}>
          <text x={0} y={14} fontSize="16" fontWeight="700" fill="hsl(var(--foreground))" letterSpacing="2" opacity="0.6">ESCALA:</text>
          {[
            { color: 'hsl(270, 60%, 75%)', x: 110 },
            { color: 'hsl(230, 70%, 60%)', x: 140 },
            { color: 'hsl(210, 75%, 55%)', x: 170 },
            { color: 'hsl(35, 85%, 55%)', x: 200 },
            { color: 'hsl(0, 85%, 50%)', x: 230 },
          ].map((c, i) => <rect key={i} x={c.x} y={0} width={26} height={18} rx={4} fill={c.color} opacity={0.8} />)}
          <text x={110} y={38} fontSize="13" fill="hsl(var(--muted-foreground))" fontWeight="600">Ótimo</text>
          <text x={235} y={38} fontSize="13" fill="hsl(var(--muted-foreground))" fontWeight="600">Crítico</text>

          <circle cx={310} cy={9} r={7} fill="hsl(0, 85%, 50%)" opacity={0.75} />
          <text x={322} y={14} fontSize="14" fontWeight="600" fill="hsl(var(--foreground))" opacity="0.7">Demanda</text>
          <circle cx={430} cy={9} r={7} fill="hsl(210, 75%, 55%)" opacity={0.75} />
          <text x={442} y={14} fontSize="14" fontWeight="600" fill="hsl(var(--foreground))" opacity="0.7">Capacidade</text>
        </g>
      </svg>

      {/* ── Sidebar legend grid ── */}
      {!compact && (
        <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-2 px-1">
          {ridgeData.map((ridge, idx) => {
            const isActive = activeIdx === idx;
            return (
              <button
                key={ridge.scoreKey}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all duration-200 border ${
                  isActive
                    ? 'border-border bg-card shadow-md scale-[1.03]'
                    : 'border-transparent hover:bg-muted/50'
                }`}
                onMouseEnter={() => { setHoveredIdx(idx); onRingHover?.(ridge.scoreKey); }}
                onMouseLeave={() => { setHoveredIdx(null); onRingHover?.(null); }}
                onClick={() => handleRidgeClick(ridge, idx)}
                aria-label={`${ridge.label}: ${ridge.value.toFixed(1)}`}
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0 transition-transform duration-200"
                  style={{
                    backgroundColor: ridge.computedColor,
                    transform: isActive ? 'scale(1.4)' : 'scale(1)',
                    boxShadow: isActive ? `0 0 8px ${ridge.computedColor}` : 'none',
                  }}
                />
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-foreground/80 truncate leading-tight">
                    {SHORT_LABELS[ridge.scoreKey]}
                  </div>
                  <div className="text-[9px] font-semibold tabular-nums" style={{ color: ridge.computedColor }}>
                    {ridge.value.toFixed(1)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
