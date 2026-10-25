import { TABELA_PERDAS } from './lossTable';

// Mesma regra do cálculo (calculator.ts): 3 pontos por sinal de alerta ativo, no máximo 15.
export const PONTOS_POR_SINAL_DE_ALERTA = 3;
export const MAXIMO_PONTOS_SINAIS_DE_ALERTA = 15;
const SINAIS_DE_ALERTA = ['weight_loss', 'fever', 'night_pain', 'incontinence', 'progressive', 'neuropathy'] as const;

export interface ItemPerda {
  chave: string;
  perda: number;
  pesoMax: number;
  /** Quanto da perda máxima possível da própria dimensão já foi gasta (0 a 100). */
  pctDoMaximo: number;
  pctDoTotal: number;
  pctAcumulado: number;
}

export interface AnalisePerdas {
  /** Só as dimensões que tiraram pontos, da maior perda para a menor. */
  itens: ItemPerda[];
  totalDimensoes: number;
  /** null quando o resultado não traz o detalhe dos sinais de alerta. */
  sinaisDeAlerta: { ativos: number; pontos: number } | null;
  /** O que sobra depois das dimensões e dos sinais de alerta (medicação e ajustes). null se não dá para separar. */
  medicacaoEAjustes: number | null;
  /** Quando os sinais de alerta não vêm detalhados: tudo que não é dimensão, junto. */
  outrosSemDetalhe: number;
  totalPerdas: number;
  /** Nota que o fechamento da conta produz: 100 menos as perdas, entre 0 e 100. */
  scoreFechado: number;
  /** As perdas passaram de 100: a nota para em 0 e o excedente não aparece nela. */
  limitadoEmZero: boolean;
  /** O total veio gravado no resultado (e não só da soma das dimensões). */
  totalGravado: boolean;
  /** Teto aritmético: a nota se as maiores perdas fossem zeradas. Não é meta clínica. */
  teto: { chaves: string[]; ganho: number; score: number } | null;
}

const arredonda = (n: number) => Math.round(n * 100) / 100;
const limita = (n: number) => Math.max(0, Math.min(100, n));
const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function contaSinaisDeAlerta(detalhes: unknown): number | null {
  if (!detalhes || typeof detalhes !== 'object') return null;
  const d = detalhes as Record<string, unknown>;
  if (!SINAIS_DE_ALERTA.some((k) => k in d)) return null;
  return SINAIS_DE_ALERTA.filter((k) => d[k] === true).length;
}

/**
 * Lê um resultado de MyID gravado (resultado_processado / myid_analysis) e fecha a conta das perdas:
 * dimensões + sinais de alerta + medicação = total, e 100 − total = nota. Devolve null se o resultado não
 * traz as perdas por dimensão (registros antigos).
 */
export function analisarPerdas(resultado: unknown, maiores = 3): AnalisePerdas | null {
  if (!resultado || typeof resultado !== 'object') return null;
  const r = resultado as Record<string, any>;
  const perdas = r.perdas_calculadas;
  if (!perdas || typeof perdas !== 'object') return null;

  const dimensoes = Object.entries(perdas as Record<string, any>)
    .filter(([chave]) => chave !== 'MED')
    .map(([chave, p]) => ({ chave, perda: numero(p?.perda_pontos) ?? 0 }));
  if (dimensoes.length === 0) return null;

  const totalDimensoes = arredonda(dimensoes.reduce((s, d) => s + d.perda, 0));
  const ativos = contaSinaisDeAlerta(r.red_flags_details ?? r.red_flags);
  const pontosSinais = ativos === null ? null : Math.min(ativos * PONTOS_POR_SINAL_DE_ALERTA, MAXIMO_PONTOS_SINAIS_DE_ALERTA);

  const gravado = numero(r.myid_100?.total_perdas) ?? numero(r.total_perdas);
  const totalGravado = gravado !== null;
  const totalPerdas = arredonda(totalGravado ? gravado : totalDimensoes + (pontosSinais ?? 0));

  const sobra = arredonda(totalPerdas - totalDimensoes);
  const medicacaoEAjustes = pontosSinais === null ? null : arredonda(sobra - pontosSinais);

  const ordenadas = dimensoes.filter((d) => d.perda > 0).sort((a, b) => b.perda - a.perda);
  let acumulado = 0;
  const itens: ItemPerda[] = ordenadas.map((d) => {
    acumulado += d.perda;
    const pesoMax = TABELA_PERDAS[d.chave]?.peso_maximo ?? d.perda;
    return {
      chave: d.chave,
      perda: arredonda(d.perda),
      pesoMax,
      pctDoMaximo: Math.min(100, (d.perda / pesoMax) * 100),
      pctDoTotal: totalPerdas > 0 ? (d.perda / totalPerdas) * 100 : 0,
      pctAcumulado: totalPerdas > 0 ? (acumulado / totalPerdas) * 100 : 0,
    };
  });

  const principais = itens.slice(0, maiores);
  const ganho = arredonda(principais.reduce((s, i) => s + i.perda, 0));
  const teto = principais.length === 0
    ? null
    : { chaves: principais.map((i) => i.chave), ganho, score: arredonda(limita(100 - (totalPerdas - ganho))) };

  return {
    itens,
    totalDimensoes,
    sinaisDeAlerta: ativos === null ? null : { ativos, pontos: pontosSinais ?? 0 },
    medicacaoEAjustes,
    outrosSemDetalhe: pontosSinais === null ? sobra : 0,
    totalPerdas,
    scoreFechado: arredonda(limita(100 - totalPerdas)),
    limitadoEmZero: 100 - totalPerdas < 0,
    totalGravado,
    teto,
  };
}
