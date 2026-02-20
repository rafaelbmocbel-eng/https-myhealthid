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

function GaugeChart({ value, maxValue = 200 }: { value: number; maxValue?: number }) {
  const pct = Math.min(1, value / maxValue);
  const angle = pct * 180;
  const color = getIdColor(value);
  const r = 80;
  const cx = 100;
  const cy = 95;

  const toRad = (deg: number) => ((180 - deg) * Math.PI) / 180;
  const endAngle = toRad(angle);
  const ex = cx + r * Math.cos(endAngle);
  const ey = cy - r * Math.sin(endAngle);
  const largeArc = angle > 180 ? 1 : 0;

  const bgStartX = cx - r;
  const bgStartY = cy;
  const bgEndX = cx + r;

  return (
    <svg viewBox="0 0 200 120" className="w-full max-w-[220px] mx-auto">
      {/* Background arc */}
      <path
        d={`M ${bgStartX} ${cy} A ${r} ${r} 0 0 1 ${bgEndX} ${cy}`}
        fill="none"
        stroke="hsl(210, 12%, 92%)"
        strokeWidth="14"
        strokeLinecap="round"
      />
      {/* Value arc */}
      {angle > 0 && (
        <path
          d={`M ${bgStartX} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
        />
      )}
      {/* Ticks */}
      {[0, 15, 30, 50, 80, 100, 150, 200].map(tick => {
        const tickPct = tick / maxValue;
        const tickAngle = toRad(tickPct * 180);
        const ir = r + 12;
        const tx = cx + ir * Math.cos(tickAngle);
        const ty = cy - ir * Math.sin(tickAngle);
        return (
          <text key={tick} x={tx} y={ty} textAnchor="middle" dominantBaseline="middle"
            fontSize="7" fill="hsl(220, 10%, 50%)" fontWeight="500">
            {tick}
          </text>
        );
      })}
      {/* Value */}
      <text x={cx} y={cy - 15} textAnchor="middle" fontSize="28" fontWeight="800" fill={color}>
        {value.toFixed(1)}
      </text>
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize="10" fontWeight="700" fill={color}>
        {getIdLabel(value)}
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
        <div className="clinical-card flex flex-col items-center">
          <h3 className="font-semibold text-sm mb-2 w-full">🎯 ID Final – Índice de Dor</h3>
          <GaugeChart value={idFinal} />
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Quanto maior o valor, maior a complexidade clínica
          </p>
        </div>

        {/* Radar */}
        <div className="clinical-card">
          <h3 className="font-semibold text-sm mb-2">🕸️ Perfil Multidimensional</h3>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData} outerRadius="70%">
              <PolarGrid stroke="hsl(210, 18%, 89%)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'hsl(215, 12%, 48%)' }} />
              <PolarRadiusAxis domain={[0, 10]} tick={{ fontSize: 8 }} axisLine={false} />
              <Radar
                dataKey="value"
                stroke="hsl(213, 55%, 22%)"
                fill="hsl(40, 95%, 52%)"
                fillOpacity={0.25}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Bar chart + Top 3 alertas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Bar chart */}
        <div className="clinical-card md:col-span-2">
          <h3 className="font-semibold text-sm mb-3">📊 Scores da Avaliação Base</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
              <Tooltip
                formatter={(val: number) => [`${val}/10`, 'Score']}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
                {barData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top 3 alertas */}
        <div className="clinical-card flex flex-col">
          <h3 className="font-semibold text-sm mb-3">⚠️ Top 3 Alertas</h3>
          <div className="space-y-3 flex-1">
            {top3.map((item, i) => {
              const severity = item.value >= 8 ? 'CRÍTICO' : item.value >= 6 ? 'ALTO' : 'MODERADO';
              const sevColor = item.value >= 8 ? 'bg-destructive text-white' : item.value >= 6 ? 'bg-warning text-white' : 'bg-muted text-muted-foreground';
              return (
                <div key={item.name} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                  <div className="text-2xl font-black text-muted-foreground/40">#{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{item.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-2 rounded-full transition-all" style={{ width: `${(item.value / 10) * 100}%`, backgroundColor: item.color }} />
                      </div>
                      <span className="text-xs font-bold shrink-0">{item.value}/10</span>
                    </div>
                  </div>
                  <Badge className={`text-[10px] ${sevColor}`}>{severity}</Badge>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">
            Dimensões com maior impacto no quadro clínico
          </p>
        </div>
      </div>

      {/* Row 3: Legenda explicativa */}
      <div className="clinical-card bg-muted/30">
        <h3 className="font-semibold text-sm mb-2">📖 Como interpretar</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success shrink-0" />
            <span>0–3: Baixo risco</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-warning shrink-0" />
            <span>4–6: Moderado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(25,95%,53%)' }} />
            <span>7–8: Alto risco</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-destructive shrink-0" />
            <span>9–10: Crítico</span>
          </div>
        </div>
      </div>
    </div>
  );
}
