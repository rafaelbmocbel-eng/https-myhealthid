// Códigos pré-preenchidos do Faturamento do Controle CASSI: o que o profissional escolheu para já vir marcado na guia nova.
// A escolha mora DENTRO de cassi_config.codigos, em cada código (campo opcional `pre_preenchido`), então não há migração:
//   { quantidade: n } = já vem marcado com n; null = escolheu que não vem; campo ausente em todos = nunca escolheu (modelo padrão).
// Este arquivo só tem funções puras: ler a escolha da configuração e montar a lista de códigos para gravar.
import {
  MODELO_DA_GUIA, limiteDoCodigo, quantidadeParaMarcar, type CodigoFaturavel, type LinhaDoModelo,
} from '@/lib/cassiFaturamento';

/** Os códigos que já vêm marcados, na ordem em que aparecem no topo da guia. */
export type EscolhaDoModelo = Array<{ codigo: string; quantidade: number }>;

/** A escolha não pode ser gravada porque o profissional ainda não salvou as Configurações CASSI (nunca se cria a configuração escondido). */
export class ConfiguracaoNaoSalva extends Error {
  constructor() {
    super('Salve primeiro as Configurações CASSI.');
  }
}

const temEscolha = (c: CodigoFaturavel) => c.pre_preenchido !== undefined;
const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

// Código repetido em Configurações vale uma vez só (o primeiro, como no cálculo); código em branco não conta.
function unicos(codigos: ReadonlyArray<CodigoFaturavel> | null | undefined): CodigoFaturavel[] {
  const lista = (codigos ?? []).filter((c) => ehObjeto(c) && typeof c.codigo === 'string' && c.codigo.trim() !== '');
  return lista.filter((c, i) => lista.findIndex((x) => x.codigo === c.codigo) === i);
}

/** Maior quantidade que cabe numa guia nova do código: o limite por guia ou, no 131, o do mês. */
export function limiteDaQuantidadePreenchida(codigo: string): number {
  const { porGuia, porMes } = limiteDoCodigo(codigo);
  return Math.min(porGuia ?? 999, porMes ?? 999);
}

// Quantidade guardada que não presta (texto, zero, negativa) vira a do padrão do código; acima do limite, o limite.
function quantidadeValida(codigo: string, guardada: unknown): number {
  const n = Math.floor(typeof guardada === 'number' ? guardada : Number(guardada));
  const q = Number.isFinite(n) && n >= 1 ? n : quantidadeParaMarcar(codigo);
  return Math.min(q, limiteDaQuantidadePreenchida(codigo));
}

/**
 * Modelo da guia nova a partir da configuração. Ninguém com a escolha gravada: vale o modelo padrão (144 × 1, 012 × 10 e 160 × 10
 * marcados). Com a escolha em algum código: valem os marcados, na ordem em que estão na lista, e depois os demais, desmarcados.
 * Código que não está na lista de códigos fica de fora; quantidade inválida ou acima do limite é corrigida.
 */
export function modeloDaConfiguracao(codigos: ReadonlyArray<CodigoFaturavel> | null | undefined): LinhaDoModelo[] {
  const lista = unicos(codigos);
  if (!lista.some(temEscolha)) {
    return MODELO_DA_GUIA.filter((m) => lista.some((c) => c.codigo === m.codigo)).map((m) => ({ ...m }));
  }
  const marcados: LinhaDoModelo[] = [];
  const desmarcados: LinhaDoModelo[] = [];
  for (const c of lista) {
    if (ehObjeto(c.pre_preenchido)) {
      marcados.push({ codigo: c.codigo, quantidade: quantidadeValida(c.codigo, c.pre_preenchido.quantidade), marcado: true });
    } else {
      desmarcados.push({ codigo: c.codigo, quantidade: quantidadeParaMarcar(c.codigo), marcado: false });
    }
  }
  return [...marcados, ...desmarcados];
}

/** Só os marcados do modelo, como a tela de escolha trabalha. */
export function escolhaDoModelo(modelo: readonly LinhaDoModelo[]): EscolhaDoModelo {
  return modelo.filter((m) => m.marcado).map((m) => ({ codigo: m.codigo, quantidade: m.quantidade }));
}

export function escolhasIguais(a: EscolhaDoModelo, b: EscolhaDoModelo): boolean {
  return a.length === b.length && a.every((x, i) => x.codigo === b[i].codigo && x.quantidade === b[i].quantidade);
}

/** A escolha é exatamente o modelo padrão (mesmos códigos, quantidades e ordem). */
export function escolhaIgualAoPadrao(escolha: EscolhaDoModelo): boolean {
  return escolhasIguais(escolha, escolhaDoModelo(MODELO_DA_GUIA));
}

const semEscolha = (item: unknown): unknown => {
  if (!ehObjeto(item)) return item;
  const { pre_preenchido: _tirar, ...resto } = item;
  return resto;
};

/**
 * Lista de códigos para gravar em cassi_config.codigos a partir da escolha. Parte do que está no banco (`doBanco`) e só mexe no
 * campo `pre_preenchido`: valor, descrição e código oficial ficam como estão. Marcados primeiro, na ordem escolhida, com
 * { quantidade }; depois os demais, na ordem atual, com null. Marcado que ainda não estava na lista (código da tabela que nunca foi
 * salvo em Configurações) entra com os dados do `catalogo`. Escolha igual ao padrão, ou null, tira o campo de todos: volta a valer
 * o modelo padrão.
 */
export function codigosParaSalvar(doBanco: unknown, escolha: EscolhaDoModelo | null, catalogo: ReadonlyArray<CodigoFaturavel>): unknown[] {
  const atuais: unknown[] = Array.isArray(doBanco) ? doBanco : [];
  if (escolha === null || escolhaIgualAoPadrao(escolha)) return atuais.map(semEscolha);

  const dadosDoCatalogo = (c: CodigoFaturavel) => ({ codigo: c.codigo, descricao: c.descricao, valor: c.valor, codigo_oficial: c.codigo_oficial ?? '' });
  const usados = new Set<number>();
  const marcados: unknown[] = [];
  for (const { codigo, quantidade } of escolha) {
    const pre_preenchido = { quantidade: quantidadeValida(codigo, quantidade) };
    const i = atuais.findIndex((c, k) => !usados.has(k) && ehObjeto(c) && c.codigo === codigo);
    if (i >= 0) {
      usados.add(i);
      marcados.push({ ...(atuais[i] as Record<string, unknown>), pre_preenchido });
      continue;
    }
    const daTabela = catalogo.find((c) => c.codigo === codigo);
    if (daTabela) marcados.push({ ...dadosDoCatalogo(daTabela), pre_preenchido });
  }
  const demais = atuais
    .filter((_, k) => !usados.has(k))
    .map((c) => (ehObjeto(c) && typeof c.codigo === 'string' ? { ...c, pre_preenchido: null } : c));
  const resultado = [...marcados, ...demais];
  // Lista sem nenhum código para carregar a escolha ("nenhum marcado" num banco vazio): sem isto ela se perderia e voltaria o padrão.
  if (!resultado.some((c) => ehObjeto(c) && c.pre_preenchido !== undefined)) {
    return catalogo.map((c) => ({ ...dadosDoCatalogo(c), pre_preenchido: null }));
  }
  return resultado;
}
