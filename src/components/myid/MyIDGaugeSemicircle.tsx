import React from 'react';

interface Props {
  score: number; // 0-100
  classificacao: string;
  cor: string;
  emoji?: string;
}

const SEGMENTS = [
  { min: 0, max: 29, label: '0-29', color: '#DC2626' },
  { min: 30, max: 49, label: '30-49', color: '#EF4444' },
  { min: 50, max: 69, label: '50-69', color: '#F97316' },
  { min: 70, max: 84, label: '70-84', color: '#EAB308' },
  { min: 85, max: 100, label: '85-100', color: '#22C55E' },
];

export default function MyIDGaugeSemicircle({ score, classificacao, cor, emoji }: Props) {
  const cx = 200;
  const cy = 190;
  const r = 150;
  const strokeWidth = 32;
  const totalAngle = 180; // semicircle
  const startAngle = 180; // left side

  function arcPath(startDeg: number, endDeg: number, radius: number) {
    const s = (startDeg * Math.PI) / 180;
    const e = (endDeg * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(s);
    const y1 = cy + radius * Math.sin(s);
    const x2 = cx + radius * Math.cos(e);
    const y2 = cy + radius * Math.sin(e);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  }

  // Map score 0-100 to angle 180-360
  const needleAngle = startAngle + (Math.min(Math.max(score, 0), 100) / 100) * totalAngle;
  const needleLen = r - strokeWidth / 2 - 10;
  const nx = cx + needleLen * Math.cos((needleAngle * Math.PI) / 180);
  const ny = cy + needleLen * Math.sin((needleAngle * Math.PI) / 180);

  // Segment boundaries mapped to angles
  const segmentPaths = SEGMENTS.map((seg) => {
    const sDeg = startAngle + (seg.min / 100) * totalAngle;
    const eDeg = startAngle + ((seg.max + 1) / 100) * totalAngle;
    return { ...seg, sDeg, eDeg };
  });

  // Label positions
  const labelPositions = segmentPaths.map((seg) => {
    const midDeg = (seg.sDeg + seg.eDeg) / 2;
    const labelR = r + 22;
    const rad = (midDeg * Math.PI) / 180;
    return {
      x: cx + labelR * Math.cos(rad),
      y: cy + labelR * Math.sin(rad),
      label: seg.label,
      rotation: midDeg - 270,
    };
  });

  return (
    <svg viewBox="0 0 400 240" className="w-full max-w-sm mx-auto">
      {/* Background arc segments */}
      {segmentPaths.map((seg, i) => (
        <path
          key={i}
          d={arcPath(seg.sDeg, seg.eDeg, r)}
          fill="none"
          stroke={seg.color}
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
        />
      ))}

      {/* Segment labels */}
      {labelPositions.map((lp, i) => (
        <text
          key={i}
          x={lp.x}
          y={lp.y}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={`rotate(${lp.rotation}, ${lp.x}, ${lp.y})`}
          className="fill-muted-foreground"
          style={{ fontSize: '9px', fontWeight: 700 }}
        >
          {lp.label}
        </text>
      ))}

      {/* Needle */}
      <line
        x1={cx}
        y1={cy}
        x2={nx}
        y2={ny}
        stroke="hsl(var(--foreground))"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r={8} fill="hsl(var(--foreground))" />
      <circle cx={cx} cy={cy} r={4} fill="hsl(var(--background))" />

      {/* Score text */}
      <text x={cx} y={cy - 40} textAnchor="middle" dominantBaseline="auto"
        style={{ fontSize: '52px', fontWeight: 900, fill: cor }}>
        {Math.round(score)}
      </text>
      <text x={cx + 32} y={cy - 42} textAnchor="start" dominantBaseline="auto"
        className="fill-muted-foreground" style={{ fontSize: '18px', fontWeight: 700 }}>
        /100
      </text>

      {/* Classification badge */}
      <rect x={cx - 50} y={cy + 10} width={100} height={28} rx={14} fill={cor} />
      <text x={cx} y={cy + 28} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: '12px', fontWeight: 900, fill: 'white', letterSpacing: '0.05em' }}>
        {emoji} {classificacao}
      </text>
    </svg>
  );
}
