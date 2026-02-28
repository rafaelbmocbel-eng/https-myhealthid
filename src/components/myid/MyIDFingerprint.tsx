import React, { useMemo } from 'react';
import type { FingerprintRing } from '@/types/myid';

interface Props {
  rings: FingerprintRing[];
  myidScore: number;
  className?: string;
}

/**
 * MyID Fingerprint — realistic oval fingerprint visualization.
 * Each ridge = one metric. Inner (warm) = Demand. Outer (cool) = Capacity.
 * Ridges have gaps/breaks like a real fingerprint.
 */
export default function MyIDFingerprint({ rings, myidScore, className = '' }: Props) {
  const innerRings = rings.filter(r => r.type === 'inner');
  const outerRings = rings.filter(r => r.type === 'outer');
  const allRings = [...innerRings, ...outerRings];

  const cx = 250;
  const cy = 260;

  const ridgeData = useMemo(() => {
    const baseRx = 30;
    const baseRy = 38;
    const spacing = 22;

    return allRings.map((ring, i) => {
      const rx = baseRx + i * spacing;
      const ry = baseRy + i * spacing * 1.25;
      const isInner = ring.type === 'inner';

      // Create fingerprint-like breaks/gaps
      // Each ridge has 2-3 segments with small gaps
      const valuePct = Math.max(ring.value / 10, 0.08);
      
      // Main arc coverage based on value
      const totalCoverage = 280 + valuePct * 60; // 280-340 degrees
      const gapSize = 8 + i * 1.5; // gaps get slightly bigger outward
      
      // Create segments with gaps — fingerprint effect
      const segments: { start: number; sweep: number; isFilled: boolean }[] = [];
      
      // Bottom opening (like a real fingerprint opens at bottom)
      const openingAngle = Math.max(20 - i * 0.8, 8);
      const startAngle = 90 + openingAngle; // start from bottom-right going clockwise
      const endAngle = 90 - openingAngle + 360; // end at bottom-left
      const availableSweep = 360 - openingAngle * 2;
      
      // Filled portion based on value
      const filledSweep = availableSweep * valuePct;
      
      // Create 2-3 gap positions along the ridge for realism
      const numGaps = i % 3 === 0 ? 2 : (i % 2 === 0 ? 3 : 2);
      const gapPositions = [];
      for (let g = 0; g < numGaps; g++) {
        // Distribute gaps somewhat randomly but deterministically
        const basePos = (g + 1) / (numGaps + 1);
        const jitter = ((i * 7 + g * 13) % 20 - 10) / 100;
        gapPositions.push(Math.max(0.1, Math.min(0.9, basePos + jitter)));
      }

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
        strokeWidth: Math.max(8 - i * 0.4, 4.5),
      };
    });
  }, [allRings]);

  // Elliptical arc path helper
  const ellipseArcPath = (rx: number, ry: number, startDeg: number, sweepDeg: number) => {
    if (sweepDeg < 0.5) return '';
    const startRad = (startDeg * Math.PI) / 180;
    const endRad = ((startDeg + sweepDeg) * Math.PI) / 180;
    
    const x1 = cx + rx * Math.cos(startRad);
    const y1 = cy + ry * Math.sin(startRad);
    const x2 = cx + rx * Math.cos(endRad);
    const y2 = cy + ry * Math.sin(endRad);
    
    const largeArc = sweepDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${rx} ${ry} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  // Label position along the ridge
  const labelPosition = (rx: number, ry: number, angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + (rx + 14) * Math.cos(rad),
      y: cy + (ry + 14) * Math.sin(rad),
    };
  };

  // Score color
  const scoreColor = myidScore <= 2 ? '#22c55e' : myidScore <= 4 ? '#84cc16' : myidScore <= 6 ? '#eab308' : myidScore <= 8 ? '#f97316' : '#ef4444';

  return (
    <div className={`relative ${className}`}>
      <svg viewBox="0 0 500 540" className="w-full max-w-md mx-auto">
        <defs>
          <filter id="fp-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="fp-center-glow">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="fp-center-grad" cx="50%" cy="50%" r="8%">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="fp-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.03" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background */}
        <ellipse cx={cx} cy={cy} rx={240} ry={260} fill="url(#fp-bg)" />

        {/* Center warm glow */}
        <ellipse cx={cx} cy={cy} rx={40} ry={50} fill="url(#fp-center-grad)" filter="url(#fp-center-glow)" />

        {/* ── RIDGES ── */}
        {ridgeData.map((ridge) => {
          // Build segments with gaps
          const segments: { start: number; sweep: number }[] = [];
          let currentAngle = ridge.startAngle;
          let remainingSweep = ridge.availableSweep;

          // Sort gap positions
          const gaps = ridge.gapPositions.sort();

          let lastEnd = 0;
          gaps.forEach((gapPos, gi) => {
            const segEnd = gapPos * ridge.availableSweep;
            const segSweep = segEnd - lastEnd;
            if (segSweep > 2) {
              segments.push({
                start: ridge.startAngle + lastEnd,
                sweep: segSweep - ridge.gapSize / 2,
              });
            }
            lastEnd = segEnd + ridge.gapSize / 2;
          });
          // Last segment
          const lastSweep = ridge.availableSweep - lastEnd;
          if (lastSweep > 2) {
            segments.push({
              start: ridge.startAngle + lastEnd,
              sweep: lastSweep,
            });
          }

          // Filled segments (based on value)
          const filledRatio = ridge.filledSweep / ridge.availableSweep;

          // Label position — place at the midpoint of the ridge
          const labelAngle = ridge.startAngle + ridge.availableSweep * 0.35 + ridge.index * 15;
          const lp = labelPosition(ridge.rx, ridge.ry, labelAngle);
          const isLeftSide = lp.x < cx;

          return (
            <g key={ridge.scoreKey}>
              {/* Background track segments — very faint */}
              {segments.map((seg, si) => {
                const path = ellipseArcPath(ridge.rx, ridge.ry, seg.start, seg.sweep);
                if (!path) return null;
                return (
                  <path
                    key={`bg-${si}`}
                    d={path}
                    fill="none"
                    stroke={ridge.color}
                    strokeWidth={ridge.strokeWidth}
                    strokeLinecap="round"
                    opacity={0.12}
                  />
                );
              })}

              {/* Filled ridge segments */}
              {segments.map((seg, si) => {
                // Calculate how much of this segment should be filled
                const segStartInTotal = seg.start - ridge.startAngle;
                const segEndInTotal = segStartInTotal + seg.sweep;
                const fillEnd = ridge.filledSweep;

                if (segStartInTotal >= fillEnd) return null; // completely unfilled

                const filledPortion = Math.min(seg.sweep, fillEnd - segStartInTotal);
                const path = ellipseArcPath(ridge.rx, ridge.ry, seg.start, filledPortion);
                if (!path) return null;

                const isHighValue = ridge.value >= 6;

                return (
                  <path
                    key={`fill-${si}`}
                    d={path}
                    fill="none"
                    stroke={ridge.color}
                    strokeWidth={ridge.strokeWidth}
                    strokeLinecap="round"
                    opacity={ridge.isInner ? 0.9 : 0.75}
                    filter={isHighValue ? 'url(#fp-glow)' : undefined}
                    strokeDasharray={ridge.scoreKey === 'N' ? '12 6' : undefined}
                  />
                );
              })}

              {/* Label */}
              <text
                x={lp.x}
                y={lp.y}
                textAnchor={isLeftSide ? 'end' : 'start'}
                className="fill-foreground"
                fontSize="7.5"
                fontWeight="600"
                letterSpacing="0.2"
              >
                {ridge.index + 1}) {ridge.label} {ridge.value.toFixed(1)}/10
              </text>
            </g>
          );
        })}

        {/* ── CENTER SCORE ── */}
        <text x={cx} y={cy - 4} textAnchor="middle"
          fontSize="26" fontWeight="800" fill={scoreColor}
          filter="url(#fp-center-glow)">
          {myidScore.toFixed(1)}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle"
          className="fill-muted-foreground" fontSize="8" fontWeight="600"
          letterSpacing="2.5">
          MyID
        </text>

        {/* ── LEGEND ── */}
        <g transform="translate(30, 518)">
          <text x="0" y="0" fontSize="8" fontWeight="700" className="fill-foreground" letterSpacing="1">
            IDENTIDADE
          </text>
          <text x="0" y="12" fontSize="7" className="fill-muted-foreground" fontWeight="500">
            QUESTIONNAIRE METRICS
          </text>
          <text x="200" y="0" fontSize="7" fontWeight="600" className="fill-muted-foreground">
            INNER RIDGES: Modifiable Factors (Warm Colors)
          </text>
          <text x="200" y="11" fontSize="7" fontWeight="600" className="fill-muted-foreground">
            OUTER RIDGES: Non-Modifiable Factors (Cool Colors)
          </text>
        </g>
      </svg>
    </div>
  );
}
