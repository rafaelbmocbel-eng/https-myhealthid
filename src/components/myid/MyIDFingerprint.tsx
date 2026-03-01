import React, { useMemo } from 'react';
import type { FingerprintRing } from '@/types/myid';

interface Props {
  rings: FingerprintRing[];
  myidScore: number;
  className?: string;
}

/**
 * MyID Fingerprint — vivid biometric fingerprint visualization.
 * Dense ridges, strong colors, clear labels with leader lines.
 */
export default function MyIDFingerprint({ rings, myidScore, className = '' }: Props) {
  const innerRings = rings.filter(r => r.type === 'inner');
  const outerRings = rings.filter(r => r.type === 'outer');
  const allRings = [...innerRings, ...outerRings];

  const cx = 300;
  const cy = 300;
  const totalRings = allRings.length;

  const ridgeData = useMemo(() => {
    const baseRx = 42;
    const baseRy = 52;
    const spacing = 18;

    return allRings.map((ring, i) => {
      const rx = baseRx + i * spacing;
      const ry = baseRy + i * spacing * 1.2;
      const isInner = ring.type === 'inner';
      const valuePct = Math.max(ring.value / 10, 0.05);

      // Bottom opening — tighter for inner, wider for outer
      const openingAngle = Math.max(15 - i * 0.6, 5);
      const startAngle = 90 + openingAngle;
      const availableSweep = 360 - openingAngle * 2;

      // Filled portion — always at least 30% visible for readability
      const minFill = 0.3;
      const filledSweep = availableSweep * Math.max(valuePct, minFill);

      // Fingerprint gaps — small, organic breaks
      const numGaps = i % 3 === 0 ? 1 : 2;
      const gapPositions: number[] = [];
      for (let g = 0; g < numGaps; g++) {
        const basePos = (g + 1) / (numGaps + 1);
        const jitter = ((i * 11 + g * 17) % 14 - 7) / 100;
        gapPositions.push(Math.max(0.15, Math.min(0.85, basePos + jitter)));
      }
      const gapSize = 4 + i * 0.5;

      return {
        ...ring,
        rx,
        ry,
        startAngle,
        availableSweep,
        filledSweep,
        gapPositions,
        gapSize,
        isInner,
        index: i,
        strokeWidth: Math.max(10 - i * 0.45, 5),
      };
    });
  }, [allRings]);

  // Elliptical arc path
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

  // Score color with vivid palette
  const scoreColor =
    myidScore <= 2 ? '#10b981' :
    myidScore <= 4 ? '#22c55e' :
    myidScore <= 6 ? '#f59e0b' :
    myidScore <= 8 ? '#f97316' : '#ef4444';

  const scoreLabel =
    myidScore <= 2 ? 'BAIXO' :
    myidScore <= 4 ? 'MODERADO' :
    myidScore <= 6 ? 'ELEVADO' :
    myidScore <= 8 ? 'ALTO' : 'CRÍTICO';

  return (
    <div className={`relative ${className}`}>
      <svg viewBox="0 0 600 640" className="w-full max-w-lg mx-auto" style={{ filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.08))' }}>
        <defs>
          {/* Glow for high-value ridges */}
          <filter id="fp-glow-strong">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="fp-glow-soft">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="fp-center-glow">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Center radial */}
          <radialGradient id="fp-core" cx="50%" cy="50%">
            <stop offset="0%" stopColor={scoreColor} stopOpacity="0.25" />
            <stop offset="60%" stopColor={scoreColor} stopOpacity="0.08" />
            <stop offset="100%" stopColor={scoreColor} stopOpacity="0" />
          </radialGradient>
          {/* Background subtle */}
          <radialGradient id="fp-bg-grad" cx="50%" cy="48%" r="50%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.04" />
            <stop offset="70%" stopColor="hsl(var(--muted))" stopOpacity="0.02" />
            <stop offset="100%" stopColor="hsl(var(--muted))" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Subtle background oval */}
        <ellipse cx={cx} cy={cy} rx={280} ry={300} fill="url(#fp-bg-grad)" />

        {/* Center warm core */}
        <ellipse cx={cx} cy={cy} rx={55} ry={65} fill="url(#fp-core)" filter="url(#fp-center-glow)" />

        {/* ── RIDGES ── */}
        {ridgeData.map((ridge) => {
          // Build segments with gaps
          const segments: { start: number; sweep: number }[] = [];
          const gaps = [...ridge.gapPositions].sort();
          let lastEnd = 0;

          gaps.forEach((gapPos) => {
            const segEnd = gapPos * ridge.availableSweep;
            const segSweep = segEnd - lastEnd;
            if (segSweep > 3) {
              segments.push({
                start: ridge.startAngle + lastEnd,
                sweep: segSweep - ridge.gapSize / 2,
              });
            }
            lastEnd = segEnd + ridge.gapSize / 2;
          });
          const lastSweep = ridge.availableSweep - lastEnd;
          if (lastSweep > 3) {
            segments.push({
              start: ridge.startAngle + lastEnd,
              sweep: lastSweep,
            });
          }

          // Determine label placement — alternate left/right
          const labelSide = ridge.index % 2 === 0 ? 'right' : 'left';
          const labelAngleDeg = labelSide === 'right' 
            ? ridge.startAngle + ridge.availableSweep * 0.15
            : ridge.startAngle + ridge.availableSweep * 0.85;
          const labelRad = (labelAngleDeg * Math.PI) / 180;
          const dotX = cx + ridge.rx * Math.cos(labelRad);
          const dotY = cy + ridge.ry * Math.sin(labelRad);
          
          // Leader line endpoint
          const leaderLen = 35 + (totalRings - ridge.index) * 3;
          const leaderX = labelSide === 'right' 
            ? cx + ridge.rx + leaderLen + 10
            : cx - ridge.rx - leaderLen - 10;
          const leaderY = dotY;

          // Value bar width (for label decoration)
          const barWidth = Math.max(ridge.value / 10 * 40, 4);

          const isHighValue = ridge.value >= 7;
          const isMedValue = ridge.value >= 4;

          return (
            <g key={ridge.scoreKey}>
              {/* Background track — full arc, subtle */}
              {segments.map((seg, si) => {
                const path = arcPath(ridge.rx, ridge.ry, seg.start, seg.sweep);
                if (!path) return null;
                return (
                  <path
                    key={`bg-${si}`}
                    d={path}
                    fill="none"
                    stroke={ridge.color}
                    strokeWidth={ridge.strokeWidth}
                    strokeLinecap="round"
                    opacity={0.15}
                  />
                );
              })}

              {/* Filled ridge — vivid */}
              {segments.map((seg, si) => {
                const segStart = seg.start - ridge.startAngle;
                const fillEnd = ridge.filledSweep;
                if (segStart >= fillEnd) return null;
                const filledPortion = Math.min(seg.sweep, fillEnd - segStart);
                const path = arcPath(ridge.rx, ridge.ry, seg.start, filledPortion);
                if (!path) return null;

                return (
                  <path
                    key={`fill-${si}`}
                    d={path}
                    fill="none"
                    stroke={ridge.color}
                    strokeWidth={ridge.strokeWidth}
                    strokeLinecap="round"
                    opacity={isHighValue ? 1 : isMedValue ? 0.85 : 0.65}
                    filter={isHighValue ? 'url(#fp-glow-strong)' : isMedValue ? 'url(#fp-glow-soft)' : undefined}
                  />
                );
              })}

              {/* Leader dot on the ridge */}
              <circle cx={dotX} cy={dotY} r={3} fill={ridge.color} opacity={0.9} />

              {/* Leader line */}
              <line
                x1={dotX} y1={dotY}
                x2={leaderX} y2={leaderY}
                stroke={ridge.color}
                strokeWidth={1}
                opacity={0.4}
                strokeDasharray="3 2"
              />

              {/* Label group at end of leader */}
              <g>
                {/* Score key badge */}
                <rect
                  x={labelSide === 'right' ? leaderX : leaderX - 48}
                  y={leaderY - 8}
                  width={20}
                  height={16}
                  rx={3}
                  fill={ridge.color}
                  opacity={0.9}
                />
                <text
                  x={labelSide === 'right' ? leaderX + 10 : leaderX - 38}
                  y={leaderY + 4}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="800"
                  fill="white"
                  letterSpacing="0.3"
                >
                  {ridge.scoreKey}
                </text>

                {/* Label text */}
                <text
                  x={labelSide === 'right' ? leaderX + 24 : leaderX - 52}
                  y={leaderY + 1}
                  textAnchor={labelSide === 'right' ? 'start' : 'end'}
                  className="fill-foreground"
                  fontSize="8.5"
                  fontWeight="600"
                >
                  {ridge.label}
                </text>

                {/* Value */}
                <text
                  x={labelSide === 'right' ? leaderX + 24 : leaderX - 52}
                  y={leaderY + 12}
                  textAnchor={labelSide === 'right' ? 'start' : 'end'}
                  fill={ridge.color}
                  fontSize="9"
                  fontWeight="800"
                >
                  {ridge.value.toFixed(1)}
                  <tspan className="fill-muted-foreground" fontSize="7" fontWeight="500">/10</tspan>
                </text>

                {/* Mini value bar */}
                <rect
                  x={labelSide === 'right' ? leaderX + 24 : leaderX - 52 - barWidth}
                  y={leaderY + 16}
                  width={barWidth}
                  height={2.5}
                  rx={1.25}
                  fill={ridge.color}
                  opacity={0.7}
                />
              </g>
            </g>
          );
        })}

        {/* ── CENTER SCORE ── */}
        <text
          x={cx} y={cy - 10}
          textAnchor="middle"
          fontSize="38"
          fontWeight="900"
          fill={scoreColor}
          filter="url(#fp-center-glow)"
          letterSpacing="-1"
        >
          {myidScore.toFixed(1)}
        </text>
        <text
          x={cx} y={cy + 8}
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize="10"
          fontWeight="700"
          letterSpacing="3"
        >
          MyID SCORE
        </text>
        {/* Status badge */}
        <rect
          x={cx - 30} y={cy + 14}
          width={60} height={18}
          rx={9}
          fill={scoreColor}
          opacity={0.15}
        />
        <text
          x={cx} y={cy + 27}
          textAnchor="middle"
          fill={scoreColor}
          fontSize="8"
          fontWeight="800"
          letterSpacing="1.5"
        >
          {scoreLabel}
        </text>

        {/* ── LEGEND ── */}
        <g transform="translate(40, 600)">
          {/* Inner legend */}
          <circle cx={8} cy={4} r={5} fill="#f97316" opacity={0.8} />
          <text x={18} y={7} fontSize="8" fontWeight="700" className="fill-foreground">
            DEMANDA
          </text>
          <text x={18} y={17} fontSize="7" className="fill-muted-foreground">
            Cristas internas (cores quentes)
          </text>

          {/* Outer legend */}
          <circle cx={208} cy={4} r={5} fill="#3b82f6" opacity={0.8} />
          <text x={218} y={7} fontSize="8" fontWeight="700" className="fill-foreground">
            CAPACIDADE
          </text>
          <text x={218} y={17} fontSize="7" className="fill-muted-foreground">
            Cristas externas (cores frias)
          </text>

          {/* Scale hint */}
          <text x={408} y={7} fontSize="7" fontWeight="600" className="fill-muted-foreground">
            0 = ótimo → 10 = crítico
          </text>
          <rect x={408} y={12} width={40} height={3} rx={1.5} fill="#22c55e" opacity={0.6} />
          <rect x={448} y={12} width={40} height={3} rx={1.5} fill="#f59e0b" opacity={0.6} />
          <rect x={488} y={12} width={40} height={3} rx={1.5} fill="#ef4444" opacity={0.6} />
        </g>
      </svg>
    </div>
  );
}
