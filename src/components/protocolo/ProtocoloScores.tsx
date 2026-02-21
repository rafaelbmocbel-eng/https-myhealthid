import { Badge } from '@/components/ui/badge';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell
} from 'recharts';

interface Props {
  scores: Record<string, any>;
}

const SCORE_ITEMS = [
  { key: 'E', label: 'Estrutural', fullLabel: 'Estrutural', color: 'hsl(217, 91%, 60%)' },
  { key: 'P', label: 'Psico-Comp.', fullLabel: 'Psicológico-Comportamental', color: 'hsl(0, 72%, 51%)' },
  { key: 'C', label: 'Contextual', fullLabel: 'Carga Contextual', color: 'hsl(25, 95%, 53%)' },
  { key: 'F', label: 'Biológico', fullLabel: 'Fatores Biológicos', color: 'hsl(142, 71%, 45%)' },
  { key: 'D', label: 'Dor', fullLabel: 'Intensidade da Dor', color: 'hsl(271, 91%, 65%)' },
  { key: 'R', label: 'Regulação', fullLabel: 'Regulação (Sono/Energia/Psico)', color: 'hsl(215, 14%, 45%)' },
  { key: 'EFI', label: 'Funcional.', fullLabel: 'Funcionalidade', color: 'hsl(173, 58%, 39%)' },
];

function getIdColor(val: number) {
  if (val >= 80) return 'hsl(0, 72%, 51%)';
  if (val >= 50) return 'hsl(25, 95%, 53%)';
  if (val >= 30) return 'hsl(38, 92%, 50%)';
  return 'hsl(142, 71%, 45%)';
}

function getIdLabel(val: number) {
  if (val >= 100) return 'EXTREMO';
  if (val >= 80) return 'CRÍTICO';
  if (val >= 50) return 'SEVERO';
  if (val >= 30) return 'MODERADO';
  if (val >= 15) return 'LEVE';
  return 'MÍNIMO';
}

function getIdGradient(val: number): [string, string] {
  if (val >= 80) return ['hsl(0, 72%, 55%)', 'hsl(0, 72%, 40%)'];
  if (val >= 50) return ['hsl(25, 95%, 58%)', 'hsl(15, 85%, 42%)'];
  if (val >= 30) return ['hsl(40, 95%, 55%)', 'hsl(30, 85%, 42%)'];
  return ['hsl(152, 60%, 45%)', 'hsl(142, 71%, 32%)'];
}

function GaugeChart({ value, maxValue = 200 }: { value: number; maxValue?: number }) {
  const pct = Math.min(1, value / maxValue);
  const angle = pct * 180;
  const color = getIdColor(value);
  const [gradStart, gradEnd] = getIdGradient(value);
  const r = 80;
  const cx = 100;
  const cy = 95;
  const gradId = `gauge-grad-${Math.random().toString(36).slice(2, 6)}`;

  const toRad = (deg: number) => ((180 - deg) * Math.PI) / 180;
  const endAngle = toRad(angle);
  const ex = cx + r * Math.cos(endAngle);
  const ey = cy - r * Math.sin(endAngle);
  const largeArc = angle > 180 ? 1 : 0;

  const bgStartX = cx - r;
  const bgEndX = cx + r;

  // Tick marks
  const ticks = [0, 15, 30, 50, 80, 100, 150, 200];

  return (
    <svg viewBox="0 0 200 130" className="w-full max-w-[240px] mx-auto drop-shadow-lg">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={gradStart} />
          <stop offset="100%" stopColor={gradEnd} />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      {/* Background arc */}
      <path
        d={`M ${bgStartX} ${cy} A ${r} ${r} 0 0 1 ${bgEndX} ${cy}`}
        fill="none"
        stroke="hsl(210, 12%, 90%)"
        strokeWidth="16"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* Value arc with gradient */}
      {angle > 0 && (
        <path
          d={`M ${bgStartX} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="16"
          strokeLinecap="round"
          filter="url(#glow)"
        />
      )}
      {/* Tick marks */}
      {ticks.map(tick => {
        const tickPct = tick / maxValue;
        const tickAngle = toRad(tickPct * 180);
        const ir = r + 14;
        const tx = cx + ir * Math.cos(tickAngle);
        const ty = cy - ir * Math.sin(tickAngle);
        return (
          <text key={tick} x={tx} y={ty} textAnchor="middle" dominantBaseline="middle"
            fontSize="6.5" fill="hsl(220, 10%, 55%)" fontWeight="600" fontFamily="system-ui">
            {tick}
          </text>
        );
      })}
      {/* Dot at end */}
      {angle > 0 && (
        <circle cx={ex} cy={ey} r="4" fill={color} stroke="white" strokeWidth="2" />
      )}
      {/* Value */}
      <text x={cx} y={cy - 18} textAnchor="middle" fontSize="32" fontWeight="900" fill={color} fontFamily="system-ui">
        {value.toFixed(1)}
      </text>
      <text x={cx} y={cy + 3} textAnchor="middle" fontSize="10" fontWeight="800" fill={color} letterSpacing="1.5" fontFamily="system-ui">
        {getIdLabel(value)}
      </text>
      {/* Subtitle */}
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize="6" fill="hsl(220, 10%, 55%)" fontFamily="system-ui">
        Índice de Dor Multidimensional
      </text>
    </svg>
  );
}

export default function ProtocoloScores({ scores }: Props) {
  if (Object.keys(scores).length === 0) return null;

  const idFinal = (scores.idFinal as number) || 0;

  const radarData = SCORE_ITEMS.map(item => ({
    subject: item.label,
    value: ((scores[item.key] as number) || 0),
    fullMark: 10,
  }));

  const barData = SCORE_ITEMS.map(item => ({
    name: item.label,
    value: Number(((scores[item.key] as number) || 0).toFixed(1)),
    color: item.color,
  }));

  // Top 3 scores mais altos (piores)
  const top3 = [...barData].sort((a, b) => b.value - a.value).slice(0, 3);

  return (
    <div className="space-y-6 mb-6">
      {/* Row 1: Gauge + Radar side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Gauge ID Final */}
        <div className="clinical-card flex flex-col items-center bg-gradient-to-br from-background to-muted/30 border-2 border-border/50 shadow-lg">
          <h3 className="font-bold text-sm mb-3 w-full flex items-center gap-2">
            <span className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center text-xs">🎯</span>
            ID Final – Índice de Dor
          </h3>
          <GaugeChart value={idFinal} />
          <p className="text-[11px] text-muted-foreground mt-3 text-center leading-relaxed max-w-xs">
            Quanto maior o valor, maior a complexidade clínica e necessidade de intervenção multidimensional
          </p>
        </div>

        {/* Radar */}
        <div className="clinical-card bg-gradient-to-br from-background to-muted/30 border-2 border-border/50 shadow-lg">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
            <span className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center text-xs">🕸️</span>
            Perfil Multidimensional
          </h3>
          <ResponsiveContainer width="100%" height={230}>
            <RadarChart data={radarData} outerRadius="70%">
              <PolarGrid stroke="hsl(210, 18%, 87%)" strokeDasharray="3 3" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'hsl(215, 12%, 42%)', fontWeight: 600 }} />
              <PolarRadiusAxis domain={[0, 10]} tick={{ fontSize: 8 }} axisLine={false} />
              <Radar
                dataKey="value"
                stroke="hsl(213, 55%, 22%)"
                fill="hsl(40, 95%, 52%)"
                fillOpacity={0.2}
                strokeWidth={2.5}
                dot={{ r: 3, fill: 'hsl(213, 55%, 22%)', stroke: 'white', strokeWidth: 1.5 }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Bar chart + Top 3 alertas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Bar chart */}
        <div className="clinical-card md:col-span-2 bg-gradient-to-br from-background to-muted/30 border-2 border-border/50 shadow-lg">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
            <span className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center text-xs">📊</span>
            Scores da Avaliação Base
          </h3>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(210, 12%, 92%)" />
              <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} width={80} />
              <Tooltip
                formatter={(val: number) => [`${val}/10`, 'Score']}
                contentStyle={{ borderRadius: 12, fontSize: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.12)', border: 'none' }}
              />
              <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={18}>
                {barData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top 3 alertas */}
        <div className="clinical-card flex flex-col bg-gradient-to-br from-background to-muted/30 border-2 border-border/50 shadow-lg">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
            <span className="h-6 w-6 rounded-lg bg-destructive/10 flex items-center justify-center text-xs">⚠️</span>
            Top 3 Alertas Clínicos
          </h3>
          <div className="space-y-3 flex-1">
            {top3.map((item, i) => {
              const severity = item.value >= 8 ? 'CRÍTICO' : item.value >= 6 ? 'ALTO' : 'MODERADO';
              const sevColor = item.value >= 8 ? 'bg-destructive text-white' : item.value >= 6 ? 'bg-warning text-white' : 'bg-muted text-muted-foreground';
              const rankColors = ['bg-destructive/10 text-destructive', 'bg-warning/10 text-warning', 'bg-muted text-muted-foreground'];
              return (
                <div key={item.name} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/50 hover:shadow-md transition-shadow">
                  <div className={`text-xl font-black w-8 h-8 rounded-lg flex items-center justify-center ${rankColors[i]}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{item.name}</div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-2.5 rounded-full transition-all" 
                          style={{ 
                            width: `${(item.value / 10) * 100}%`, 
                            backgroundColor: item.color,
                            boxShadow: `0 0 8px ${item.color}40`
                          }} 
                        />
                      </div>
                      <span className="text-xs font-bold shrink-0" style={{ color: item.color }}>{item.value}/10</span>
                    </div>
                  </div>
                  <Badge className={`text-[10px] ${sevColor} shadow-sm`}>{severity}</Badge>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3 text-center">
            Dimensões com maior impacto no quadro clínico
          </p>
        </div>
      </div>

      {/* Row 3: Legenda explicativa */}
      <div className="clinical-card bg-gradient-to-br from-muted/20 to-muted/40 border-2 border-border/30">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
          <span className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center text-xs">📖</span>
          Como Interpretar os Resultados
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background/50">
            <div className="w-4 h-4 rounded-full bg-success shrink-0 shadow-sm" />
            <span className="font-medium">0–3: Baixo risco</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background/50">
            <div className="w-4 h-4 rounded-full bg-warning shrink-0 shadow-sm" />
            <span className="font-medium">4–6: Moderado</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background/50">
            <div className="w-4 h-4 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: 'hsl(25,95%,53%)' }} />
            <span className="font-medium">7–8: Alto risco</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background/50">
            <div className="w-4 h-4 rounded-full bg-destructive shrink-0 shadow-sm" />
            <span className="font-medium">9–10: Crítico</span>
          </div>
        </div>
      </div>
    </div>
  );
}
