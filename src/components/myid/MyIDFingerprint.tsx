import React, { useMemo } from 'react';
import type { FingerprintRing } from '@/types/myid';

interface Props {
  rings: FingerprintRing[];
  myidScore: number;
  className?: string;
}

/**
 * MyID Fingerprint Visualization — realistic fingerprint pattern
 * Each ridge = one metric. Inner ridges (warm) = Demand. Outer ridges (cool) = Capacity.
 * Inspired by biometric fingerprint health visualization.
 */
export default function MyIDFingerprint({ rings, myidScore, className = '' }: Props) {
  const innerRings = rings.filter(r => r.type === 'inner');
  const outerRings = rings.filter(r => r.type === 'outer');
  const allRings = [...innerRings, ...outerRings];

  const cx = 250;
  const cy = 280;

  // Fingerprint-style U-shaped arcs
  // Each ridge is a U that opens at the top, like a real fingerprint
  const ridges = useMemo(() => {
    const baseRadius = 28;
    const spacing = 18;
    
    return allRings.map((ring, i) => {
      const radius = baseRadius + i * spacing;
      const isInner = ring.type === 'inner';
      
      // The U opens wider as we go out — fingerprint effect
      // Start angle from bottom-left, sweep to bottom-right
      const openingDeg = Math.min(35 + i * 4, 75); // how wide the opening is at top
      const startAngle = 180 + openingDeg; // left side
      const endAngle = 360 - openingDeg;   // right side (wraps)
      const totalSweep = (360 - 2 * openingDeg);
      
      // Value determines how much of the ridge is "filled"
      const valuePct = Math.max(ring.value / 10, 0.05);
      const filledSweep = totalSweep * valuePct;
      
      return {
        ...ring,
        radius,
        startAngle,
        endAngle,
        totalSweep,
        filledSweep,
        isInner,
        index: i,
        strokeWidth: isInner ? 10 - i * 0.3 : 7 - (i - innerRings.length) * 0.2,
      };
    });
  }, [allRings, innerRings.length]);

  // Arc path generator
  const arcPath = (radius: number, startDeg: number, sweepDeg: number) => {
    const startRad = (startDeg * Math.PI) / 180;
    const endRad = ((startDeg + sweepDeg) * Math.PI) / 180;
    
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    
    const largeArc = sweepDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  // Label position at the end of each filled arc
  const labelPos = (radius: number, startDeg: number, sweepDeg: number) => {
    const endRad = ((startDeg + sweepDeg + 3) * Math.PI) / 180;
    return {
      x: cx + (radius + 14) * Math.cos(endRad),
      y: cy + (radius + 14) * Math.sin(endRad),
      anchor: endRad > Math.PI / 2 && endRad < (3 * Math.PI) / 2 ? 'end' : 'start',
    };
  };

  // Score color
  const scoreColor = myidScore <= 2 ? '#22c55e' : myidScore <= 4 ? '#84cc16' : myidScore <= 6 ? '#eab308' : myidScore <= 8 ? '#f97316' : '#ef4444';

  return (
    <div className={`relative ${className}`}>
      <svg viewBox="0 0 500 520" className="w-full max-w-md mx-auto">
        <defs>
          {/* Glow filters for high-value ridges */}
          <filter id="fp-glow-warm">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="fp-glow-cool">
            <feGaussianBlur stdDeviation="3" result="blur" />
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
          {/* Radial gradient for center warmth */}
          <radialGradient id="fp-center-gradient" cx="50%" cy="55%" r="12%">
            <stop offset="0%" stopColor="#dc2626" stopOpacity="0.25" />
            <stop offset="50%" stopColor="#f97316" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </radialGradient>
          {/* Background subtle radial */}
          <radialGradient id="fp-bg" cx="50%" cy="56%" r="50%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.04" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Subtle background */}
        <circle cx={cx} cy={cy} r={240} fill="url(#fp-bg)" />

        {/* Center warm glow */}
        <circle cx={cx} cy={cy} r={60} fill="url(#fp-center-gradient)" filter="url(#fp-center-glow)" />

        {/* ── RIDGES ── */}
        {ridges.map((ridge, i) => {
          const bgPath = arcPath(ridge.radius, ridge.startAngle, ridge.totalSweep);
          const fillPath = arcPath(ridge.radius, ridge.startAngle, ridge.filledSweep);
          const label = labelPos(ridge.radius, ridge.startAngle, ridge.filledSweep);
          const sw = Math.max(ridge.strokeWidth, 4);
          const isHighValue = ridge.value >= 6;

          return (
            <g key={ridge.scoreKey}>
              {/* Background track — very faint */}
              <path
                d={bgPath}
                fill="none"
                stroke={ridge.color}
                strokeWidth={sw}
                strokeLinecap="round"
                opacity={0.1}
              />
              {/* Filled ridge */}
              <path
                d={fillPath}
                fill="none"
                stroke={ridge.color}
                strokeWidth={sw}
                strokeLinecap="round"
                opacity={ridge.isInner ? 0.85 : 0.7}
                filter={isHighValue ? (ridge.isInner ? 'url(#fp-glow-warm)' : 'url(#fp-glow-cool)') : undefined}
                strokeDasharray={ridge.scoreKey === 'N' ? '10 5' : undefined}
              />
              {/* Sparkle dots along high-value ridges */}
              {isHighValue && [0.3, 0.6, 0.85].map((pct, si) => {
                const sparkAngle = ((ridge.startAngle + ridge.filledSweep * pct) * Math.PI) / 180;
                const sx = cx + ridge.radius * Math.cos(sparkAngle);
                const sy = cy + ridge.radius * Math.sin(sparkAngle);
                return (
                  <circle key={si} cx={sx} cy={sy} r={1.5}
                    fill="white" opacity={0.5 + si * 0.15}>
                    <animate attributeName="opacity" values="0.3;0.8;0.3"
                      dur={`${2 + si * 0.5}s`} repeatCount="indefinite" />
                  </circle>
                );
              })}
              {/* Label at end of filled arc */}
              <text
                x={label.x}
                y={label.y}
                textAnchor={label.anchor as any}
                className="fill-foreground"
                fontSize="8.5"
                fontWeight="600"
                letterSpacing="0.3"
              >
                {ridge.label} {ridge.value.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* ── CENTER SCORE ── */}
        <text x={cx} y={cy - 6} textAnchor="middle"
          fontSize="30" fontWeight="800" fill={scoreColor}
          filter="url(#fp-center-glow)">
          {myidScore.toFixed(1)}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle"
          className="fill-muted-foreground" fontSize="9" fontWeight="500"
          letterSpacing="2">
          MyID SCORE
        </text>

        {/* ── LEGEND ── */}
        <g transform="translate(30, 500)">
          <rect x="0" y="-2" width="10" height="10" rx="2" fill="#f97316" opacity="0.85" />
          <text x="14" y="7" fontSize="9" className="fill-muted-foreground" fontWeight="500">
            Demanda (quente)
          </text>
          <rect x="140" y="-2" width="10" height="10" rx="2" fill="#38bdf8" opacity="0.85" />
          <text x="154" y="7" fontSize="9" className="fill-muted-foreground" fontWeight="500">
            Capacidade (frio)
          </text>
          <rect x="290" y="-2" width="10" height="10" rx="2" fill="#a78bfa" opacity="0.85" strokeDasharray="4 2"
            stroke="#a78bfa" strokeWidth="1" />
          <text x="304" y="7" fontSize="9" className="fill-muted-foreground" fontWeight="500">
            Ruído sistêmico
          </text>
        </g>
      </svg>
    </div>
  );
}
