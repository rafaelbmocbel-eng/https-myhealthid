import { Badge } from '@/components/ui/badge';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell
} from 'recharts';
import IdFinalGauge from '@/components/identidade/IdFinalGauge';

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

  const top3 = [...barData].sort((a, b) => b.value - a.value).slice(0, 3);

  return (
    <div className="space-y-6 mb-6">
      {/* Row 1: Unified Gauge + Radar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="clinical-card flex flex-col items-center bg-gradient-to-br from-background to-muted/30 border-2 border-border/50 shadow-lg">
          <h3 className="font-bold text-sm mb-3 w-full flex items-center gap-2">
            <span className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center text-xs">🎯</span>
            Equação da Dor — ID Final
          </h3>
          <IdFinalGauge value={idFinal} compact />
        </div>

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

      {/* Row 2: Bar chart + Top 3 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="clinical-card md:col-span-2 bg-gradient-to-br from-background to-muted/30 border-2 border-border/50 shadow-lg">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
            <span className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center text-xs">📊</span>
            Scores por Dimensão
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
                <div key={item.name} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
                  <div className={`text-xl font-black w-8 h-8 rounded-lg flex items-center justify-center ${rankColors[i]}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{item.name}</div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-2.5 rounded-full" style={{ width: `${(item.value / 10) * 100}%`, backgroundColor: item.color }} />
                      </div>
                      <span className="text-xs font-bold shrink-0" style={{ color: item.color }}>{item.value}/10</span>
                    </div>
                  </div>
                  <Badge className={`text-[10px] ${sevColor} shadow-sm`}>{severity}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
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
