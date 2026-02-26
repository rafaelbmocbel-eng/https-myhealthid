import React from 'react';
import type { FingerprintRing } from '@/types/myid';

interface Props {
  rings: FingerprintRing[];
  myidScore: number;
  className?: string;
}

/**
 * MyID Fingerprint Visualization
 * Inner rings (warm colors) = Demand factors (D, EFI, P, I)
 * Outer rings (cool colors) = Capacity factors (R, C, N)
 */
export default function MyIDFingerprint({ rings, myidScore, className = '' }: Props) {
  const innerRings = rings.filter(r => r.type === 'inner');
  const outerRings = rings.filter(r => r.type === 'outer');

  const cx = 200;
  const cy = 220;
  const baseRadius = 40;
  const ringSpacing = 22;

  // Generate fingerprint-style arcs
  const generateArc = (
    radius: number,
    value: number, // 0-10
    startAngle: number,
    sweepAngle: number,
    color: string,
    strokeWidth: number,
  ) => {
    const normalizedSweep = (value / 10) * sweepAngle;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = ((startAngle + normalizedSweep) * Math.PI) / 180;
    
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    
    const largeArc = normalizedSweep > 180 ? 1 : 0;
    
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  // Fingerprint: inner rings go from bottom, curving up like a fingerprint
  const innerAngles = [
    { start: 200, sweep: 280 },
    { start: 190, sweep: 300 },
    { start: 180, sweep: 320 },
    { start: 170, sweep: 340 },
  ];
  
  const outerAngles = [
    { start: 160, sweep: 340 },
    { start: 150, sweep: 340 },
    { start: 140, sweep: 340 },
  ];

  return (
    <div className={`relative ${className}`}>
      <svg viewBox="0 0 400 440" className="w-full max-w-sm mx-auto">
        <defs>
          {/* Glow filters */}
          {rings.map(ring => (
            <filter key={`glow-${ring.scoreKey}`} id={`glow-${ring.scoreKey}`}>
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ))}
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Center glow */}
        <circle cx={cx} cy={cy} r={baseRadius - 5} fill="url(#centerGlow)" />

        {/* Center score */}
        <text x={cx} y={cy - 8} textAnchor="middle" className="fill-foreground" fontSize="28" fontWeight="bold">
          {myidScore.toFixed(1)}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="fill-muted-foreground" fontSize="10">
          MyID Score
        </text>

        {/* Inner rings (warm - demand) */}
        {innerRings.map((ring, i) => {
          const radius = baseRadius + (i + 1) * ringSpacing;
          const angle = innerAngles[i] || innerAngles[innerAngles.length - 1];
          const sw = 6 + (ring.value / 10) * 4; // 6-10px stroke
          
          return (
            <g key={ring.scoreKey}>
              {/* Background arc */}
              <path
                d={generateArc(radius, 10, angle.start, angle.sweep, ring.color, sw)}
                fill="none" stroke={ring.color} strokeWidth={sw} strokeLinecap="round"
                opacity={0.15}
              />
              {/* Value arc */}
              <path
                d={generateArc(radius, ring.value, angle.start, angle.sweep, ring.color, sw)}
                fill="none" stroke={ring.color} strokeWidth={sw} strokeLinecap="round"
                filter={ring.value > 6 ? `url(#glow-${ring.scoreKey})` : undefined}
                opacity={0.85}
              />
              {/* Label */}
              {(() => {
                const labelAngle = ((angle.start + (ring.value / 10) * angle.sweep + 5) * Math.PI) / 180;
                const lx = cx + (radius + 15) * Math.cos(labelAngle);
                const ly = cy + (radius + 15) * Math.sin(labelAngle);
                return (
                  <text x={lx} y={ly} textAnchor={lx > cx ? 'start' : 'end'}
                    className="fill-foreground" fontSize="9" fontWeight="600">
                    {ring.label} {ring.value.toFixed(1)}
                  </text>
                );
              })()}
            </g>
          );
        })}

        {/* Outer rings (cool - capacity) */}
        {outerRings.map((ring, i) => {
          const radius = baseRadius + (innerRings.length + i + 1) * ringSpacing;
          const angle = outerAngles[i] || outerAngles[outerAngles.length - 1];
          const sw = 5 + (ring.value / 10) * 3;
          
          return (
            <g key={ring.scoreKey}>
              <path
                d={generateArc(radius, 10, angle.start, angle.sweep, ring.color, sw)}
                fill="none" stroke={ring.color} strokeWidth={sw} strokeLinecap="round"
                opacity={0.12}
              />
              <path
                d={generateArc(radius, ring.value, angle.start, angle.sweep, ring.color, sw)}
                fill="none" stroke={ring.color} strokeWidth={sw} strokeLinecap="round"
                opacity={0.75}
                strokeDasharray={ring.scoreKey === 'N' ? '8 4' : undefined}
              />
              {(() => {
                const labelAngle = ((angle.start + (ring.value / 10) * angle.sweep + 5) * Math.PI) / 180;
                const lx = cx + (radius + 15) * Math.cos(labelAngle);
                const ly = cy + (radius + 15) * Math.sin(labelAngle);
                return (
                  <text x={lx} y={ly} textAnchor={lx > cx ? 'start' : 'end'}
                    className="fill-foreground" fontSize="9" fontWeight="600">
                    {ring.label} {ring.value.toFixed(1)}
                  </text>
                );
              })()}
            </g>
          );
        })}

        {/* Legend */}
        <g transform="translate(20, 420)">
          <rect x="0" y="0" width="8" height="8" rx="2" fill="#FF6B6B" opacity="0.8" />
          <text x="12" y="8" fontSize="8" className="fill-muted-foreground">Demanda (quente)</text>
          <rect x="120" y="0" width="8" height="8" rx="2" fill="#87CEEB" opacity="0.8" />
          <text x="132" y="8" fontSize="8" className="fill-muted-foreground">Capacidade (frio)</text>
        </g>
      </svg>
    </div>
  );
}
