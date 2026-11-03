import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, ArrowDown, ArrowUp, HeartPulse, Minus } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import {
  DIMENSAO_MYID_DO_ITEM, ESCALA_URINA, ITENS_CHECKIN, QUEDA_ALERTA, ROTULOS_ITEM, TAMANHO_BASELINE,
  calcularAlertas, calcularBaseline, classeUrina, dataCurta, indiceBemEstar, rotuloPsr,
  sentidoDaVariacao, variacaoDoItem,
  type Baseline, type ChaveComparavel, type ClasseUrina, type ItemCheckin, type LinhaCheckin,
  type NivelItem, type Variacao,
} from '@/lib/checkinSemanal';

// Visão do PROFISSIONAL do check-in semanal (autorrelato do cliente). Não altera a nota do MyID:
// mostra como o cliente se sente entre um MyID e o seguinte.

type Origem = 'portal' | 'whatsapp';
interface LinhaSerie extends LinhaCheckin { origem: Origem }
interface Resultado { indisponivel: boolean; serie: LinhaSerie[]; total: number }
interface ErroBanco { code?: string; message?: string }

// Os tipos gerados do Supabase ainda não conhecem checkins_semanais.
interface ConsultaCheckins extends PromiseLike<{ data: unknown; error: ErroBanco | null; count?: number | null }> {
  select(colunas: string, opcoes?: { count: 'exact' }): ConsultaCheckins;
  eq(coluna: string, valor: string): ConsultaCheckins;
  order(coluna: string, opcoes: { ascending: boolean }): ConsultaCheckins;
  limit(quantas: number): ConsultaCheckins;
}
const bancoSemTipos = supabase as unknown as { from: (tabela: string) => ConsultaCheckins };

const COLUNAS = 'semana, origem, fadiga, sono, dor_muscular, estresse, humor, urina, psr';
const LIMITE_RESPOSTAS = 52;
// O banco calcula a linha de base e o alerta com as primeiras respostas de TODA a história, não só as mais recentes.
const PRIMEIRAS_RESPOSTAS = TAMANHO_BASELINE;
const SEMANAS_NO_GRAFICO = 12;
const ORIGEM_ROTULO: Record<Origem, string> = { whatsapp: 'WhatsApp', portal: 'portal' };
const MSG_VAZIO = 'Nenhum check-in ainda. O cliente responde pelo portal e, se você ligar em WhatsApp > Automações, também pelo WhatsApp.';
const DIMENSAO_NOME: Record<string, string> = { R: 'regulação', D: 'dor', HID: 'hidratação' };

const COR_ITEM: Record<ItemCheckin, { cor: string; traco: string | undefined }> = {
  fadiga: { cor: '#dc2626', traco: undefined },
  sono: { cor: '#2563eb', traco: '6 3' },
  dor_muscular: { cor: '#d97706', traco: '2 3' },
  estresse: { cor: '#7c3aed', traco: '8 3 2 3' },
  humor: { cor: '#059669', traco: '1 4' },
};

function tabelaAusente(erro: ErroBanco): boolean {
  if (erro.code === '42P01' || erro.code === 'PGRST205') return true;
  const msg = (erro.message || '').toLowerCase();
  return msg.includes('does not exist') || msg.includes('schema cache');
}

function numero(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

function normalizar(linhas: unknown): LinhaSerie[] {
  if (!Array.isArray(linhas)) return [];
  const saida: LinhaSerie[] = [];
  for (const l of linhas) {
    const itens = ITENS_CHECKIN.map((item) => numero(l?.[item]));
    if (typeof l?.semana !== 'string' || itens.some((v) => v === null)) continue;
    saida.push({
      semana: l.semana.slice(0, 10),
      origem: l.origem === 'whatsapp' ? 'whatsapp' : 'portal',
      fadiga: itens[0] as number,
      sono: itens[1] as number,
      dor_muscular: itens[2] as number,
      estresse: itens[3] as number,
      humor: itens[4] as number,
      urina: numero(l.urina),
      psr: numero(l.psr),
    });
  }
  return saida.sort((a, b) => a.semana.localeCompare(b.semana));
}

function semanaDe(linha: unknown): string {
  const semana = (linha as { semana?: unknown } | null)?.semana;
  return typeof semana === 'string' ? semana.slice(0, 10) : '';
}

/** Junta as listas sem repetir a semana (a mesma resposta pode estar nas primeiras e nas mais recentes). */
function unirPorSemana(...listas: unknown[]): unknown[] {
  const porSemana = new Map<string, unknown>();
  for (const lista of listas) {
    if (!Array.isArray(lista)) continue;
    for (const linha of lista) porSemana.set(semanaDe(linha), linha);
  }
  return [...porSemana.values()];
}

function listaEmPortugues(nomes: string[]): string {
  if (nomes.length <= 1) return nomes.join('');
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

function umaCasa(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

const COR_SENTIDO: Record<Variacao['sentido'], string> = {
  melhorou: 'text-emerald-700 dark:text-emerald-400',
  piorou: 'text-red-700 dark:text-red-400',
  igual: 'text-muted-foreground',
};

// A seta mostra o movimento do número; "melhorou/piorou" vai em texto porque na urina subir é PIOR.
function SetaVariacao({ chave, variacao, comSentido = false }: { chave: string; variacao: Variacao | null; comSentido?: boolean }) {
  if (!variacao) return null;
  const { delta, sentido } = variacao;
  let Icone = Minus;
  let texto = 'igual';
  if (delta > 0) {
    Icone = ArrowUp;
    texto = `subiu ${delta}`;
  } else if (delta < 0) {
    Icone = ArrowDown;
    texto = `caiu ${Math.abs(delta)}`;
  }
  return (
    <span
      data-testid={`variacao-${chave}`}
      data-sentido={sentido}
      title={sentido === 'igual' ? 'Igual à resposta anterior' : `${sentido === 'melhorou' ? 'Melhorou' : 'Piorou'} desde a resposta anterior`}
      className={cn('inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap', COR_SENTIDO[sentido])}
    >
      <Icone className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{texto}</span>
      {sentido !== 'igual' && (
        <span className={comSentido ? '' : 'sr-only'}>{comSentido ? `(${sentido === 'melhorou' ? 'melhor' : 'pior'})` : `, ${sentido}`}</span>
      )}
    </span>
  );
}

const CLASSE_URINA: Record<ClasseUrina, { texto: string; cls: string }> = {
  boa: { texto: 'hidratação boa', cls: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' },
  atencao: { texto: 'atenção', cls: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200' },
  desidratacao: { texto: 'sinal de pouca água', cls: 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200' },
};

function Grafico({ serie, modo, altura }: { serie: LinhaSerie[]; modo: 'itens' | 'indice'; altura: number }) {
  const dados = serie.slice(-SEMANAS_NO_GRAFICO).map((l) => ({
    x: dataCurta(l.semana),
    fadiga: l.fadiga, sono: l.sono, dor_muscular: l.dor_muscular, estresse: l.estresse, humor: l.humor,
    indice: indiceBemEstar(l),
  }));
  const margem = { top: 6, right: 8, left: -22, bottom: 0 };
  return (
    <div
      role="img"
      aria-label={modo === 'itens'
        ? 'Gráfico de linhas dos cinco itens do check-in nas últimas semanas, de 1 a 5. Os valores da última resposta estão listados acima.'
        : 'Gráfico de linha do índice de bem-estar nas últimas semanas, de 5 a 25. O valor da última resposta está indicado acima.'}
    >
      <ResponsiveContainer width="100%" height={altura}>
        <LineChart data={dados} margin={margem}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} vertical={false} />
          <XAxis dataKey="x" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={52}
            domain={modo === 'itens' ? [1, 5] : [5, 25]}
            ticks={modo === 'itens' ? [1, 2, 3, 4, 5] : [5, 10, 15, 20, 25]}
            allowDecimals={false}
          />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} labelFormatter={(l) => `Semana de ${l}`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {modo === 'itens' &&
            ITENS_CHECKIN.map((item) => (
              <Line
                key={item} type="monotone" dataKey={item} name={ROTULOS_ITEM[item].curto}
                stroke={COR_ITEM[item].cor} strokeDasharray={COR_ITEM[item].traco} strokeWidth={2}
                dot={{ r: 3, fill: COR_ITEM[item].cor, strokeWidth: 0 }} activeDot={{ r: 5 }}
              />
            ))}
          {modo === 'indice' && (
            <Line
              type="monotone" dataKey="indice" name="Índice de bem-estar" stroke="#0d9488" strokeWidth={2}
              dot={{ r: 3, fill: '#0d9488', strokeWidth: 0 }} activeDot={{ r: 5 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChipUrina({ nivel, variacao }: { nivel: number; variacao: Variacao | null }) {
  const cor = ESCALA_URINA.find((e) => e.nivel === nivel);
  const classe = CLASSE_URINA[classeUrina(nivel)];
  return (
    <div data-testid="chip-urina" className={cn('inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border px-3 py-1.5 text-xs', classe.cls)}>
      <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded-full border border-black/25" style={{ backgroundColor: cor?.cor }} />
      <span>Urina {nivel} de 8{cor ? `: ${cor.descricao}` : ''}</span>
      <span className="font-semibold">· {classe.texto}</span>
      <SetaVariacao chave="urina" variacao={variacao} comSentido />
    </div>
  );
}

function ChipPsr({ nivel, variacao }: { nivel: number; variacao: Variacao | null }) {
  return (
    <div data-testid="chip-psr" className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-border/60 bg-muted/40 px-3 py-1.5 text-xs">
      <span>Recuperação do treino {nivel} de 10: {rotuloPsr(nivel)}</span>
      <SetaVariacao chave="psr" variacao={variacao} />
    </div>
  );
}

function LinhaItem({ item, atual, anterior, baseline }: {
  item: ItemCheckin; atual: LinhaSerie; anterior: LinhaSerie | null; baseline: Baseline | null;
}) {
  const valor = atual[item];
  const nivel = ROTULOS_ITEM[item].niveis[valor as NivelItem];
  return (
    <li data-testid={`item-${item}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/40 py-2 last:border-0">
      <span className="w-28 shrink-0 text-xs font-semibold">{ROTULOS_ITEM[item].curto}</span>
      <span className="whitespace-nowrap">
        <span className="text-sm font-bold tabular-nums">{valor}</span>
        <span className="text-xs text-muted-foreground"> de 5</span>
      </span>
      <span className="min-w-[8rem] flex-1 text-xs text-muted-foreground">{nivel}</span>
      <SetaVariacao chave={item} variacao={variacaoDoItem(item, atual, anterior)} />
      {baseline && (
        <span className="whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">(média inicial {umaCasa(baseline[item])})</span>
      )}
    </li>
  );
}

export default function CheckinSemanalCard({ pacienteId, variante }: { pacienteId: string; variante: 'avaliacao' | 'evolucao' }) {
  const [modoGrafico, setModoGrafico] = useState<'itens' | 'indice'>('itens');

  const { data, isLoading, isError } = useQuery<Resultado>({
    queryKey: ['checkin-semanal-profissional', pacienteId],
    enabled: !!pacienteId,
    queryFn: async () => {
      const doCliente = () => bancoSemTipos.from('checkins_semanais');
      // As mais recentes primeiro para o limite cortar as semanas antigas, não as novas; as primeiras vêm à parte, para a linha de base.
      const [recentes, primeiras] = await Promise.all([
        doCliente().select(COLUNAS, { count: 'exact' }).eq('paciente_id', pacienteId).order('semana', { ascending: false }).limit(LIMITE_RESPOSTAS),
        doCliente().select(COLUNAS).eq('paciente_id', pacienteId).order('semana', { ascending: true }).limit(PRIMEIRAS_RESPOSTAS),
      ]);
      for (const { error } of [recentes, primeiras]) {
        if (!error) continue;
        if (tabelaAusente(error)) return { indisponivel: true, serie: [], total: 0 };
        throw error;
      }
      const buscadas = unirPorSemana(primeiras.data, recentes.data);
      const serie = normalizar(buscadas);
      const foraDaBusca = Math.max(0, (recentes.count ?? 0) - buscadas.length);
      return { indisponivel: false, serie, total: serie.length + foraDaBusca };
    },
  });

  const serie = useMemo(() => data?.serie ?? [], [data]);
  const total = data?.total ?? serie.length;
  const alertas = useMemo(() => calcularAlertas(serie), [serie]);
  const baseline = useMemo(() => calcularBaseline(serie), [serie]);
  const dimensoes = useMemo(() => {
    const vistas: string[] = [];
    Object.values(DIMENSAO_MYID_DO_ITEM).forEach((d) => {
      if (d && !vistas.includes(d)) vistas.push(d);
    });
    return vistas;
  }, []);

  if (data?.indisponivel) return null;

  const cabecalho = (
    <CardTitle className="flex items-center gap-2 text-base">
      <HeartPulse className="icon-sm shrink-0 text-teal-600" aria-hidden="true" />
      Check-in semanal
    </CardTitle>
  );

  if (isLoading) {
    return (
      <Card className="border-border/40 shadow-xs" data-testid="checkin-carregando">
        <CardHeader className="pb-3">{cabecalho}</CardHeader>
        <CardContent>
          <div role="status" aria-label="Carregando o check-in semanal" className="space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-border/40 shadow-xs">
        <CardHeader className="pb-3">{cabecalho}</CardHeader>
        <CardContent>
          <p role="alert" className="py-2 text-sm text-muted-foreground">Não foi possível carregar o check-in semanal agora. Tente novamente em instantes.</p>
        </CardContent>
      </Card>
    );
  }

  if (serie.length === 0) {
    return (
      <Card className="border-border/40 shadow-xs">
        <CardHeader className="pb-3">
          {cabecalho}
          <p className="text-xs text-muted-foreground">Autorrelato do cliente</p>
        </CardHeader>
        <CardContent>
          <p className="py-3 text-center text-sm text-muted-foreground">{MSG_VAZIO}</p>
        </CardContent>
      </Card>
    );
  }

  const atual = serie[serie.length - 1];
  const anterior = serie.length > 1 ? serie[serie.length - 2] : null;
  const indiceAtual = indiceBemEstar(atual);
  let variacaoIndice: Variacao | null = null;
  if (anterior) {
    const delta = indiceAtual - indiceBemEstar(anterior);
    variacaoIndice = { delta, sentido: sentidoDaVariacao(delta) };
  }
  const nomesAlerta = alertas.map((a) => ROTULOS_ITEM[a].curto.toLowerCase());
  const comparavel = (chave: ChaveComparavel) => variacaoDoItem(chave, atual, anterior);
  const altura = variante === 'evolucao' ? 260 : 180;

  return (
    <Card className="border-border/40 shadow-xs" data-testid="checkin-semanal-card" data-variante={variante}>
      <CardHeader className="pb-3">
        {cabecalho}
        <p className="text-xs text-muted-foreground">Autorrelato do cliente</p>
        <p className="text-xs text-muted-foreground" data-testid="ultima-resposta">
          Última resposta: semana de {dataCurta(atual.semana)} · {ORIGEM_ROTULO[atual.origem]}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {alertas.length > 0 && (
          <div
            role="status"
            data-testid="faixa-atencao"
            className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              <strong>Atenção:</strong> {listaEmPortugues(nomesAlerta)} {alertas.length === 1 ? 'ficou' : 'ficaram'}{' '}
              {QUEDA_ALERTA} {QUEDA_ALERTA === 1 ? 'ponto' : 'pontos'} ou mais abaixo da própria média inicial do cliente por 2 semanas seguidas.
              Vale conversar com o cliente e rever o MyID.
            </p>
          </div>
        )}

        <ul aria-label="Última resposta por item" className="rounded-xl border border-border/40 px-3">
          {ITENS_CHECKIN.map((item) => (
            <LinhaItem key={item} item={item} atual={atual} anterior={anterior} baseline={baseline} />
          ))}
        </ul>

        {(atual.urina !== null || atual.psr !== null) && (
          <div className="flex flex-wrap gap-2">
            {atual.urina !== null && <ChipUrina nivel={atual.urina} variacao={comparavel('urina')} />}
            {atual.psr !== null && <ChipPsr nivel={atual.psr} variacao={comparavel('psr')} />}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" data-testid="indice-bem-estar">
          <p>
            <span className="font-semibold">Índice de bem-estar:</span>{' '}
            <span className="font-bold tabular-nums">{indiceAtual}</span>{' '}
            <span className="text-xs text-muted-foreground">de 25 (soma dos 5 itens, de 5 a 25)</span>
          </p>
          <SetaVariacao chave="indice" variacao={variacaoIndice} />
        </div>

        {serie.length >= 2 && (
          <div className="rounded-xl border border-border/40 p-3">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold">Últimas {SEMANAS_NO_GRAFICO} semanas</p>
              <div role="group" aria-label="O que mostrar no gráfico" className="flex gap-1">
                <Button
                  type="button" size="sm" variant={modoGrafico === 'itens' ? 'default' : 'outline'}
                  className="h-10 px-3 text-xs" aria-pressed={modoGrafico === 'itens'}
                  onClick={() => setModoGrafico('itens')}
                >
                  Cinco itens
                </Button>
                <Button
                  type="button" size="sm" variant={modoGrafico === 'indice' ? 'default' : 'outline'}
                  className="h-10 px-3 text-xs" aria-pressed={modoGrafico === 'indice'}
                  onClick={() => setModoGrafico('indice')}
                >
                  Índice de bem-estar
                </Button>
              </div>
            </div>
            <Grafico serie={serie} modo={modoGrafico} altura={altura} />
          </div>
        )}

        <div className="space-y-1 text-[11px] text-muted-foreground">
          <p>
            Conversa com as dimensões {listaEmPortugues(dimensoes.map((d) => `${d} (${DIMENSAO_NOME[d] ?? d})`))} do MyID.
          </p>
          <p>
            Nos itens de 1 a 5, quanto maior, melhor. Na cor da urina, quanto maior o número, mais escura.
            {anterior ? ` Setas: comparação com a resposta da semana de ${dataCurta(anterior.semana)}.` : ''}
          </p>
          <p>
            {total} {total === 1 ? 'resposta registrada' : 'respostas registradas'}.
            O check-in não altera a nota do MyID e não substitui a avaliação do profissional.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
