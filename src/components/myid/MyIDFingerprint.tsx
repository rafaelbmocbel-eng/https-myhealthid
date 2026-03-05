import React, { useMemo, useState, useCallback } from 'react';
import type { FingerprintRing } from '@/types/myid';

interface Props {
  rings: FingerprintRing[];
  myidScore: number;
  className?: string;
  onRingClick?: (ring: FingerprintRing) => void;
  highlightedKey?: string | null;
}

function valueToColor(value: number): string {
  const v = Math.max(0, Math.min(10, value));
  if (v <= 1) return 'hsl(270, 60%, 75%)';
  if (v <= 2.5) return 'hsl(260, 65%, 65%)';
  if (v <= 4) return 'hsl(230, 70%, 60%)';
  if (v <= 5.5) return 'hsl(210, 75%, 55%)';
  if (v <= 7) return 'hsl(35, 85%, 55%)';
  if (v <= 8.5) return 'hsl(15, 90%, 50%)';
  return 'hsl(0, 85%, 50%)';
}

function valueToOpacity(value: number): number {
  return 0.4 + (value / 10) * 0.6;
}

function scoreStatusLabel(score: number): string {
  if (score <= 2) return 'LEVE';
  if (score <= 4) return 'MODERADO';
  if (score <= 6) return 'SEVERO';
  if (score <= 8) return 'CRÍTICO';
  return 'EXTREMO';
}

export default function MyIDFingerprint({ rings, myidScore, className = '', onRingClick, highlightedKey }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const innerRings = rings.filter(r => r.type === 'inner');
  const outerRings = rings.filter(r => r.type === 'outer');
  const allRings = [...innerRings, ...outerRings];

  // Higher resolution viewBox
  const vw = 1200;
  const vh = 1200;
  const cx = vw / 2;
  const cy = 540;

  const ridgeData = useMemo(() => {
    const baseRx = 55;
    const baseRy = 70;
    const spacing = 28;

    return allRings.map((ring, i) => {
      const rx = baseRx + i * spacing;
      const ry = baseRy + i * spacing * 1.12;
      const valuePct = Math.max(ring.value / 10, 0.08);
      const color = valueToColor(ring.value);
      const opacity = valueToOpacity(ring.value);

      const openingAngle = Math.max(20 - i * 0.9, 5);
      const startAngle = 90 + openingAngle;
      const availableSweep = 360 - openingAngle * 2;
      const filledSweep = availableSweep * Math.max(valuePct, 0.25);

      // Natural gap pattern
      const numGaps = i % 3 === 0 ? 1 : 2;
      const gapPositions: number[] = [];
      for (let g = 0; g < numGaps; g++) {
        const basePos = (g + 1) / (numGaps + 1);
        const jitter = ((i * 13 + g * 19) % 14 - 7) / 100;
        gapPositions.push(Math.max(0.15, Math.min(0.85, basePos + jitter)));
      }
      const gapSize = 5 + i * 0.4;

      return {
        ...ring,
        rx, ry, startAngle, availableSweep, filledSweep,
        gapPositions, gapSize,
        isInner: ring.type === 'inner',
        index: i,
        strokeWidth: Math.max(18 - i * 0.7, 9),
        computedColor: color,
        computedOpacity: opacity,
      };
    });
  }, [allRings]);

  const arcPath = useCallback((rx: number, ry: number, startDeg: number, sweepDeg: number) => {
    if (sweepDeg < 0.5) return '';
    const s = (startDeg * Math.PI) / 180;
    const e = ((startDeg + sweepDeg) * Math.PI) / 180;
    const x1 = cx + rx * Math.cos(s);
    const y1 = cy + ry * Math.sin(s);
    const x2 = cx + rx * Math.cos(e);
    const y2 = cy + ry * Math.sin(e);
    return `M ${x1} ${y1} A ${rx} ${ry} 0 ${sweepDeg > 180 ? 1 : 0} 1 ${x2} ${y2}`;
  }, [cx, cy]);

  const centerColor = valueToColor(myidScore);
  const label = scoreStatusLabel(myidScore);

  const handleRidgeClick = (ridge: typeof ridgeData[0], idx: number) => {
    setSelectedIdx(selectedIdx === idx ? null : idx);
    if (onRingClick) onRingClick(ridge);
  };

  // Determine which ridge is active (external highlight takes priority)
  const highlightedIdx = highlightedKey
    ? ridgeData.findIndex(r => r.scoreKey === highlightedKey)
    : null;

  const activeIdx = highlightedIdx !== null && highlightedIdx >= 0
    ? highlightedIdx
    : selectedIdx !== null
      ? selectedIdx
      : hoveredIdx;

  const activeRidge = activeIdx !== null ? ridgeData[activeIdx] : null;

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox={`0 0 ${vw} ${vh}`}
        className="w-full mx-auto"
        style={{ filter: 'drop-shadow(0 6px 30px rgba(0,0,0,0.06))' }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="fp-glow-hi">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="fp-glow-med">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="fp-core-glow">
            <feGaussianBlur stdDeviation="20" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="fp-highlight-glow">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="ridge-tex">
            <feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="4" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <radialGradient id="fp-center-g" cx="50%" cy="50%">
            <stop offset="0%" stopColor={centerColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={centerColor} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="fp-bg-g" cx="50%" cy="45%" r="50%">
            <stop offset="0%" stopColor="hsl(270, 40%, 60%)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="hsl(270, 40%, 60%)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background */}
        <ellipse cx={cx} cy={cy} rx={500} ry={520} fill="url(#fp-bg-g)" />
        <ellipse cx={cx} cy={cy} rx={80} ry={95} fill="url(#fp-center-g)" filter="url(#fp-core-glow)" />

        {/* RIDGES */}
        {ridgeData.map((ridge, ridgeIdx) => {
          const segments: { start: number; sweep: number }[] = [];
          const gaps = [...ridge.gapPositions].sort();
          let lastEnd = 0;

          gaps.forEach((gapPos) => {
            const segEnd = gapPos * ridge.availableSweep;
            const segSweep = segEnd - lastEnd;
            if (segSweep > 3) {
              segments.push({ start: ridge.startAngle + lastEnd, sweep: segSweep - ridge.gapSize / 2 });
            }
            lastEnd = segEnd + ridge.gapSize / 2;
          });
          const lastSweep = ridge.availableSweep - lastEnd;
          if (lastSweep > 3) {
            segments.push({ start: ridge.startAngle + lastEnd, sweep: lastSweep });
          }

          const isActive = activeIdx === ridgeIdx;
          const isDimmed = activeIdx !== null && activeIdx !== ridgeIdx;

          return (
            <g key={ridge.scoreKey}
              onMouseEnter={() => setHoveredIdx(ridgeIdx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={() => handleRidgeClick(ridge, ridgeIdx)}
              style={{ cursor: 'pointer' }}
            >
              {/* Background track */}
              {segments.map((seg, si) => {
                const path = arcPath(ridge.rx, ridge.ry, seg.start, seg.sweep);
                if (!path) return null;
                return (
                  <path key={`bg-${si}`} d={path} fill="none"
                    stroke={ridge.computedColor} strokeWidth={ridge.strokeWidth}
                    strokeLinecap="round" opacity={isDimmed ? 0.04 : 0.1}
                    style={{ transition: 'opacity 0.3s ease' }}
                  />
                );
              })}

              {/* Filled ridge */}
              {segments.map((seg, si) => {
                const segStart = seg.start - ridge.startAngle;
                const fillEnd = ridge.filledSweep;
                if (segStart >= fillEnd) return null;
                const filledPortion = Math.min(seg.sweep, fillEnd - segStart);
                const path = arcPath(ridge.rx, ridge.ry, seg.start, filledPortion);
                if (!path) return null;
                return (
                  <path key={`fill-${si}`} d={path} fill="none"
                    stroke={ridge.computedColor}
                    strokeWidth={isActive ? ridge.strokeWidth + 8 : ridge.strokeWidth}
                    strokeLinecap="round"
                    opacity={isActive ? 1 : isDimmed ? 0.15 : ridge.computedOpacity}
                    filter={isActive ? 'url(#fp-highlight-glow)' : ridge.value >= 7 ? 'url(#fp-glow-hi)' : ridge.value >= 4 ? 'url(#fp-glow-med)' : ''}
                    style={{ transition: 'all 0.3s ease' }}
                  />
                );
              })}

              {/* Label on the ridge when active */}
              {isActive && (() => {
                const labelAngleDeg = ridge.startAngle + ridge.availableSweep * 0.5;
                const labelRad = (labelAngleDeg * Math.PI) / 180;
                const lx = cx + (ridge.rx + 35) * Math.cos(labelRad);
                const ly = cy + (ridge.ry + 35) * Math.sin(labelRad);
                return (
                  <g style={{ transition: 'opacity 0.3s ease' }}>
                    <rect x={lx - 45} y={ly - 16} width={90} height={32} rx={8}
                      fill={ridge.computedColor} opacity={0.95} />
                    <text x={lx} y={ly + 1} textAnchor="middle" fontSize="13" fontWeight="900"
                      fill="white" letterSpacing="0.5">
                      {ridge.scoreKey}: {ridge.value.toFixed(1)}
                    </text>
                    <text x={lx} y={ly + 14} textAnchor="middle" fontSize="9" fontWeight="600"
                      fill="rgba(255,255,255,0.8)">
                      {ridge.value <= 3 ? 'Bom' : ridge.value <= 6 ? 'Atenção' : 'Crítico'}
                    </text>
                  </g>
                );
              })()}
            </g>
          );
        })}

        {/* CENTER SCORE */}
        <text x={cx} y={cy - 20} textAnchor="middle" fontSize="64" fontWeight="900"
          fill={centerColor} filter="url(#fp-core-glow)" letterSpacing="-2">
          {myidScore.toFixed(1)}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="fill-muted-foreground"
          fontSize="14" fontWeight="700" letterSpacing="5">MyID SCORE</text>
        <rect x={cx - 48} y={cy + 22} width={96} height={28} rx={14}
          fill={centerColor} opacity={0.15} />
        <text x={cx} y={cy + 41} textAnchor="middle" fill={centerColor}
          fontSize="12" fontWeight="800" letterSpacing="2.5">{label}</text>

        {/* LEGEND */}
        <g transform={`translate(60, ${vh - 60})`}>
          <text x={0} y={9} fontSize="11" fontWeight="700" className="fill-foreground" letterSpacing="1.5">ESCALA DE CORES:</text>
          {[
            { color: 'hsl(270, 60%, 75%)', x: 150 },
            { color: 'hsl(230, 70%, 60%)', x: 172 },
            { color: 'hsl(210, 75%, 55%)', x: 194 },
            { color: 'hsl(35, 85%, 55%)', x: 216 },
            { color: 'hsl(0, 85%, 50%)', x: 238 },
          ].map((c, i) => (
            <rect key={i} x={c.x} y={0} width={20} height={16} rx={4} fill={c.color} opacity={0.85} />
          ))}
          <text x={150} y={30} fontSize="9" className="fill-muted-foreground">Ótimo</text>
          <text x={248} y={30} fontSize="9" className="fill-muted-foreground">Crítico</text>

          <circle cx={330} cy={9} r={6} fill="hsl(0, 85%, 50%)" opacity={0.8} />
          <text x={342} y={12} fontSize="10" fontWeight="600" className="fill-foreground">Demanda</text>
          <text x={342} y={26} fontSize="9" className="fill-muted-foreground">Cristas internas</text>

          <circle cx={440} cy={9} r={6} fill="hsl(210, 75%, 55%)" opacity={0.8} />
          <text x={452} y={12} fontSize="10" fontWeight="600" className="fill-foreground">Capacidade</text>
          <text x={452} y={26} fontSize="9" className="fill-muted-foreground">Cristas externas</text>
        </g>
      </svg>
    </div>
  );
}
