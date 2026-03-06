import { Badge } from '@/components/ui/badge';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { getThermalColor } from '@/utils/myidCalculations';

interface Props {
  scores: Record<string, any>;
}

const DEMAND_ITEMS = [
  { key: 'D', label: 'Dor', fullLabel: 'Intensidade da Dor' },
  { key: 'EFI', label: 'Disfunção', fullLabel: 'Disfunção Física' },
  { key: 'P', label: 'Severidade', fullLabel: 'Severidade Clínica' },
  { key: 'I', label: 'Incap.', fullLabel: 'Incapacidade' },
  { key: 'E', label: 'Estrutural', fullLabel: 'Comprometimento Estrutural' },
];

const CAPACITY_ITEMS = [
  { key: 'R', label: 'Respirar', fullLabel: 'Respirar (Sono/Energia)' },
  { key: 'C', label: 'Circular', fullLabel: 'Circular (Fluidez)' },
  { key: 'AF', label: 'Atividade', fullLabel: 'Atividade Física' },
  { key: 'HID', label: 'Hidratar', fullLabel: 'Hidratação' },
  { key: 'NUT', label: 'Nutrir', fullLabel: 'Nutrição' },
  { key: 'ERG', label: 'Energia', fullLabel: 'Ergometria/Métrica' },
];

const ALL_ITEMS = [...DEMAND_ITEMS, ...CAPACITY_ITEMS];

function getThermicColor(value: number, type: 'demand' | 'capacity'): string {
  if (type === 'demand') {
    return getThermalColor(value);
  } else {
    // High capacity = Good (Cold)
    // Low capacity = Bad (Warm)
    return getThermalColor(10 - value);
  }
}

export default function ProtocoloScores({ scores }: Props) {
  if (Object.keys(scores).length === 0) return null;


  const radarDemand = DEMAND_ITEMS.map(item => ({
    subject: item.label,
    value: ((scores[item.key] as number) || 0),
    fullMark: 10,
  }));

  const radarCapacity = CAPACITY_ITEMS.map(item => ({
    subject: item.label,
    value: ((scores[item.key] as number) || 0),
    fullMark: 10,
  }));

  const barData = ALL_ITEMS.map(item => {
    const isDemand = DEMAND_ITEMS.some(d => d.key === item.key);
    const val = Number(((scores[item.key] as number) || 0).toFixed(1));
    // Severity for sorting: for demand it's the value, for capacity it's the inverse
    const severity = isDemand ? val : (10 - val);
    return {
      name: item.label,
      value: val,
      severity,
      color: getThermicColor(val, isDemand ? 'demand' : 'capacity'),
    };
  });

  const top3 = [...barData].sort((a, b) => b.severity - a.severity).slice(0, 3);

  return (
    <div className="space-y-6 mb-6">
      {/* Row 1: Unified Gauge + Radar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="clinical-card bg-gradient-to-br from-background to-muted/30 border-2 border-border/50 shadow-lg">
          <h3 className="font-bold text-xs mb-3 flex items-center gap-2 text-red-600">
            <span className="h-5 w-5 rounded-lg bg-red-100 flex items-center justify-center text-[10px]">🔥</span>
            Perfil: Estressores (Demanda)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarDemand} outerRadius="70%">
              <PolarGrid stroke="hsl(210, 18%, 87%)" strokeDasharray="3 3" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: 'hsl(215, 12%, 42%)', fontWeight: 600 }} />
              <PolarRadiusAxis domain={[0, 10]} tick={{ fontSize: 7 }} axisLine={false} />
              <Radar
                dataKey="value"
                stroke="hsl(0, 84%, 60%)"
                fill="hsl(0, 84%, 60%)"
                fillOpacity={0.15}
                strokeWidth={2}
                dot={{ r: 2.5, fill: 'hsl(0, 84%, 60%)', stroke: 'white', strokeWidth: 1 }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="clinical-card bg-gradient-to-br from-background to-muted/30 border-2 border-border/50 shadow-lg">
          <h3 className="font-bold text-xs mb-3 flex items-center gap-2 text-emerald-600">
            <span className="h-5 w-5 rounded-lg bg-emerald-100 flex items-center justify-center text-[10px]">🛡️</span>
            Perfil: Capacidades (Reserva)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarCapacity} outerRadius="70%">
              <PolarGrid stroke="hsl(210, 18%, 87%)" strokeDasharray="3 3" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: 'hsl(215, 12%, 42%)', fontWeight: 600 }} />
              <PolarRadiusAxis domain={[0, 10]} tick={{ fontSize: 7 }} axisLine={false} />
              <Radar
                dataKey="value"
                stroke="hsl(173, 58%, 39%)"
                fill="hsl(173, 58%, 39%)"
                fillOpacity={0.15}
                strokeWidth={2}
                dot={{ r: 2.5, fill: 'hsl(173, 58%, 39%)', stroke: 'white', strokeWidth: 1 }}
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background/50 border border-border/20">
            <div className="w-3 h-3 rounded-full bg-emerald-600 shrink-0 shadow-sm" />
            <span className="font-medium">Frio: Impacto Positivo</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background/50 border border-border/20">
            <div className="w-3 h-3 rounded-full bg-amber-500 shrink-0 shadow-sm" />
            <span className="font-medium">Morno: Atenção</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background/50 border border-border/20">
            <div className="w-3 h-3 rounded-full bg-orange-500 shrink-0 shadow-sm" />
            <span className="font-medium">Quente: Sobrecarga</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background/50 border border-border/20">
            <div className="w-3 h-3 rounded-full bg-red-600 shrink-0 shadow-sm" />
            <span className="font-medium">🔥 Brasas: Crítico</span>
          </div>
        </div>
      </div>
    </div>
  );
}
