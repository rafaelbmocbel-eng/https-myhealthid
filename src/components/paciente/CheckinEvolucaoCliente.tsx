import { useMemo } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, TrendingUp } from 'lucide-react';
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import {
  ITENS_CHECKIN,
  ROTULOS_ITEM,
  dataCurta,
  variacaoDoItem,
  type ItemCheckin,
  type LinhaCheckin,
  type Variacao,
} from '@/lib/checkinSemanal';

interface Props {
  linhas: readonly LinhaCheckin[];
}

const SEMANAS_NO_GRAFICO = 12;

// Linhas distintas também pelo traço (e pelo marcador do tooltip), para a cor não ser o único sinal.
const ESTILO: Record<ItemCheckin, { cor: string; traco?: string }> = {
  fadiga: { cor: '#d97706' },
  sono: { cor: '#2563eb', traco: '6 3' },
  dor_muscular: { cor: '#0d9488', traco: '2 3' },
  estresse: { cor: '#7c3aed', traco: '8 3 2 3' },
  humor: { cor: '#059669', traco: '1 4' },
};

function textoDaVariacao(v: Variacao): string {
  if (v.sentido === 'igual') return 'igual';
  const pontos = Math.abs(v.delta);
  const verbo = v.sentido === 'melhorou' ? 'subiu' : 'caiu';
  return `${verbo} ${pontos} ${pontos === 1 ? 'ponto' : 'pontos'}`;
}

function IconeVariacao({ sentido }: { sentido: Variacao['sentido'] }) {
  if (sentido === 'melhorou') return <ArrowUp className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />;
  if (sentido === 'piorou') return <ArrowDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />;
  return <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />;
}

export default function CheckinEvolucaoCliente({ linhas }: Props) {
  const ordenadas = useMemo(
    () => [...linhas].sort((a, b) => a.semana.localeCompare(b.semana)),
    [linhas],
  );

  const dadosDoGrafico = useMemo(
    () => ordenadas.slice(-SEMANAS_NO_GRAFICO).map((l) => ({
      semana: dataCurta(l.semana),
      fadiga: l.fadiga,
      sono: l.sono,
      dor_muscular: l.dor_muscular,
      estresse: l.estresse,
      humor: l.humor,
    })),
    [ordenadas],
  );

  if (ordenadas.length < 2) {
    return (
      <Card>
        <CardContent className="space-y-1 p-5 text-center">
          <TrendingUp className="mx-auto h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
          <h2 className="text-sm font-bold text-foreground">Sua evolução</h2>
          <p className="text-sm text-muted-foreground">
            {ordenadas.length === 0
              ? 'Depois do seu primeiro check-in, é só responder de novo na próxima semana para ver como você está evoluindo.'
              : 'Falta só mais um check-in. Responda de novo na próxima semana e a sua evolução aparece aqui.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const ultima = ordenadas[ordenadas.length - 1];
  const anterior = ordenadas[ordenadas.length - 2];

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" /> Sua evolução
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Suas últimas {dadosDoGrafico.length} respostas. Quanto mais alto, melhor.
          </p>
        </div>

        <div
          role="img"
          aria-label={`Gráfico com as suas últimas ${dadosDoGrafico.length} respostas: fadiga, sono, dor muscular, estresse e humor, de 1 a 5. A lista abaixo resume a mudança desde a resposta anterior.`}
          className="h-56"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dadosDoGrafico} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', background: 'hsl(var(--card))' }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {ITENS_CHECKIN.map((item) => (
                <Line
                  key={item}
                  type="monotone"
                  dataKey={item}
                  name={ROTULOS_ITEM[item].curto}
                  stroke={ESTILO[item].cor}
                  strokeDasharray={ESTILO[item].traco}
                  strokeWidth={2}
                  dot={{ r: 2.5 }}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-bold text-foreground">
            Desde a sua resposta de {dataCurta(anterior.semana)}
          </h3>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {ITENS_CHECKIN.map((item) => {
              const v = variacaoDoItem(item, ultima, anterior);
              if (!v) return null;
              return (
                <li key={item} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  <IconeVariacao sentido={v.sentido} />
                  <span className="font-medium text-foreground">{ROTULOS_ITEM[item].curto}:</span>
                  <span className="text-muted-foreground">{textoDaVariacao(v)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
