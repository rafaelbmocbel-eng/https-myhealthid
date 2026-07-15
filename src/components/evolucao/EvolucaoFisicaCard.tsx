import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';

interface Props { pacienteId: string; }

// Evolução física: devolve como GRÁFICO o que o app já coleta — peso, % gordura,
// massa muscular, pressão arterial, testes funcionais e adesão ao treino.
// Mesmo componente nos dois lados (terapeuta e portal do paciente); a RLS
// entrega a cada um só o que pode ver.

const dt = (s: string) => {
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

function Delta({ primeiro, ultimo, unidade }: { primeiro: number; ultimo: number; unidade: string }) {
  const diff = ultimo - primeiro;
  if (Math.abs(diff) < 0.05) return <span className="text-[11px] text-muted-foreground">estável</span>;
  return (
    <span className="text-[11px] text-muted-foreground tabular-nums">
      {primeiro.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} → {ultimo.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} {unidade}
      {' '}({diff > 0 ? '+' : ''}{diff.toLocaleString('pt-BR', { maximumFractionDigits: 1 })})
    </span>
  );
}

function MiniLinha({ dados, dataKey, cor, unidade, titulo }: {
  dados: { x: string; [k: string]: string | number }[];
  dataKey: string; cor: string; unidade: string; titulo: string;
}) {
  if (dados.length < 2) return null;
  const vals = dados.map(d => Number(d[dataKey]));
  return (
    <div className="rounded-xl border border-border/40 p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-xs font-semibold text-foreground">{titulo}</p>
        <Delta primeiro={vals[0]} ultimo={vals[vals.length - 1]} unidade={unidade} />
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={dados} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} vertical={false} />
          <XAxis dataKey="x" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={52}
            domain={['auto', 'auto']} />
          <Tooltip formatter={(v: number) => [`${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${unidade}`, titulo]}
            labelFormatter={(l) => `Data: ${l}`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Line type="monotone" dataKey={dataKey} stroke={cor} strokeWidth={2}
            dot={{ r: 3, fill: cor, strokeWidth: 0 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function EvolucaoFisicaCard({ pacienteId }: Props) {
  const [testeSel, setTesteSel] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['evolucao-fisica', pacienteId],
    queryFn: async () => {
      const sb = supabase as any;
      const [antro, comp, testes, vitais, exec] = await Promise.all([
        sb.from('antropometria').select('data_medicao, peso_kg, imc, gordura_pct')
          .eq('paciente_id', pacienteId).order('data_medicao', { ascending: true }).limit(60),
        sb.from('body_composition').select('date, weight_kg, body_fat_pct, muscle_mass_kg')
          .eq('paciente_id', pacienteId).order('date', { ascending: true }).limit(60),
        sb.from('testes_funcionais_paciente').select('tipo_teste, resultado, unidade, data_teste')
          .eq('paciente_id', pacienteId).order('data_teste', { ascending: true }).limit(120),
        sb.from('sinais_vitais').select('created_at, pa_sistolica, pa_diastolica')
          .eq('paciente_id', pacienteId).order('created_at', { ascending: true }).limit(60),
        sb.from('studio_execucoes').select('data_execucao')
          .eq('paciente_id', pacienteId)
          .gte('data_execucao', new Date(Date.now() - 8 * 7 * 86400000).toISOString())
          .order('data_execucao', { ascending: true }).limit(500),
      ]);
      return {
        antro: antro.data || [], comp: comp.data || [], testes: testes.data || [],
        vitais: vitais.data || [], exec: exec.data || [],
      };
    },
  });

  const series = useMemo(() => {
    if (!data) return null;
    // Peso e % gordura: antropometria + bioimpedância na MESMA linha do tempo
    const pesoMap = new Map<string, number>();
    data.antro.forEach((a: any) => { if (a.peso_kg) pesoMap.set(a.data_medicao, Number(a.peso_kg)); });
    data.comp.forEach((c: any) => { if (c.weight_kg && !pesoMap.has(c.date)) pesoMap.set(c.date, Number(c.weight_kg)); });
    const peso = [...pesoMap.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([d, v]) => ({ x: dt(d), v }));

    const gorduraMap = new Map<string, number>();
    data.antro.forEach((a: any) => { if (a.gordura_pct) gorduraMap.set(a.data_medicao, Number(a.gordura_pct)); });
    data.comp.forEach((c: any) => { if (c.body_fat_pct && !gorduraMap.has(c.date)) gorduraMap.set(c.date, Number(c.body_fat_pct)); });
    const gordura = [...gorduraMap.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([d, v]) => ({ x: dt(d), v }));

    const musculo = data.comp.filter((c: any) => c.muscle_mass_kg)
      .map((c: any) => ({ x: dt(c.date), v: Number(c.muscle_mass_kg) }));

    const pa = data.vitais.filter((v: any) => v.pa_sistolica && v.pa_diastolica)
      .map((v: any) => ({ x: dt(v.created_at), sis: Number(v.pa_sistolica), dia: Number(v.pa_diastolica) }));

    // Testes funcionais agrupados por tipo
    const tiposTeste = new Map<string, { x: string; v: number; unidade: string }[]>();
    data.testes.forEach((t: any) => {
      const v = Number(t.resultado);
      if (Number.isNaN(v)) return;
      const arr = tiposTeste.get(t.tipo_teste) || [];
      arr.push({ x: dt(t.data_teste), v, unidade: t.unidade || '' });
      tiposTeste.set(t.tipo_teste, arr);
    });
    for (const [k, arr] of tiposTeste) if (arr.length < 2) tiposTeste.delete(k);

    // Adesão: execuções por semana (últimas 8)
    const semanas: { x: string; v: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const ini = new Date(Date.now() - (i + 1) * 7 * 86400000);
      const fim = new Date(Date.now() - i * 7 * 86400000);
      const n = data.exec.filter((e: any) => {
        const d = new Date(e.data_execucao);
        return d >= ini && d < fim;
      }).length;
      semanas.push({ x: dt(fim.toISOString()), v: n });
    }
    const temExec = semanas.some(s => s.v > 0);

    return { peso, gordura, musculo, pa, tiposTeste, semanas, temExec };
  }, [data]);

  if (isLoading || !series) return null;

  const nadaParaMostrar =
    series.peso.length < 2 && series.gordura.length < 2 && series.musculo.length < 2 &&
    series.pa.length < 2 && series.tiposTeste.size === 0 && !series.temExec;

  const tipos = [...series.tiposTeste.keys()];
  const testeAtivo = testeSel && series.tiposTeste.has(testeSel) ? testeSel : tipos[0] || null;
  const dadosTeste = testeAtivo ? series.tiposTeste.get(testeAtivo)! : [];

  return (
    <Card className="border-border/40 shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="icon-sm text-primary shrink-0" />
          Evolução física
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {nadaParaMostrar ? (
          <p className="text-sm text-muted-foreground py-3 text-center">
            Ainda não há medidas repetidas. A partir da segunda medição (peso, bioimpedância,
            testes funcionais ou pressão), os gráficos de evolução aparecem aqui.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <MiniLinha dados={series.peso} dataKey="v" cor="#2563eb" unidade="kg" titulo="Peso" />
              <MiniLinha dados={series.gordura} dataKey="v" cor="#d97706" unidade="%" titulo="Gordura corporal" />
              <MiniLinha dados={series.musculo} dataKey="v" cor="#059669" unidade="kg" titulo="Massa muscular" />

              {series.pa.length >= 2 && (
                <div className="rounded-xl border border-border/40 p-3">
                  <p className="text-xs font-semibold text-foreground mb-1">Pressão arterial (mmHg)</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={series.pa} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} vertical={false} />
                      <XAxis dataKey="x" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={52} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} labelFormatter={(l) => `Data: ${l}`} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="sis" name="Sistólica" stroke="#dc2626" strokeWidth={2}
                        dot={{ r: 3, fill: '#dc2626', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="dia" name="Diastólica" stroke="#0284c7" strokeWidth={2}
                        dot={{ r: 3, fill: '#0284c7', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {testeAtivo && (
                <div className="rounded-xl border border-border/40 p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs font-semibold text-foreground shrink-0">Teste funcional</p>
                    {tipos.length > 1 ? (
                      <Select value={testeAtivo} onValueChange={setTesteSel}>
                        <SelectTrigger className="h-7 text-[11px] w-auto max-w-[60%]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {tipos.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-[11px] text-muted-foreground truncate">{testeAtivo}</span>
                    )}
                  </div>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={dadosTeste} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} vertical={false} />
                      <XAxis dataKey="x" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={52} domain={['auto', 'auto']} />
                      <Tooltip formatter={(v: number) => [`${v} ${dadosTeste[0]?.unidade || ''}`, testeAtivo]}
                        labelFormatter={(l) => `Data: ${l}`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Line type="monotone" dataKey="v" stroke="#7c3aed" strokeWidth={2}
                        dot={{ r: 3, fill: '#7c3aed', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {series.temExec && (
                <div className="rounded-xl border border-border/40 p-3">
                  <p className="text-xs font-semibold text-foreground mb-1">Treinos por semana</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={series.semanas} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} vertical={false} />
                      <XAxis dataKey="x" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={52} allowDecimals={false} />
                      <Tooltip formatter={(v: number) => [`${v} treino${v === 1 ? '' : 's'}`, 'Semana']}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="v" fill="#0d9488" radius={[4, 4, 0, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Primeiro → último valor entre parênteses. Os gráficos usam tudo que já foi registrado:
              antropometria, bioimpedância, testes funcionais, sinais vitais e execuções de treino.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
