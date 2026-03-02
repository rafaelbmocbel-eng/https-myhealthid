import React, { useMemo, useState } from 'react';
import type { FingerprintRing } from '@/types/myid';

interface Props {
  rings: FingerprintRing[];
  myidScore: number;
  className?: string;
  onRingClick?: (ring: FingerprintRing) => void;
}

/**
 * Value-to-color: 0 (good) = transparent/cool violet, 10 (bad) = deep red
 * Scale: transparent → violet → blue → orange → red
 */
function valueToColor(value: number): string {
  const v = Math.max(0, Math.min(10, value));
  if (v <= 1) return 'hsl(270, 60%, 75%)';      // soft violet
  if (v <= 2.5) return 'hsl(260, 65%, 65%)';     // violet
  if (v <= 4) return 'hsl(230, 70%, 60%)';       // blue-violet
  if (v <= 5.5) return 'hsl(210, 75%, 55%)';     // blue
  if (v <= 7) return 'hsl(35, 85%, 55%)';        // orange
  if (v <= 8.5) return 'hsl(15, 90%, 50%)';      // red-orange
  return 'hsl(0, 85%, 50%)';                      // red
}

function valueToOpacity(value: number): number {
  return 0.35 + (value / 10) * 0.65; // 0.35 → 1.0
}

function scoreStatusLabel(score: number): string {
  if (score <= 2) return 'LEVE';
  if (score <= 4) return 'MODERADO';
  if (score <= 6) return 'SEVERO';
  if (score <= 8) return 'CRÍTICO';
  return 'EXTREMO';
}

export default function MyIDFingerprint({ rings, myidScore, className = '', onRingClick }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const innerRings = rings.filter(r => r.type === 'inner');
  const outerRings = rings.filter(r => r.type === 'outer');
  const allRings = [...innerRings, ...outerRings];

  const cx = 300;
  const cy = 280;

  const ridgeData = useMemo(() => {
    const baseRx = 30;
    const baseRy = 38;
    const spacing = 14;

    return allRings.map((ring, i) => {
      const rx = baseRx + i * spacing;
      const ry = baseRy + i * spacing * 1.15;
      const valuePct = Math.max(ring.value / 10, 0.08);
      const color = valueToColor(ring.value);
      const opacity = valueToOpacity(ring.value);

      const openingAngle = Math.max(18 - i * 0.8, 6);
      const startAngle = 90 + openingAngle;
      const availableSweep = 360 - openingAngle * 2;
      const filledSweep = availableSweep * Math.max(valuePct, 0.25);

      // Organic gaps
      const numGaps = i % 3 === 0 ? 1 : 2;
      const gapPositions: number[] = [];
      for (let g = 0; g < numGaps; g++) {
        const basePos = (g + 1) / (numGaps + 1);
        const jitter = ((i * 13 + g * 19) % 14 - 7) / 100;
        gapPositions.push(Math.max(0.15, Math.min(0.85, basePos + jitter)));
      }
      const gapSize = 3 + i * 0.4;

      return {
        ...ring,
        rx, ry, startAngle, availableSweep, filledSweep,
        gapPositions, gapSize,
        isInner: ring.type === 'inner',
        index: i,
        strokeWidth: Math.max(11 - i * 0.5, 5),
        computedColor: color,
        computedOpacity: opacity,
      };
    });
  }, [allRings]);

  const arcPath = (rx: number, ry: number, startDeg: number, sweepDeg: number) => {
    if (sweepDeg < 0.5) return '';
    const s = (startDeg * Math.PI) / 180;
    const e = ((startDeg + sweepDeg) * Math.PI) / 180;
    const x1 = cx + rx * Math.cos(s);
    const y1 = cy + ry * Math.sin(s);
    const x2 = cx + rx * Math.cos(e);
    const y2 = cy + ry * Math.sin(e);
    return `M ${x1} ${y1} A ${rx} ${ry} 0 ${sweepDeg > 180 ? 1 : 0} 1 ${x2} ${y2}`;
  };

  const centerColor = valueToColor(myidScore);
  const label = scoreStatusLabel(myidScore);

  const handleRidgeClick = (ridge: typeof ridgeData[0], idx: number) => {
    setSelectedIdx(selectedIdx === idx ? null : idx);
    if (onRingClick) {
      onRingClick(ridge);
    }
  };

  const activeRidge = selectedIdx !== null ? ridgeData[selectedIdx] : hoveredIdx !== null ? ridgeData[hoveredIdx] : null;

  return (
    <div className={`relative ${className}`}>
      <svg viewBox="0 0 600 600" className="w-full max-w-lg mx-auto" style={{ filter: 'drop-shadow(0 2px 12px rgba(0,0,0,0.06))' }}>
        <defs>
          <filter id="fp-glow-v">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="fp-glow-soft">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="fp-core-glow">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="ridge-texture">
            <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <radialGradient id="fp-center-grad" cx="50%" cy="50%">
            <stop offset="0%" stopColor={centerColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={centerColor} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="fp-bg" cx="50%" cy="48%" r="50%">
            <stop offset="0%" stopColor="hsl(270, 40%, 60%)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="hsl(270, 40%, 60%)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background */}
        <ellipse cx={cx} cy={cy} rx={260} ry={280} fill="url(#fp-bg)" />
        <ellipse cx={cx} cy={cy} rx={50} ry={58} fill="url(#fp-center-grad)" filter="url(#fp-core-glow)" />

        {/* ── RIDGES ── */}
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

          const isActive = hoveredIdx === ridgeIdx || selectedIdx === ridgeIdx;
          const labelSide = ridgeIdx % 2 === 0 ? 'right' : 'left';
          const labelAngleDeg = labelSide === 'right'
            ? ridge.startAngle + ridge.availableSweep * 0.12
            : ridge.startAngle + ridge.availableSweep * 0.88;
          const labelRad = (labelAngleDeg * Math.PI) / 180;
          const dotX = cx + ridge.rx * Math.cos(labelRad);
          const dotY = cy + ridge.ry * Math.sin(labelRad);
          const leaderLen = 30 + (allRings.length - ridgeIdx) * 2.5;
          const leaderX = labelSide === 'right' ? cx + ridge.rx + leaderLen + 8 : cx - ridge.rx - leaderLen - 8;
          const leaderY = dotY;

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
                    strokeLinecap="round" opacity={0.12}
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
                    strokeWidth={isActive ? ridge.strokeWidth + 3 : ridge.strokeWidth}
                    strokeLinecap="round"
                    opacity={isActive ? 1 : ridge.computedOpacity}
                    filter={`${ridge.value >= 7 ? 'url(#fp-glow-v)' : ridge.value >= 4 ? 'url(#fp-glow-soft)' : ''} url(#ridge-texture)`}
                    className="transition-all duration-200"
                  />
                );
              })}

              {/* Leader dot */}
              <circle cx={dotX} cy={dotY} r={isActive ? 4.5 : 3} fill={ridge.computedColor} opacity={0.9}
                className="transition-all duration-200" />

              {/* Leader line */}
              <line x1={dotX} y1={dotY} x2={leaderX} y2={leaderY}
                stroke={ridge.computedColor} strokeWidth={isActive ? 1.5 : 0.8}
                opacity={isActive ? 0.7 : 0.3} strokeDasharray="3 2" />

              {/* Label */}
              <g opacity={isActive ? 1 : 0.75} className="transition-all duration-200">
                <rect
                  x={labelSide === 'right' ? leaderX : leaderX - 22}
                  y={leaderY - 9} width={22} height={18} rx={4}
                  fill={ridge.computedColor} opacity={0.9}
                />
                <text
                  x={labelSide === 'right' ? leaderX + 11 : leaderX - 11}
                  y={leaderY + 4} textAnchor="middle" fontSize="7.5" fontWeight="900"
                  fill="white" letterSpacing="0.3"
                >{ridge.scoreKey}</text>

                <text
                  x={labelSide === 'right' ? leaderX + 26 : leaderX - 26}
                  y={leaderY + 1}
                  textAnchor={labelSide === 'right' ? 'start' : 'end'}
                  className="fill-foreground" fontSize="8" fontWeight="600"
                >{ridge.label.split('(')[0].trim()}</text>

                <text
                  x={labelSide === 'right' ? leaderX + 26 : leaderX - 26}
                  y={leaderY + 12}
                  textAnchor={labelSide === 'right' ? 'start' : 'end'}
                  fill={ridge.computedColor} fontSize="9" fontWeight="800"
                >
                  {ridge.value.toFixed(1)}
                  <tspan className="fill-muted-foreground" fontSize="7" fontWeight="500">/10</tspan>
                </text>

                {/* Mini bar */}
                <rect
                  x={labelSide === 'right' ? leaderX + 26 : leaderX - 26 - Math.max(ridge.value / 10 * 38, 4)}
                  y={leaderY + 16} width={Math.max(ridge.value / 10 * 38, 4)} height={2.5}
                  rx={1.25} fill={ridge.computedColor} opacity={0.6}
                />
              </g>
            </g>
          );
        })}

        {/* ── CENTER SCORE ── */}
        <text x={cx} y={cy - 12} textAnchor="middle" fontSize="36" fontWeight="900"
          fill={centerColor} filter="url(#fp-core-glow)" letterSpacing="-1">
          {myidScore.toFixed(1)}
        </text>
        <text x={cx} y={cy + 6} textAnchor="middle" className="fill-muted-foreground"
          fontSize="9" fontWeight="700" letterSpacing="3">MyID SCORE</text>
        <rect x={cx - 28} y={cy + 12} width={56} height={17} rx={8.5}
          fill={centerColor} opacity={0.15} />
        <text x={cx} y={cy + 24} textAnchor="middle" fill={centerColor}
          fontSize="7.5" fontWeight="800" letterSpacing="1.5">{label}</text>

        {/* ── TOOLTIP (selected/hovered ridge info) ── */}
        {activeRidge && (
          <g>
            <rect x={cx - 100} y={510} width={200} height={40} rx={8}
              fill="hsl(var(--card))" stroke={activeRidge.computedColor} strokeWidth={1.5} opacity={0.95} />
            <text x={cx} y={526} textAnchor="middle" fontSize="10" fontWeight="700"
              fill={activeRidge.computedColor}>
              {activeRidge.scoreKey}: {activeRidge.label}
            </text>
            <text x={cx} y={540} textAnchor="middle" fontSize="11" fontWeight="900"
              fill={activeRidge.computedColor}>
              {activeRidge.value.toFixed(1)} / 10
              <tspan className="fill-muted-foreground" fontSize="8" fontWeight="500">
                {' '}— {activeRidge.value <= 3 ? 'Bom' : activeRidge.value <= 6 ? 'Atenção' : 'Crítico'}
              </tspan>
            </text>
          </g>
        )}

        {/* ── LEGEND ── */}
        <g transform="translate(30, 565)">
          <text x={0} y={7} fontSize="7" fontWeight="700" className="fill-foreground">ESCALA DE CORES:</text>
          {/* Color scale bar */}
          <rect x={90} y={1} width={12} height={10} rx={2} fill="hsl(270, 60%, 75%)" opacity={0.8} />
          <rect x={104} y={1} width={12} height={10} rx={2} fill="hsl(230, 70%, 60%)" opacity={0.8} />
          <rect x={118} y={1} width={12} height={10} rx={2} fill="hsl(210, 75%, 55%)" opacity={0.8} />
          <rect x={132} y={1} width={12} height={10} rx={2} fill="hsl(35, 85%, 55%)" opacity={0.8} />
          <rect x={146} y={1} width={12} height={10} rx={2} fill="hsl(0, 85%, 50%)" opacity={0.8} />
          <text x={90} y={20} fontSize="6" className="fill-muted-foreground">Ótimo</text>
          <text x={155} y={20} fontSize="6" className="fill-muted-foreground">Crítico</text>

          <circle cx={210} cy={6} r={4} fill="hsl(270, 60%, 75%)" opacity={0.8} />
          <text x={218} y={9} fontSize="7" fontWeight="600" className="fill-foreground">Demanda</text>
          <text x={218} y={18} fontSize="6" className="fill-muted-foreground">Cristas internas</text>

          <circle cx={290} cy={6} r={4} fill="hsl(210, 75%, 55%)" opacity={0.8} />
          <text x={298} y={9} fontSize="7" fontWeight="600" className="fill-foreground">Capacidade</text>
          <text x={298} y={18} fontSize="6" className="fill-muted-foreground">Cristas externas</text>
        </g>
      </svg>
    </div>
  );
}
