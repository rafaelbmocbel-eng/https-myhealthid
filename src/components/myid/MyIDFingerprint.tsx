import React, { useMemo, useState } from 'react';
import type { FingerprintRing } from '@/types/myid';

interface Props {
  rings: FingerprintRing[];
  myidScore: number;
  className?: string;
  onRingClick?: (ring: FingerprintRing) => void;
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
  return 0.35 + (value / 10) * 0.65;
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

  // Higher resolution viewBox for better quality
  const vw = 800;
  const vh = 820;
  const cx = vw / 2;
  const cy = 380;

  const ridgeData = useMemo(() => {
    const baseRx = 42;
    const baseRy = 52;
    const spacing = 19;

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

      const numGaps = i % 3 === 0 ? 1 : 2;
      const gapPositions: number[] = [];
      for (let g = 0; g < numGaps; g++) {
        const basePos = (g + 1) / (numGaps + 1);
        const jitter = ((i * 13 + g * 19) % 14 - 7) / 100;
        gapPositions.push(Math.max(0.15, Math.min(0.85, basePos + jitter)));
      }
      const gapSize = 4 + i * 0.5;

      return {
        ...ring,
        rx, ry, startAngle, availableSweep, filledSweep,
        gapPositions, gapSize,
        isInner: ring.type === 'inner',
        index: i,
        strokeWidth: Math.max(14 - i * 0.6, 7),
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
    if (onRingClick) onRingClick(ridge);
  };

  const activeRidge = selectedIdx !== null ? ridgeData[selectedIdx] : hoveredIdx !== null ? ridgeData[hoveredIdx] : null;

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox={`0 0 ${vw} ${vh}`}
        className="w-full mx-auto"
        style={{ filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.08))', maxWidth: '640px' }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="fp-glow-v2">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="fp-glow-soft2">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="fp-core-glow2">
            <feGaussianBlur stdDeviation="16" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="ridge-texture2">
            <feTurbulence type="fractalNoise" baseFrequency="0.4" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <radialGradient id="fp-center-grad2" cx="50%" cy="50%">
            <stop offset="0%" stopColor={centerColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={centerColor} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="fp-bg2" cx="50%" cy="46%" r="50%">
            <stop offset="0%" stopColor="hsl(270, 40%, 60%)" stopOpacity="0.05" />
            <stop offset="100%" stopColor="hsl(270, 40%, 60%)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background */}
        <ellipse cx={cx} cy={cy} rx={350} ry={370} fill="url(#fp-bg2)" />
        <ellipse cx={cx} cy={cy} rx={65} ry={75} fill="url(#fp-center-grad2)" filter="url(#fp-core-glow2)" />

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

          const isActive = hoveredIdx === ridgeIdx || selectedIdx === ridgeIdx;
          const labelSide = ridgeIdx % 2 === 0 ? 'right' : 'left';
          const labelAngleDeg = labelSide === 'right'
            ? ridge.startAngle + ridge.availableSweep * 0.12
            : ridge.startAngle + ridge.availableSweep * 0.88;
          const labelRad = (labelAngleDeg * Math.PI) / 180;
          const dotX = cx + ridge.rx * Math.cos(labelRad);
          const dotY = cy + ridge.ry * Math.sin(labelRad);
          const leaderLen = 40 + (allRings.length - ridgeIdx) * 3;
          const leaderX = labelSide === 'right' ? cx + ridge.rx + leaderLen + 12 : cx - ridge.rx - leaderLen - 12;
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
                    strokeWidth={isActive ? ridge.strokeWidth + 4 : ridge.strokeWidth}
                    strokeLinecap="round"
                    opacity={isActive ? 1 : ridge.computedOpacity}
                    filter={`${ridge.value >= 7 ? 'url(#fp-glow-v2)' : ridge.value >= 4 ? 'url(#fp-glow-soft2)' : ''} url(#ridge-texture2)`}
                    className="transition-all duration-200"
                  />
                );
              })}

              {/* Leader dot */}
              <circle cx={dotX} cy={dotY} r={isActive ? 6 : 4} fill={ridge.computedColor} opacity={0.9}
                className="transition-all duration-200" />

              {/* Leader line */}
              <line x1={dotX} y1={dotY} x2={leaderX} y2={leaderY}
                stroke={ridge.computedColor} strokeWidth={isActive ? 2 : 1}
                opacity={isActive ? 0.7 : 0.3} strokeDasharray="4 3" />

              {/* Label group */}
              <g opacity={isActive ? 1 : 0.8} className="transition-all duration-200">
                <rect
                  x={labelSide === 'right' ? leaderX : leaderX - 30}
                  y={leaderY - 12} width={30} height={24} rx={5}
                  fill={ridge.computedColor} opacity={0.9}
                />
                <text
                  x={labelSide === 'right' ? leaderX + 15 : leaderX - 15}
                  y={leaderY + 5} textAnchor="middle" fontSize="10" fontWeight="900"
                  fill="white" letterSpacing="0.3"
                >{ridge.scoreKey}</text>

                <text
                  x={labelSide === 'right' ? leaderX + 36 : leaderX - 36}
                  y={leaderY + 1}
                  textAnchor={labelSide === 'right' ? 'start' : 'end'}
                  className="fill-foreground" fontSize="10" fontWeight="600"
                >{ridge.label.split('(')[0].trim()}</text>

                <text
                  x={labelSide === 'right' ? leaderX + 36 : leaderX - 36}
                  y={leaderY + 15}
                  textAnchor={labelSide === 'right' ? 'start' : 'end'}
                  fill={ridge.computedColor} fontSize="12" fontWeight="800"
                >
                  {ridge.value.toFixed(1)}
                  <tspan className="fill-muted-foreground" fontSize="9" fontWeight="500">/10</tspan>
                </text>

                {/* Mini bar */}
                <rect
                  x={labelSide === 'right' ? leaderX + 36 : leaderX - 36 - Math.max(ridge.value / 10 * 50, 5)}
                  y={leaderY + 20} width={Math.max(ridge.value / 10 * 50, 5)} height={3}
                  rx={1.5} fill={ridge.computedColor} opacity={0.5}
                />
              </g>
            </g>
          );
        })}

        {/* CENTER SCORE */}
        <text x={cx} y={cy - 16} textAnchor="middle" fontSize="48" fontWeight="900"
          fill={centerColor} filter="url(#fp-core-glow2)" letterSpacing="-1.5">
          {myidScore.toFixed(1)}
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" className="fill-muted-foreground"
          fontSize="12" fontWeight="700" letterSpacing="4">MyID SCORE</text>
        <rect x={cx - 38} y={cy + 16} width={76} height={22} rx={11}
          fill={centerColor} opacity={0.15} />
        <text x={cx} y={cy + 31} textAnchor="middle" fill={centerColor}
          fontSize="10" fontWeight="800" letterSpacing="2">{label}</text>

        {/* TOOLTIP */}
        {activeRidge && (
          <g>
            <rect x={cx - 140} y={690} width={280} height={52} rx={10}
              fill="hsl(var(--card))" stroke={activeRidge.computedColor} strokeWidth={2} opacity={0.95} />
            <text x={cx} y={712} textAnchor="middle" fontSize="13" fontWeight="700"
              fill={activeRidge.computedColor}>
              {activeRidge.scoreKey}: {activeRidge.label}
            </text>
            <text x={cx} y={730} textAnchor="middle" fontSize="14" fontWeight="900"
              fill={activeRidge.computedColor}>
              {activeRidge.value.toFixed(1)} / 10
              <tspan className="fill-muted-foreground" fontSize="10" fontWeight="500">
                {' '}— {activeRidge.value <= 3 ? 'Bom' : activeRidge.value <= 6 ? 'Atenção' : 'Crítico'}
              </tspan>
            </text>
          </g>
        )}

        {/* LEGEND */}
        <g transform="translate(40, 760)">
          <text x={0} y={9} fontSize="9" fontWeight="700" className="fill-foreground" letterSpacing="1">ESCALA DE CORES:</text>
          <rect x={120} y={1} width={16} height={13} rx={3} fill="hsl(270, 60%, 75%)" opacity={0.8} />
          <rect x={138} y={1} width={16} height={13} rx={3} fill="hsl(230, 70%, 60%)" opacity={0.8} />
          <rect x={156} y={1} width={16} height={13} rx={3} fill="hsl(210, 75%, 55%)" opacity={0.8} />
          <rect x={174} y={1} width={16} height={13} rx={3} fill="hsl(35, 85%, 55%)" opacity={0.8} />
          <rect x={192} y={1} width={16} height={13} rx={3} fill="hsl(0, 85%, 50%)" opacity={0.8} />
          <text x={120} y={26} fontSize="8" className="fill-muted-foreground">Ótimo</text>
          <text x={202} y={26} fontSize="8" className="fill-muted-foreground">Crítico</text>

          <circle cx={280} cy={8} r={5} fill="hsl(270, 60%, 75%)" opacity={0.8} />
          <text x={290} y={11} fontSize="9" fontWeight="600" className="fill-foreground">Demanda</text>
          <text x={290} y={23} fontSize="8" className="fill-muted-foreground">Cristas internas</text>

          <circle cx={385} cy={8} r={5} fill="hsl(210, 75%, 55%)" opacity={0.8} />
          <text x={395} y={11} fontSize="9" fontWeight="600" className="fill-foreground">Capacidade</text>
          <text x={395} y={23} fontSize="8" className="fill-muted-foreground">Cristas externas</text>
        </g>
      </svg>
    </div>
  );
}
