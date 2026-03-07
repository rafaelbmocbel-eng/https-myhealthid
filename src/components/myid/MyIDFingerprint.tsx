import React, { useMemo, useState, useCallback } from 'react';
import type { FingerprintRing } from '@/types/myid';

interface Props {
  rings: FingerprintRing[];
  myidScore: number;
  className?: string;
  onRingClick?: (ring: FingerprintRing) => void;
  onRingHover?: (ringKey: string | null) => void;
  highlightedKey?: string | null;
}

import { getThermalColor } from '@/utils/myidCalculations';

function valueToOpacity(value: number): number {
  return 0.45 + (value / 10) * 0.55;
}

function scoreStatusLabel(score: number): string {
  if (score <= 2) return 'LEVE';
  if (score <= 4) return 'MODERADO';
  if (score <= 6) return 'SEVERO';
  if (score <= 8) return 'CRÍTICO';
  return 'EXTREMO';
}

export default function MyIDFingerprint({ rings, myidScore, className = '', onRingClick, onRingHover, highlightedKey }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const innerRings = rings.filter(r => r.type === 'inner');
  const outerRings = rings.filter(r => r.type === 'outer');
  const allRings = [...innerRings, ...outerRings];

  const vw = 1000;
  const vh = 1000;
  const cx = vw / 2;
  const cy = 460;

  const ridgeData = useMemo(() => {
    const baseR = 60;
    const spacing = 26;

    return allRings.map((ring, i) => {
      const r = baseR + i * (spacing + 2); // Increased spacing slightly
      // More circular shape for clarity
      const rx = r * 1.02;
      const ry = r * 1.02;
      const valuePct = Math.max(ring.value / 10, 0.08);

      // Use the color passed from the utility which follows the correct thermal logic
      const color = ring.color || getThermalColor(ring.value);
      const opacity = 0.5 + (ring.value / 10) * 0.5;

      // Opening at top of fingerprint
      const openingAngle = Math.max(16 - i * 0.7, 3);
      const startAngle = 90 + openingAngle;
      const availableSweep = 360 - openingAngle * 2;
      const filledSweep = availableSweep * Math.max(valuePct, 0.15);

      return {
        ...ring,
        rx, ry, startAngle, availableSweep, filledSweep,
        gapPositions: i < 3 ? [] : [0.3, 0.7], // Simplified gaps for better definition
        gapSize: 3,
        isInner: ring.type === 'inner',
        index: i,
        strokeWidth: Math.max(16 - i * 0.4, 10), // Thicker strokes for better definition
        computedColor: color,
        computedOpacity: opacity,
      };
    });
  }, [allRings]);

  // Clean arc path using elliptical arcs
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

  const centerColor = getThermalColor(myidScore);
  const label = scoreStatusLabel(myidScore);

  const handleRidgeClick = (ridge: any, idx: number) => {
    setSelectedIdx(selectedIdx === idx ? null : idx);
    if (onRingClick) onRingClick(ridge);
  };

  const highlightedIdx = highlightedKey
    ? ridgeData.findIndex(r => r.scoreKey === highlightedKey)
    : null;

  const activeIdx = highlightedIdx !== null && highlightedIdx >= 0
    ? highlightedIdx
    : selectedIdx !== null
      ? selectedIdx
      : hoveredIdx;

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox={`0 0 ${vw} ${vh}`}
        className="w-full mx-auto"
        style={{ filter: 'drop-shadow(0 4px 24px rgba(0,0,0,0.08))' }}
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
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="fp-highlight-glow">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <radialGradient id="fp-center-g" cx="50%" cy="50%">
            <stop offset="0%" stopColor={centerColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={centerColor} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="fp-bg-g" cx="50%" cy="46%" r="50%">
            <stop offset="0%" stopColor="hsl(270, 40%, 60%)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="hsl(270, 40%, 60%)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background */}
        <ellipse cx={cx} cy={cy} rx={440} ry={460} fill="url(#fp-bg-g)" />
        <circle cx={cx} cy={cy} r={70} fill="url(#fp-center-g)" filter="url(#fp-core-glow)" />

        {/* RIDGES */}
        {ridgeData.map((ridge, ridgeIdx) => {
          // Build segments with gaps
          const segments: { start: number; sweep: number }[] = [];
          const gaps = [...ridge.gapPositions].sort();

          if (gaps.length === 0) {
            segments.push({ start: ridge.startAngle, sweep: ridge.availableSweep });
          } else {
            let lastEnd = 0;
            gaps.forEach((gapPos) => {
              const segEnd = gapPos * ridge.availableSweep;
              const segSweep = segEnd - lastEnd;
              if (segSweep > 2) {
                segments.push({ start: ridge.startAngle + lastEnd, sweep: segSweep - ridge.gapSize / 2 });
              }
              lastEnd = segEnd + ridge.gapSize / 2;
            });
            const lastSweep = ridge.availableSweep - lastEnd;
            if (lastSweep > 2) {
              segments.push({ start: ridge.startAngle + lastEnd, sweep: lastSweep });
            }
          }

          const isActive = activeIdx === ridgeIdx;
          const isDimmed = activeIdx !== null && activeIdx !== ridgeIdx;

          return (
            <g key={ridge.scoreKey}
              onMouseEnter={() => {
                setHoveredIdx(ridgeIdx);
                if (onRingHover) onRingHover(ridge.scoreKey);
              }}
              onMouseLeave={() => {
                setHoveredIdx(null);
                if (onRingHover) onRingHover(null);
              }}
              onClick={() => handleRidgeClick(ridge, ridgeIdx)}
              style={{ cursor: 'pointer' }}
            >
              {/* Background track — full arc */}
              {segments.map((seg, si) => {
                const path = arcPath(ridge.rx, ridge.ry, seg.start, seg.sweep);
                if (!path) return null;
                return (
                  <path key={`bg-${si}`} d={path} fill="none"
                    stroke={ridge.computedColor}
                    strokeWidth={ridge.strokeWidth}
                    strokeLinecap="round"
                    opacity={isDimmed ? 0.03 : 0.1}
                    style={{ transition: 'opacity 0.3s ease' }}
                  />
                );
              })}

              {/* Filled portion */}
              {segments.map((seg, si) => {
                const segStart = seg.start - ridge.startAngle;
                const fillEnd = ridge.filledSweep;
                if (segStart >= fillEnd) return null;
                const filledPortion = Math.min(seg.sweep, fillEnd - segStart);
                if (filledPortion < 1) return null;
                const path = arcPath(ridge.rx, ridge.ry, seg.start, filledPortion);
                if (!path) return null;
                return (
                  <path key={`fill-${si}`} d={path} fill="none"
                    stroke={ridge.computedColor}
                    strokeWidth={isActive ? ridge.strokeWidth + 6 : ridge.strokeWidth}
                    strokeLinecap="round"
                    opacity={isActive ? 1 : isDimmed ? 0.08 : ridge.computedOpacity}
                    filter={isActive ? 'url(#fp-highlight-glow)' : ridge.value >= 7 ? 'url(#fp-glow-hi)' : ridge.value >= 4 ? 'url(#fp-glow-med)' : undefined}
                    style={{ transition: 'all 0.3s ease' }}
                  />
                );
              })}

              {/* Tooltip label on hover */}
              {isActive && (() => {
                const labelAngleDeg = ridge.startAngle + ridge.availableSweep * 0.5;
                const labelRad = (labelAngleDeg * Math.PI) / 180;
                const dist = ridge.rx + 45;
                const lx = cx + dist * Math.cos(labelRad);
                const ly = cy + dist * Math.sin(labelRad);

                // Show full label + value
                const displayText = `${ridge.label}: ${ridge.value.toFixed(1)}`;
                const textWidth = displayText.length * 7.5 + 20;

                return (
                  <g style={{ transition: 'opacity 0.3s ease', pointerEvents: 'none' }}>
                    <rect x={lx - textWidth / 2} y={ly - 18} width={textWidth} height={36} rx={12}
                      fill={ridge.computedColor} opacity={0.95} stroke="white" strokeWidth="2" />
                    <text x={lx} y={ly + 2} textAnchor="middle" fontSize="13" fontWeight="900"
                      fill="white" letterSpacing="0.2" dominantBaseline="central">
                      {displayText}
                    </text>
                  </g>
                );
              })()}
            </g>
          );
        })}

        {/* CENTER SCORE */}
        <text x={cx} y={cy - 18} textAnchor="middle" fontSize="56" fontWeight="900"
          fill={centerColor} filter="url(#fp-core-glow)" letterSpacing="-2">
          {myidScore.toFixed(1)}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" className="fill-muted-foreground"
          fontSize="12" fontWeight="700" letterSpacing="4">MyID SCORE</text>
        <rect x={cx - 40} y={cy + 18} width={80} height={24} rx={12}
          fill={centerColor} opacity={0.15} />
        <text x={cx} y={cy + 34} textAnchor="middle" fill={centerColor}
          fontSize="11" fontWeight="800" letterSpacing="2" dominantBaseline="central">{label}</text>

        {/* LEGEND */}
        <g transform={`translate(60, ${vh - 50})`}>
          <text x={0} y={9} fontSize="10" fontWeight="700" className="fill-foreground" letterSpacing="1.5">ESCALA DE CORES:</text>
          {[
            { color: 'hsl(270, 60%, 75%)', x: 130 },
            { color: 'hsl(230, 70%, 60%)', x: 150 },
            { color: 'hsl(210, 75%, 55%)', x: 170 },
            { color: 'hsl(35, 85%, 55%)', x: 190 },
            { color: 'hsl(0, 85%, 50%)', x: 210 },
          ].map((c, i) => (
            <rect key={i} x={c.x} y={0} width={18} height={14} rx={4} fill={c.color} opacity={0.85} />
          ))}
          <text x={130} y={26} fontSize="8" className="fill-muted-foreground">Ótimo</text>
          <text x={218} y={26} fontSize="8" className="fill-muted-foreground">Crítico</text>

          <circle cx={280} cy={7} r={5} fill="hsl(0, 85%, 50%)" opacity={0.8} />
          <text x={290} y={10} fontSize="9" fontWeight="600" className="fill-foreground">Demanda</text>
          <text x={290} y={22} fontSize="8" className="fill-muted-foreground">Cristas internas</text>

          <circle cx={380} cy={7} r={5} fill="hsl(210, 75%, 55%)" opacity={0.8} />
          <text x={390} y={10} fontSize="9" fontWeight="600" className="fill-foreground">Capacidade</text>
          <text x={390} y={22} fontSize="8" className="fill-muted-foreground">Cristas externas</text>
        </g>
      </svg>
    </div>
  );
}
