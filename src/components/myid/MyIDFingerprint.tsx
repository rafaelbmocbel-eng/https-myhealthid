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

export default function MyIDFingerprint({
  rings, myidScore, className = '', onRingClick, onRingHover,
  highlightedKey, hasRedFlags = false, compact = false,
}: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [revealProgress, setRevealProgress] = useState(0);

  // Sequential reveal animation
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

  const vw = 1000;
  const vh = 1000;
  const cx = vw / 2;
  const cy = 440;

  const ridgeData = useMemo(() => {
    const baseR = 72;
    const spacing = 24;

    return allRings.map((ring, i) => {
      const r = baseR + i * (spacing + 2);
      const rx = r * 1.02;
      const ry = r * 1.02;
      const valuePct = Math.max(ring.value / 10, 0.08);
      const color = ring.color || getThermalColor(ring.value);
      const opacity = 0.5 + (ring.value / 10) * 0.5;
      const openingAngle = Math.max(16 - i * 0.7, 3);
      const startAngle = 90 + openingAngle;
      const availableSweep = 360 - openingAngle * 2;
      // Minimum fill of 20% so low values remain visible
      const filledSweep = availableSweep * Math.max(valuePct, 0.20);

      return {
        ...ring, rx, ry, startAngle, availableSweep, filledSweep,
        gapPositions: i < 3 ? [] : [0.3, 0.7],
        gapSize: 3, isInner: ring.type === 'inner', index: i,
        strokeWidth: Math.max(15 - i * 0.35, 9),
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

  // Progress ring for center
  const progressCircumference = 2 * Math.PI * 44;
  const progressOffset = progressCircumference - (progressCircumference * Math.min(myidScore, 100)) / 100;

  return (
    <div className={`relative ${className}`} role="img" aria-label={`Impressão digital MyID com score ${Math.round(myidScore)} de 100 - ${label}`}>
      <svg viewBox={`0 0 ${vw} ${vh}`} className="w-full mx-auto"
        style={{ filter: 'drop-shadow(0 4px 24px rgba(0,0,0,0.06))' }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="fp-glow-hi" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="fp-glow-med" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="fp-core-glow">
            <feGaussianBlur stdDeviation="14" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="fp-highlight-glow">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <radialGradient id="fp-center-g" cx="50%" cy="50%">
            <stop offset="0%" stopColor={centerColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={centerColor} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="fp-bg-g" cx="50%" cy="44%" r="50%">
            <stop offset="0%" stopColor="hsl(220, 20%, 50%)" stopOpacity="0.03" />
            <stop offset="100%" stopColor="hsl(220, 20%, 50%)" stopOpacity="0" />
          </radialGradient>
          <filter id="fp-pulse-glow">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="fp-label-shadow">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.15" />
          </filter>
        </defs>

        <ellipse cx={cx} cy={cy} rx={440} ry={460} fill="url(#fp-bg-g)" />

        {/* Center: progress ring + score + status */}
        <circle cx={cx} cy={cy} r={52} fill="url(#fp-center-g)" filter="url(#fp-core-glow)" />
        
        {/* Background track */}
        <circle cx={cx} cy={cy} r={44} fill="none" stroke={centerColor} strokeWidth="3" opacity="0.1"
          transform={`rotate(-90, ${cx}, ${cy})`} />
        {/* Progress arc */}
        <circle cx={cx} cy={cy} r={44} fill="none" stroke={centerColor} strokeWidth="3.5"
          strokeDasharray={progressCircumference} strokeDashoffset={progressOffset}
          strokeLinecap="round" opacity="0.6"
          transform={`rotate(-90, ${cx}, ${cy})`}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)' }} />

        <text x={cx} y={cy - 10} textAnchor="middle" fontSize="34" fontWeight="900" fill={centerColor} dominantBaseline="central"
          style={{ transition: 'fill 0.3s ease' }}>
          {Math.round(myidScore)}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fontWeight="700" fill={centerColor} opacity="0.5">
          /100
        </text>
        <text x={cx} y={cy + 30} textAnchor="middle" fontSize="9.5" fontWeight="800" fill={centerColor} opacity="0.85"
          letterSpacing="1.2">
          {label.toUpperCase()}
        </text>

        {/* Ridges */}
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
          const isDimmed = activeIdx !== null && activeIdx !== ridgeIdx;
          const isRevealed = revealProgress > ridgeIdx;

          // Permanent label position: at the end of the filled arc
          const labelAngleDeg = ridge.startAngle + ridge.filledSweep + 8;
          const labelRad = (labelAngleDeg * Math.PI) / 180;
          const labelDist = ridge.rx + 2;
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
                  opacity={isDimmed ? 0.03 : 0.08} style={{ transition: 'opacity 0.3s ease' }} />;
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
                  strokeWidth={isActive ? ridge.strokeWidth + 5 : ridge.strokeWidth} strokeLinecap="round"
                  opacity={isActive ? 1 : isDimmed ? 0.08 : ridge.computedOpacity}
                  filter={isActive ? 'url(#fp-highlight-glow)' : ridge.value >= 7 ? 'url(#fp-glow-hi)' : ridge.value >= 4 ? 'url(#fp-glow-med)' : undefined}
                  style={{ transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }} />;
              })}

              {/* Permanent abbreviated label on each ridge */}
              {!compact && !isDimmed && (
                <text
                  x={lx} y={ly}
                  textAnchor="start"
                  fontSize="9"
                  fontWeight="800"
                  fill={ridge.computedColor}
                  opacity={isActive ? 1 : 0.55}
                  dominantBaseline="central"
                  letterSpacing="0.5"
                  style={{ transition: 'opacity 0.3s ease', pointerEvents: 'none' }}
                >
                  {SHORT_LABELS[ridge.scoreKey] || ridge.scoreKey}
                </text>
              )}

              {/* Active tooltip */}
              {isActive && (() => {
                const tipAngleDeg = ridge.startAngle + ridge.availableSweep * 0.5;
                const tipRad = (tipAngleDeg * Math.PI) / 180;
                const dist = ridge.rx + 48;
                const tx = cx + dist * Math.cos(tipRad);
                const ty = cy + dist * Math.sin(tipRad);
                const displayText = `${ridge.label}: ${ridge.value.toFixed(1)}`;
                const textWidth = displayText.length * 7 + 24;
                return (
                  <g style={{ pointerEvents: 'none' }}>
                    <rect x={tx - textWidth / 2} y={ty - 16} width={textWidth} height={32} rx={10}
                      fill={ridge.computedColor} opacity={0.92} stroke="white" strokeWidth="1.5" />
                    <text x={tx} y={ty + 1} textAnchor="middle" fontSize="12" fontWeight="800"
                      fill="white" letterSpacing="0.2" dominantBaseline="central">{displayText}</text>
                  </g>
                );
              })()}
            </g>
          );
        })}

        {/* Red flags pulse */}
        {hasRedFlags && (
          <g style={{ animation: 'fpPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>
            <circle cx={cx} cy={cy} r={410} fill="none" stroke="hsl(0, 72%, 51%)" strokeWidth="2" strokeDasharray="4 8" opacity="0.5" />
            <circle cx={cx} cy={cy} r={418} fill="none" stroke="hsl(0, 72%, 51%)" strokeWidth="6" opacity="0.12" filter="url(#fp-pulse-glow)" />
            <text x={cx} y={cy - 435} textAnchor="middle" fill="hsl(0, 72%, 51%)" fontSize="13" fontWeight="900" letterSpacing="2">
              SINAIS DE ALERTA DETECTADOS
            </text>
          </g>
        )}

        <style>{`@keyframes fpPulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.9; } }`}</style>

        {/* Legend bar */}
        <g transform={`translate(60, ${vh - 46})`}>
          <text x={0} y={9} fontSize="9" fontWeight="700" fill="hsl(var(--foreground))" letterSpacing="1.2" opacity="0.6">ESCALA:</text>
          {[
            { color: 'hsl(270, 60%, 75%)', x: 62 },
            { color: 'hsl(230, 70%, 60%)', x: 80 },
            { color: 'hsl(210, 75%, 55%)', x: 98 },
            { color: 'hsl(35, 85%, 55%)', x: 116 },
            { color: 'hsl(0, 85%, 50%)', x: 134 },
          ].map((c, i) => <rect key={i} x={c.x} y={0} width={16} height={12} rx={3} fill={c.color} opacity={0.8} />)}
          <text x={62} y={24} fontSize="7.5" fill="hsl(var(--muted-foreground))" fontWeight="600">Ótimo</text>
          <text x={140} y={24} fontSize="7.5" fill="hsl(var(--muted-foreground))" fontWeight="600">Crítico</text>

          <circle cx={185} cy={6} r={4.5} fill="hsl(0, 85%, 50%)" opacity={0.75} />
          <text x={194} y={9} fontSize="8.5" fontWeight="600" fill="hsl(var(--foreground))" opacity="0.7">Demanda</text>
          <circle cx={265} cy={6} r={4.5} fill="hsl(210, 75%, 55%)" opacity={0.75} />
          <text x={274} y={9} fontSize="8.5" fontWeight="600" fill="hsl(var(--foreground))" opacity="0.7">Capacidade</text>
        </g>
      </svg>

      {/* Synchronized sidebar legend */}
      {!compact && (
        <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-1.5 px-1">
          {ridgeData.map((ridge, idx) => {
            const isActive = activeIdx === idx;
            return (
              <button
                key={ridge.scoreKey}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-left transition-all duration-200 border ${
                  isActive
                    ? 'border-border bg-card shadow-sm scale-[1.02]'
                    : 'border-transparent hover:bg-muted/50'
                }`}
                onMouseEnter={() => { setHoveredIdx(idx); onRingHover?.(ridge.scoreKey); }}
                onMouseLeave={() => { setHoveredIdx(null); onRingHover?.(null); }}
                onClick={() => handleRidgeClick(ridge, idx)}
                aria-label={`${ridge.label}: ${ridge.value.toFixed(1)}`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform duration-200"
                  style={{
                    backgroundColor: ridge.computedColor,
                    transform: isActive ? 'scale(1.3)' : 'scale(1)',
                    boxShadow: isActive ? `0 0 6px ${ridge.computedColor}` : 'none',
                  }}
                />
                <div className="min-w-0">
                  <div className="text-[9px] font-bold text-foreground/80 truncate leading-tight">
                    {SHORT_LABELS[ridge.scoreKey]}
                  </div>
                  <div className="text-[8px] font-semibold tabular-nums" style={{ color: ridge.computedColor }}>
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
