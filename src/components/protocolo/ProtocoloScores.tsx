import { Badge } from '@/components/ui/badge';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { getThermalColor } from '@/utils/myidCalculations';
import { calcularPerdaDimensao, DIMENSION_LABELS } from '@/utils/myid/lossTable';

interface Props {
  scores: Record<string, any>;
}

const DEMAND_ITEMS = [
  { key: 'D', label: 'Dor', fullLabel: 'Dor (Intensidade)' },
  { key: 'EFI', label: 'Função', fullLabel: 'Funcionalidade' },
  { key: 'P', label: 'Psico', fullLabel: 'Psicológico (Medo/Evitação)' },
  { key: 'I', label: 'Inércia', fullLabel: 'Inércia (Mudanças Recentes)' },
  { key: 'N', label: 'Ruído', fullLabel: 'Ruído Sistêmico' },
];

const CAPACITY_ITEMS = [
  { key: 'R', label: 'Regulação', fullLabel: 'Regulação (Sono/Energia)' },
  { key: 'C', label: 'Contexto', fullLabel: 'Contexto Social' },
  { key: 'AF', label: 'Atividade', fullLabel: 'Atividade Física' },
  { key: 'HID', label: 'Hidratação', fullLabel: 'Hidratação' },
  { key: 'NUT', label: 'Nutrição', fullLabel: 'Nutrição' },
  { key: 'ERG', label: 'Ergonomia', fullLabel: 'Ergonomia' },
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
    // Use loss table for actual clinical impact
    const lossInput = isDemand ? val : (10 - val);
    const perda = calcularPerdaDimensao(item.key, lossInput);
    return {
      name: item.label,
      value: val,
      severity: perda.perda_pontos,
      lossPoints: perda.perda_pontos,
      color: getThermicColor(val, isDemand ? 'demand' : 'capacity'),
    };
  });

  const top3 = [...barData].sort((a, b) => b.severity - a.severity).slice(0, 3);

  return (
    <div className="space-y-6 mb-6">
      {/* Row 1: Unified Gauge + Radar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="clinical-card bg-gradient-to-br from-background to-muted/30 border-2 border-border/50 shadow-lg">
          <div className="mb-4">
            <h3 className="font-bold text-sm flex items-center gap-2 text-red-600">
              <span className="h-6 w-6 rounded-lg bg-red-100 flex items-center justify-center text-xs shadow-sm">🔥</span>
              Perfil: Estressores (Demanda)
            </h3>
            <p className="text-[10px] text-muted-foreground mt-1.5 leading-tight pr-4">
              <strong>Como ler:</strong> Quanto mais o gráfico se expande para as bordas externas, <strong>maior</strong> é a sobrecarga naquele fator. Ideal: o mais próximo do centro (0).
            </p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarDemand} outerRadius="65%" margin={{ top: 10, right: 25, bottom: 10, left: 25 }}>
              <PolarGrid stroke="hsl(210, 18%, 87%)" strokeDasharray="3 3" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: 'hsl(215, 12%, 42%)', fontWeight: 600 }} />
              <PolarRadiusAxis domain={[0, 10]} tick={{ fontSize: 8 }} angle={30} axisLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', fontSize: '11px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                formatter={(value: number) => [`${value.toFixed(1)}/10`, 'Sobrecarga']}
              />
              <Radar
                name="Estressores"
                dataKey="value"
                stroke="hsl(0, 84%, 60%)"
                fill="hsl(0, 84%, 60%)"
                fillOpacity={0.25}
                strokeWidth={2}
                dot={{ r: 3, fill: 'hsl(0, 84%, 60%)', stroke: 'white', strokeWidth: 1.5 }}
                activeDot={{ r: 5, stroke: 'white' }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="clinical-card bg-gradient-to-br from-background to-muted/30 border-2 border-border/50 shadow-lg">
          <div className="mb-4">
            <h3 className="font-bold text-sm flex items-center gap-2 text-emerald-600">
              <span className="h-6 w-6 rounded-lg bg-emerald-100 flex items-center justify-center text-xs shadow-sm">🛡️</span>
              Perfil: Capacidades (Reserva)
            </h3>
            <p className="text-[10px] text-muted-foreground mt-1.5 leading-tight pr-4">
              <strong>Como ler:</strong> Quanto mais o gráfico se expande para as bordas externas, <strong>mais forte e resiliente</strong> é o seu sistema. Ideal: preencher todo o mapa (10).
            </p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarCapacity} outerRadius="65%" margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
              <PolarGrid stroke="hsl(210, 18%, 87%)" strokeDasharray="3 3" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: 'hsl(215, 12%, 42%)', fontWeight: 600 }} />
              <PolarRadiusAxis domain={[0, 10]} tick={{ fontSize: 8 }} angle={30} axisLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', fontSize: '11px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                formatter={(value: number) => [`${value.toFixed(1)}/10`, 'Reserva']}
              />
              <Radar
                name="Capacidades"
                dataKey="value"
                stroke="hsl(173, 58%, 39%)"
                fill="hsl(173, 58%, 39%)"
                fillOpacity={0.25}
                strokeWidth={2}
                dot={{ r: 3, fill: 'hsl(173, 58%, 39%)', stroke: 'white', strokeWidth: 1.5 }}
                activeDot={{ r: 5, stroke: 'white' }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Top 3 Alertas */}
      <div className="grid grid-cols-1 gap-4">
        <div className="clinical-card bg-gradient-to-br from-background to-muted/30 border border-border/50 shadow-sm p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="h-5 w-5 rounded-md bg-destructive/10 flex items-center justify-center text-[10px]">⚠️</span>
            <h3 className="font-bold text-xs">Top 3 Alertas Clínicos</h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {top3.map((item, i) => {
              const severity = item.lossPoints >= 13 ? 'CRÍTICO' : item.lossPoints >= 8 ? 'ALTO' : item.lossPoints >= 3 ? 'MOD' : 'OK';
              const sevColor = item.lossPoints >= 13 ? 'bg-destructive text-white' : item.lossPoints >= 8 ? 'bg-warning text-white' : item.lossPoints >= 3 ? 'bg-muted text-muted-foreground' : 'bg-emerald-100 text-emerald-700';
              const rankColors = ['bg-destructive/10 text-destructive', 'bg-warning/10 text-warning', 'bg-muted text-muted-foreground'];
              return (
                <div key={item.name} className="flex flex-col gap-1.5 p-2 rounded-lg bg-muted/20 border border-border/40">
                  <div className="flex items-center justify-between">
                    <div className={`text-xs font-black w-5 h-5 rounded flex items-center justify-center ${rankColors[i]}`}>
                      {i + 1}
                    </div>
                    <Badge className={`text-[8px] px-1 py-0 ${sevColor}`}>{severity}</Badge>
                  </div>
                  <div className="font-semibold text-[10px] leading-tight truncate">{item.name}</div>
                  <div className="flex items-center gap-1">
                    <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-1 rounded-full" style={{ width: `${(item.value / 10) * 100}%`, backgroundColor: item.color }} />
                    </div>
                    <span className="text-[9px] font-bold shrink-0" style={{ color: item.color }}>{item.value.toFixed(1)}</span>
                  </div>
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
