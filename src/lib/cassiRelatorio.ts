// Relatório de produção do Controle CASSI (o arquivo entregue à clínica no fim do mês).
// Sai exatamente do que o profissional lançou na aba Faturamento: os clientes da lista do mês, e de cada um as guias com os
// códigos e as quantidades. Os totais usam a mesma conta do fechamento do mês (fecharMesPorLancamentos), então o PDF bate
// com os cartões da tela.
import { brutoDosLancamentos, ordenarParaLancamento, type CodigoFaturavel } from '@/lib/cassiFaturamento';
import { fecharMesPorLancamentos, type ClienteParaFechar, type ConfigFinanceira } from '@/lib/cassiFinanceiro';

export interface ColunaRelatorio {
  codigo: string;
  /** Código oficial como está na configuração (ex.: 50000012); sem ele, o código curto. */
  oficial: string;
  label: 'Avaliação' | 'Código';
}

/** Uma guia lançada: `q[i]` é a quantidade do código da coluna `i`. */
export interface LinhaRelatorio {
  nome: string;
  q: number[];
  soma: number;
}

export interface RelatorioDoMes {
  colunas: ColunaRelatorio[];
  /** Uma linha por guia lançada, por cliente em ordem alfabética; cliente com 2 guias no mês ocupa 2 linhas. */
  linhas: LinhaRelatorio[];
  clientes: number;
  guias: number;
  totBruto: number;
  impostoPct: number;
  totImposto: number;
  totLiquido: number;
  minhaPct: number;
  suaParte: number;
}

export type ConfigDoRelatorio = ConfigFinanceira & { codigos: CodigoFaturavel[] };

export function relatorioDosLancamentos(entrada: { clientes: ClienteParaFechar[]; cfg: ConfigDoRelatorio | undefined }): RelatorioDoMes {
  const { clientes, cfg } = entrada;
  const catalogo = ordenarParaLancamento(cfg?.codigos ?? []);
  const valorDe = (c: string) => catalogo.find((x) => x.codigo === c)?.valor || 0;

  // Só entra guia com alguma quantidade lançada.
  const guiasDe = (c: ClienteParaFechar) => c.guias.filter((g) => Object.values(g).some((q) => q > 0));
  const ordenados = clientes
    .filter((c) => guiasDe(c).length > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  // Colunas: os códigos usados, na ordem do lançamento (a consulta 144 primeiro); código que não está mais na configuração
  // aparece no fim, para a quantidade lançada não sumir do relatório.
  const usados = new Set<string>();
  for (const c of ordenados) for (const g of guiasDe(c)) for (const [codigo, q] of Object.entries(g)) if (q > 0) usados.add(codigo);
  const doCatalogo = catalogo.filter((c) => usados.has(c.codigo));
  const foraDoCatalogo = [...usados].filter((c) => !catalogo.some((x) => x.codigo === c)).sort();
  const colunas: ColunaRelatorio[] = [
    ...doCatalogo.map((c) => ({ codigo: c.codigo, oficial: c.codigo_oficial || c.codigo })),
    ...foraDoCatalogo.map((codigo) => ({ codigo, oficial: codigo })),
  ].map((c) => ({ ...c, label: c.codigo === '144' ? ('Avaliação' as const) : ('Código' as const) }));

  const linhas: LinhaRelatorio[] = ordenados.flatMap((c) => guiasDe(c).map((g) => ({
    nome: c.nome,
    q: colunas.map((col) => Number(g[col.codigo]) || 0),
    soma: brutoDosLancamentos([g], valorDe),
  })));

  const fechamento = fecharMesPorLancamentos({ clientes: ordenados, cfg });
  return {
    colunas,
    linhas,
    clientes: ordenados.length,
    guias: linhas.length,
    totBruto: fechamento.totBruto,
    impostoPct: fechamento.impostoPct,
    totImposto: fechamento.totImposto,
    totLiquido: fechamento.totLiquido,
    minhaPct: fechamento.minhaPct,
    suaParte: fechamento.suaParte,
  };
}
