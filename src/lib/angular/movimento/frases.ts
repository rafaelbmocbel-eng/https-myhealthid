import { AVISO_ESTIMATIVA_VIDEO } from '../analiseVideo/tiposUi';
import { finito, fmt, fmtUn } from './estatistica';
import { ROTULO_LADO } from './vocabulario';
import type { Achado, CriterioProfissional, ExtracaoMedida, FonteBiblio, OperadorCriterio, PlanoCamera, SinalizadorRepeticao, TipoGatilho } from './tipos';

/*
 * Modelos de frase do laudo (agente L). Tudo é função pura ou constante: o texto do laudo é montado por modelo, sem modelo de
 * linguagem, para ser testável. Regras de redação: português do Brasil; descrever e medir, sem julgar o corpo nem o desempenho
 * (ver vocabulario.ts); sem verbo causal; só os caracteres que o PDF imprime (Latin-1 mais ≥ ≤ − – — · → e aspas).
 * "dentro do critério", "no limite" e "fora do critério" só aparecem por ROTULO_SITUACAO, quando há critério do profissional.
 */

// ---------- avisos e rótulos fixos ----------

/** Rótulo das linhas do cabeçalho que carregam o aviso fixo: o PDF as desenha numa caixa à parte. */
export const ROTULO_AVISO = 'Aviso';
export const AVISO_HIPOTESES = 'Hipóteses para confirmação na avaliação presencial';
/** As duas frases fixas que abrem todo laudo, na ordem em que aparecem. */
export const AVISOS_FIXOS: readonly string[] = [`${AVISO_ESTIMATIVA_VIDEO}.`, `${AVISO_HIPOTESES}.`];

export const ROTULO_RESPONSAVEL = 'Responsável pela revisão';

export const TITULO_LAUDO = 'Laudo de apoio à avaliação do movimento';
export const ETIQUETA_BETA = 'beta';

export const TITULOS = {
  resumo: 'Resumo',
  medidas: 'Medidas por repetição e por lado',
  graficos: 'Gráficos: ângulo ao longo do tempo',
  achados: 'Achados',
  indisponiveis: 'Achados não avaliados neste vídeo',
  metodo: 'Método',
  limitacoes: 'Limitações',
  referencias: 'Referências',
  fatores: 'Possíveis fatores contribuintes (hipóteses para confirmação na avaliação presencial)',
  conferir: 'O que conferir na avaliação presencial',
  limitacoesDoAchado: 'Limitações deste achado',
  criterios: 'Critérios do profissional usados',
  gatilhos: 'Regras que disparam um achado',
} as const;

export const TEXTO_SEM_BIBLIOTECA =
  'Não há hipóteses curadas para este achado na biblioteca: sem referência verificada. O achado descreve só a medida; a interpretação cabe ao profissional na avaliação presencial.';

export const TEXTO_SEM_REFERENCIA_VERIFICADA = 'sem referência verificada';

export const TEXTO_SEM_ACHADOS =
  'Nenhum gatilho de achado foi atingido neste vídeo. As medidas continuam na tabela como observação, sem veredito.';

export const TEXTO_SEM_INDISPONIVEIS = 'Todos os achados deste protocolo puderam ser avaliados no plano de câmera filmado.';

export const TEXTO_SEM_CRITERIOS =
  'Nenhum critério do profissional foi usado: os valores são observações medidas, sem referência e sem veredito.';

export const TEXTO_MINIMO_REPETICOES =
  'O mínimo de repetições de cada regra é uma decisão de engenharia para a estatística não oscilar com poucos valores; não é limite clínico. Abaixo dele a regra não é avaliada.';

export const TEXTO_NENHUMA_REPETICAO = 'Nenhuma repetição foi identificada neste vídeo: não há medidas por repetição.';

/** Gatilhos na ordem em que o método os lista. */
export const ORDEM_GATILHOS: readonly TipoGatilho[] = [
  'assimetria_entre_lados', 'variacao_entre_repeticoes', 'tendencia_primeira_ultima', 'repeticao_discrepante', 'criterio_profissional',
];

/** Forma curta do gatilho, para as frases do resumo ("1 por diferença entre os lados"). */
export const GATILHO_CURTO: Record<TipoGatilho, string> = {
  assimetria_entre_lados: 'diferença entre os lados',
  variacao_entre_repeticoes: 'variação entre repetições',
  tendencia_primeira_ultima: 'mudança da primeira para a última repetição',
  repeticao_discrepante: 'repetição discrepante',
  criterio_profissional: 'critério do profissional',
};

export const ROTULO_SINALIZADOR: Record<SinalizadorRepeticao, string> = {
  incompleta: 'incompleta, sem medidas',
  pontos_ausentes: 'pontos ausentes',
  duracao_discrepante: 'duração discrepante',
};

export const TEXTO_EXTRACAO: Record<ExtracaoMedida, string> = {
  valor_no_marco: 'valor no instante do marco',
  maximo: 'maior valor da janela',
  minimo: 'menor valor da janela',
  amplitude: 'amplitude (maior − menor valor) da janela',
  media: 'média da janela',
  duracao: 'tempo entre os dois marcos da janela',
};

export const SIMBOLO_OPERADOR: Record<OperadorCriterio, string> = { '<': '<', '<=': '≤', '>': '>', '>=': '≥' };

// ---------- formatação ----------

const primeiraMaiuscula = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const primeiraMinuscula = (s: string): string => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
export const capitalizar = primeiraMaiuscula;
export const iniciarEmMinuscula = primeiraMinuscula;

/** Casas decimais por unidade: tempos em centésimos de segundo; ângulos e percentuais em décimos. */
export const casasDa = (unidade: string): number => (unidade === 's' ? 2 : 1);

export const numeroComCasas = (n: number | null | undefined, unidade: string): string => fmt(n, casasDa(unidade));

export const valorComUnidade = (n: number | null | undefined, unidade: string): string => fmtUn(n, unidade, casasDa(unidade));

/** Valor com sinal explícito (+ ou −): para diferenças em que o sentido importa. */
export function valorComSinal(n: number | null | undefined, unidade: string): string {
  if (!finito(n)) return '–';
  return n > 0 ? `+${valorComUnidade(n, unidade)}` : valorComUnidade(n, unidade);
}

export const maisOuMenos = (n: number | null | undefined, unidade: string): string => (finito(n) ? `± ${valorComUnidade(n, unidade)}` : '–');

/** AAAA-MM-DD → DD/MM/AAAA; qualquer outro formato volta como veio. */
export function dataBr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** 30 → "30"; 29,97 → "29,97"; 30,5 → "30,5". */
export function fpsTexto(fps: number): string {
  const t = fmt(fps, 2);
  return t.includes(',') ? t.replace(/0+$/, '').replace(/,$/, '') : t;
}

/** "30 quadros por segundo"; taxa ausente ou inválida vira "não informada", sem inventar valor. */
export const taxaEfetivaTexto = (fps: number | null | undefined): string => (finito(fps) && fps > 0 ? `${fpsTexto(fps)} quadros por segundo` : 'não informada');

export const segundosTexto = (s: number | null | undefined): string => `${fmt(s, 1)} s`;

/** [1,2,3,5] → "1 a 3 e 5"; [2,4,6] → "2, 4 e 6"; [1,2] → "1 e 2". Corridas de três ou mais viram intervalo. */
export function listaDeNumeros(numeros: readonly number[]): string {
  const unicos = [...new Set(numeros)].sort((a, b) => a - b);
  const partes: string[] = [];
  let i = 0;
  while (i < unicos.length) {
    let j = i;
    while (j + 1 < unicos.length && unicos[j + 1] === unicos[j] + 1) j++;
    if (j - i >= 2) partes.push(`${unicos[i]} a ${unicos[j]}`);
    else for (let k = i; k <= j; k++) partes.push(String(unicos[k]));
    i = j + 1;
  }
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
}

const comPonto = (t: string): string => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);
export const comPontoFinal = comPonto;

// ---------- fontes ----------

/** Só PMID numérico vira link: o PubMed não abre outra coisa. */
export const urlPubMed = (pmid: string): string | null => (/^\d+$/.test(pmid.trim()) ? `https://pubmed.ncbi.nlm.nih.gov/${pmid.trim()}/` : null);

export const urlDoi = (doi: string | undefined): string | null => {
  const d = (doi ?? '').trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  return d ? `https://doi.org/${d}` : null;
};

/** Linha de identificação da fonte: "PMID 123: https://..." e "DOI 10.x: https://..." (texto e link, para o PDF desenhar os dois). */
export function identificadoresDaFonte(f: FonteBiblio): { rotulo: string; url: string | null }[] {
  const itens: { rotulo: string; url: string | null }[] = [{ rotulo: `PMID ${f.pmid}`, url: urlPubMed(f.pmid) }];
  if (f.doi && f.doi.trim()) itens.push({ rotulo: `DOI ${f.doi.trim()}`, url: urlDoi(f.doi) });
  return itens;
}

/** Texto corrido da fonte, sem os links (a tela e o PDF acrescentam os links). */
export function textoDaFonte(f: FonteBiblio): string {
  return comPonto(f.citacao);
}

export function textoDoTrecho(f: FonteBiblio): string {
  return `Trecho do resumo (em inglês): “${f.trecho.trim()}”`;
}

export const textoPopulacao = (f: FonteBiblio): string | null => (f.populacao && f.populacao.trim() ? `População: ${comPonto(f.populacao)}` : null);

// ---------- cabeçalho ----------

export function fraseRepeticoesCompletas(singular: string, plural: string, completas: number, total: number): string {
  if (total === 0) return 'nenhuma';
  const nome = completas === 1 ? singular : plural;
  if (completas === total) return `${completas} ${nome}`;
  return `${completas} ${nome} completas, de ${total} identificadas`;
}

// ---------- resumo ----------

export function fraseRepeticoesIdentificadas(rot: { singular: string; plural: string }, completas: number, total: number): string {
  if (total === 0) return TEXTO_NENHUMA_REPETICAO;
  const nome = completas === 1 ? rot.singular : rot.plural;
  const base = `Foram analisadas ${completas} ${nome} ${completas === 1 ? 'completa' : 'completas'}`;
  if (total === completas) return `${base}.`;
  const resto = total - completas;
  return `${base} de ${total} identificadas; ${resto} ${resto === 1 ? 'ficou incompleta e sem medidas' : 'ficaram incompletas e sem medidas'}.`;
}

export function fraseAchadosPorGatilho(contagem: Partial<Record<TipoGatilho, number>>): string {
  const total = ORDEM_GATILHOS.reduce((s, g) => s + (contagem[g] ?? 0), 0);
  if (total === 0) return TEXTO_SEM_ACHADOS;
  const partes = ORDEM_GATILHOS.filter((g) => (contagem[g] ?? 0) > 0).map((g) => `${contagem[g]} por ${GATILHO_CURTO[g]}`);
  return `${total} ${total === 1 ? 'achado descrito' : 'achados descritos'}: ${partes.join(', ')}. Cada um descreve uma medida e não é diagnóstico.`;
}

export function fraseCriteriosNoResumo(usados: number): string {
  if (usados === 0) return 'Sem critério do profissional, os achados são observações medidas, sem referência e sem veredito.';
  return `${usados} ${usados === 1 ? 'critério definido' : 'critérios definidos'} pelo profissional ${usados === 1 ? 'foi usado' : 'foram usados'}: o veredito de cada achado vale só para esse critério.`;
}

export function fraseIndisponiveisNoResumo(n: number, planoFilmado: PlanoCamera): string {
  if (n === 0) return '';
  const vista = planoFilmado === 'lateral' ? 'de lado' : 'de frente';
  return `${n} ${n === 1 ? 'achado não foi avaliado' : 'achados não foram avaliados'} porque o vídeo foi gravado ${vista} (ver a seção própria).`;
}

export function valoresPorLadoTexto(v: Achado['valoresPorLado'], unidade: string): string {
  if (!v) return '';
  const partes = (['D', 'E'] as const).filter((l) => finito(v[l])).map((l) => `${l} ${valorComUnidade(v[l], unidade)}`);
  return partes.join(' · ');
}

/** Valor principal do achado: com sinal quando o sentido importa (tendência e repetição discrepante). */
export function valorDoAchadoTexto(a: Pick<Achado, 'valor' | 'unidade' | 'gatilho'>): string {
  const comSinal = a.gatilho === 'tendencia_primeira_ultima' || a.gatilho === 'repeticao_discrepante';
  return comSinal ? valorComSinal(a.valor, a.unidade) : valorComUnidade(a.valor, a.unidade);
}

export function linhaResumoDoAchado(titulo: string, a: Achado, situacao: string): string {
  const lados = valoresPorLadoTexto(a.valoresPorLado, a.unidade);
  return `${titulo}: ${valorDoAchadoTexto(a)}${lados ? ` (${lados})` : ''}; ${situacao}.`;
}

/**
 * Título do achado no laudo: o do catálogo, mais a medida quando o achado vale para várias medidas (a mudança da primeira para a última
 * repetição) e mais o lado quando o achado é de um lado só. O título do critério do profissional já é específico.
 */
export function tituloDoAchado(a: Pick<Achado, 'titulo' | 'gatilho' | 'lado'>, nomeDaMedida: string, marcha: boolean, variasMedidas: boolean): string {
  if (a.gatilho === 'criterio_profissional') return a.titulo;
  const base = variasMedidas ? `${a.titulo}: ${nomeDaMedida}` : a.titulo;
  if (a.gatilho === 'assimetria_entre_lados' || a.lado === null) return base;
  return `${base} (${marcha ? 'pé' : 'lado'} ${ROTULO_LADO[a.lado]})`;
}

// ---------- achados ----------

export function textoMedidaDoAchado(a: Achado, nomeDaMedida: string, porLado: boolean): string {
  const partes = [`Medida: ${nomeDaMedida}.`, `Valor do achado: ${valorDoAchadoTexto(a)}.`];
  if (porLado) {
    const lados = valoresPorLadoTexto(a.valoresPorLado, a.unidade);
    if (lados) partes.push(`Média por lado: ${lados}.`);
  } else if (a.valoresPorLado) {
    // Medida sem par D/E (deslocamento lateral da pelve): o lado diz para onde o valor aponta, não de qual membro ele vem.
    const lado = (['D', 'E'] as const).find((l) => finito(a.valoresPorLado?.[l]));
    if (lado) partes.push(`Média: ${valorComUnidade(Math.abs(a.valoresPorLado[lado] as number), a.unidade)}, para o lado ${ROTULO_LADO[lado]} do paciente.`);
  }
  if (a.equivalenteCm !== undefined) {
    partes.push(a.equivalenteCm === null ? 'Equivalente em cm não calculado: falta a referência em pixels.' : `Equivalente aproximado: ${fmtUn(a.equivalenteCm, 'cm', 1)}, com a escala informada.`);
  }
  partes.push(`Gatilho: ${GATILHO_CURTO[a.gatilho]}.`);
  if (a.veredito) partes.push(`Critério: ${a.veredito.criterio.rotulo}, definido por ${a.veredito.criterio.definidoPor}.`);
  return partes.join(' ');
}

export function textoIncertezaDoAchado(a: Pick<Achado, 'incerteza' | 'unidade' | 'superaIncerteza'>): string {
  if (a.incerteza === null || !finito(a.incerteza)) return 'Incerteza não estimada para esta medida: sem comparação com a incerteza do vídeo.';
  const comparacao = a.superaIncerteza
    ? 'o valor é maior que a incerteza estimada'
    : 'o valor não supera a incerteza estimada e está dentro da incerteza do vídeo';
  return `Incerteza estimada para este valor: ${maisOuMenos(a.incerteza, a.unidade)}; ${comparacao}.`;
}

export function textoRepeticoesDoAchado(
  gatilho: TipoGatilho, numeros: readonly number[], rot: { singular: string; plural: string },
): string {
  const lista = listaDeNumeros(numeros);
  if (numeros.length === 0) return `${capitalizar(rot.plural)} envolvidas: nenhuma com valor.`;
  if (gatilho === 'tendencia_primeira_ultima') return `${capitalizar(rot.plural)} comparadas: a primeira e a última com valor (${lista}).`;
  if (gatilho === 'repeticao_discrepante') return `${capitalizar(rot.singular)} discrepante: ${lista}.`;
  const nome = numeros.length === 1 ? rot.singular : rot.plural;
  return `${capitalizar(nome)} envolvida${numeros.length === 1 ? '' : 's'}: ${lista}.`;
}

// ---------- achados indisponíveis ----------

export function fraseParaAvaliar(titulo: string, planoExigido: PlanoCamera): string {
  return `Para avaliar ${primeiraMinuscula(titulo)}, grave ${planoExigido === 'frontal' ? 'de frente' : 'de lado'}.`;
}

export const INTRO_INDISPONIVEIS =
  'Estes achados dependem de outro plano de câmera: a medida em duas dimensões só vale no plano filmado, então eles não foram calculados.';

// ---------- medidas ----------

export const INTRO_MEDIDAS =
  'Valores lidos na série suavizada de cada articulação, por repetição e por lado. O desvio-padrão é amostral (n − 1) e n é o número de repetições com valor. Medida sem valor aparece como "–".';

export const LEGENDA_RESUMO_MEDIDAS = 'Incerteza de um valor, estimada do próprio vídeo, pela fórmula abaixo.';

export const TEXTO_MEDIDA_SEM_VALOR = '–';

export function legendaDaMedida(fase: string, extracao: ExtracaoMedida, formula: string, avisos: readonly string[]): string {
  const base = `Fase: ${fase}. Extração: ${TEXTO_EXTRACAO[extracao]}. Cálculo: ${comPonto(formula)}`;
  return avisos.length ? `${base} Avisos: ${avisos.map(comPonto).join(' ')}` : base;
}

export function rotuloDaRepeticao(numero: number, ladoDoPe: string | null, sinalizadores: readonly SinalizadorRepeticao[]): string {
  const partes = [String(numero)];
  if (ladoDoPe) partes.push(`pé ${ladoDoPe}`);
  for (const s of sinalizadores) partes.push(ROTULO_SINALIZADOR[s]);
  return partes.join(' · ');
}

// ---------- critérios ----------

export function limiteDoCriterio(c: Pick<CriterioProfissional, 'operador' | 'valor' | 'unidade'>): string {
  return `${SIMBOLO_OPERADOR[c.operador]} ${fmtUn(c.valor, c.unidade, casasDa(c.unidade))}`;
}

export function motivoCriterioNaoAplicado(aplicavel: boolean): string {
  return aplicavel
    ? 'a medida escolhida não pertence a este protocolo ou exige outro plano de câmera'
    : 'falta valor numérico ou a identificação de quem definiu o critério';
}
