import React from 'react';

interface Props {
  score: number; // 0-100
  classificacao: string;
  cor: string;
  emoji?: string;
}

// 5 visual zones on the arc, but classification uses 4 levels
const SEGMENTS = [
  { min: 0, max: 29, label: '0-29', color: '#991B1B' },
  { min: 30, max: 49, label: '30-49', color: '#DC2626' },
  { min: 50, max: 69, label: '50-69', color: '#F97316' },
  { min: 70, max: 84, label: '70-84', color: '#EAB308' },
  { min: 85, max: 100, label: '85-100', color: '#10B981' },
];

export default function MyIDGaugeSemicircle({ score, classificacao, cor, emoji }: Props) {
  const cx = 200;
  const cy = 195;
  const r = 150;
  const strokeWidth = 34;
  const totalAngle = 180;
  const startAngle = 180;

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

  const clampedScore = Math.min(Math.max(score, 0), 100);
  const needleAngle = startAngle + (clampedScore / 100) * totalAngle;
  const needleLen = r - strokeWidth / 2 - 8;
  const nx = cx + needleLen * Math.cos((needleAngle * Math.PI) / 180);
  const ny = cy + needleLen * Math.sin((needleAngle * Math.PI) / 180);

  const segmentPaths = SEGMENTS.map((seg) => {
    const sDeg = startAngle + (seg.min / 100) * totalAngle;
    const eDeg = startAngle + (Math.min(seg.max + 1, 101) / 100) * totalAngle;
    return { ...seg, sDeg, eDeg };
  });

  const labelPositions = segmentPaths.map((seg) => {
    const midDeg = (seg.sDeg + seg.eDeg) / 2;
    const labelR = r + 24;
    const rad = (midDeg * Math.PI) / 180;
    return {
      x: cx + labelR * Math.cos(rad),
      y: cy + labelR * Math.sin(rad),
      label: seg.label,
      rotation: midDeg - 270,
    };
  });

  return (
    <svg viewBox="0 0 400 250" className="w-full max-w-sm mx-auto">
      {/* Arc segments */}
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

      {/* Score number - centered */}
      <text x={cx} y={cy - 50} textAnchor="middle" dominantBaseline="auto"
        style={{ fontSize: '56px', fontWeight: 900, fill: cor }}>
        {Math.round(clampedScore)}
      </text>
      <text x={cx} y={cy - 32} textAnchor="middle" dominantBaseline="auto"
        className="fill-muted-foreground" style={{ fontSize: '16px', fontWeight: 700 }}>
        /100
      </text>

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

      {/* Classification badge below needle */}
      <rect x={cx - 55} y={cy + 12} width={110} height={30} rx={15} fill={cor} />
      <text x={cx} y={cy + 31} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: '13px', fontWeight: 900, fill: 'white', letterSpacing: '0.06em' }}>
        {emoji} {classificacao}
      </text>
    </svg>
  );
}
