import { MAX_LACUNA_S } from '../video/correcao';
import { fmt } from './estatistica';
import { FRACAO_MINIMA_VALIDOS, VIZINHANCA_EXTREMO_S } from './medidasPorRepeticao';
import type { ExtracaoMedida } from './tipos';

/*
 * Frases dos pontos perdidos: o que faltou, onde e o que o profissional pode fazer. Texto de produto compartilhado pelo motor (motivo de
 * cada entrada), pelo laudo, pelo PDF e pela tela. Português do Brasil, sem as palavras de julgamento de vocabulario.ts e só com
 * caracteres que o PDF imprime. O rigor não muda: a medida sem pontos suficientes continua sem valor, e nada é preenchido no lugar.
 */

/** 70%, na forma que o texto usa. */
export const PORCENTAGEM_MINIMA = Math.round(FRACAO_MINIMA_VALIDOS * 100);

const MEIA_VIZINHANCA_TEXTO = fmt(VIZINHANCA_EXTREMO_S, 2);

export const TITULO_PONTOS_PERDIDOS = 'Medidas não calculadas por pontos perdidos';
export const TITULO_PONTOS_A_CONFERIR = 'Pontos a conferir';

/** A regra, em uma frase, exatamente como o motor a aplica (medidasPorRepeticao.ts). */
export const TEXTO_REGRA_PONTOS_PERDIDOS =
  `Máximo, mínimo, amplitude e valor num marco só são calculados se a série bruta, sem interpolação, tem ponto confiável do corpo em pelo menos ${PORCENTAGEM_MINIMA}% ` +
  `dos quadros de ±${MEIA_VIZINHANCA_TEXTO} s em torno do instante do extremo; as medidas que percorrem uma fase também pedem pelo menos ${PORCENTAGEM_MINIMA}% dos quadros da fase com valor.`;

/** Parágrafo do método do laudo sobre a regra e o que o profissional pode fazer quando ela não é cumprida. */
export const TEXTO_METODO_PONTOS_PERDIDOS =
  `Pontos perdidos: ${TEXTO_REGRA_PONTOS_PERDIDOS} Quando a regra não é cumprida, a repetição fica sem valor naquele lado e nada é preenchido ou estimado no lugar: ` +
  `a medida entra na seção "${TITULO_PONTOS_PERDIDOS}" (quando houver) e a tela do profissional mostra onde faltou ponto. O profissional pode corrigir os pontos à mão, ` +
  'nos quadros-chave; o ponto corrigido vale como ponto e a análise é refeita.';

export const TEXTO_INTRO_PONTOS_PERDIDOS_NO_LAUDO =
  'Nestas medidas faltou ponto confiável do corpo na janela em que a medida é lida. O valor não foi calculado e não entra nas médias, no desvio-padrão, ' +
  'nas comparações nem nos achados; nada foi preenchido ou estimado no lugar. Enquanto os pontos não forem corrigidos à mão pelo profissional, estas medidas ficam de fora do laudo.';

export const TEXTO_SEM_PONTOS_PERDIDOS = 'Nenhuma medida ficou sem valor por pontos perdidos.';

export const TEXTO_COMO_CORRIGIR =
  'Toque em "Ir ao quadro" e arraste o ponto destacado até a articulação no vídeo: a análise se refaz sozinha.';

/** Segunda frase do "o que fazer": vale quando o ponto falta em vários quadros seguidos. */
export const TEXTO_VARIOS_QUADROS =
  'Se o ponto faltar em vários quadros, corrija também o primeiro e o último sem ponto: entre dois quadros-chave a posição é interpolada e fica marcada como corrigida à mão. ' +
  `A interpolação vale até ${fmt(MAX_LACUNA_S, 1)} s entre eles; em trechos mais longos, corrija também quadros no meio.`;

export const TEXTO_INTRO_PONTOS_A_CONFERIR =
  'Nestes trechos faltou ponto confiável do corpo. A medida ficou sem valor e nada foi preenchido no lugar.';

export const fraseMedidasSemValor = (n: number): string =>
  `${n} ${n === 1 ? 'medida não foi calculada' : 'medidas não foram calculadas'} por pontos perdidos (ver a seção "${TITULO_PONTOS_PERDIDOS}").`;

/** "joelho esquerdo", "joelho esquerdo e tornozelo esquerdo", "a, b e c". */
export function listaDeRotulos(rotulos: readonly string[]): string {
  const baixos = rotulos.map((r) => (r ? r.charAt(0).toLowerCase() + r.slice(1) : r));
  if (baixos.length <= 1) return baixos.join('');
  return `${baixos.slice(0, -1).join(', ')} e ${baixos[baixos.length - 1]}`;
}

/** Faixas de quadros (índices 0-based) em números de quadro como o profissional lê (1-based): "118 a 121, 125". */
export function faixasEmTexto(faixas: readonly (readonly [number, number])[], limite = 4): string {
  const partes = faixas.map(([de, ate]) => (de === ate ? String(de + 1) : `${de + 1} a ${ate + 1}`));
  if (partes.length <= limite) return partes.join(', ');
  const resto = partes.length - limite;
  return `${partes.slice(0, limite).join(', ')} e mais ${resto} ${resto === 1 ? 'faixa' : 'faixas'}`;
}

export const segundosEmTexto = (t: number): string => `${fmt(t, 2)} s`;

/** Em que instante a medida é lida, para a frase do motivo. */
export function instanteDaLeitura(extracao: ExtracaoMedida, nomeDaFase: string, daReferencia: boolean): string {
  if (daReferencia) return 'início da repetição, que dá a referência da medida';
  switch (extracao) {
    case 'maximo': return 'instante do valor máximo';
    case 'minimo': return 'instante do valor mínimo';
    case 'amplitude': return 'instante do extremo';
    default: return `instante da fase "${nomeDaFase}"`;
  }
}

interface DadosDoMotivo {
  regra: 'extremo' | 'fase';
  rotulosDosPontos: readonly string[];
  quadrosSemMedida: number;
  quadrosNaJanela: number;
  quadrosMinimos: number;
  inicioT: number;
  fimT: number;
  extremoT: number;
  instante: string;
  nomeDaFase: string;
}

/** O que faltou, onde e por que a medida não foi calculada. */
export function motivoDoPontoPerdido(d: DadosDoMotivo): string {
  const pontos = listaDeRotulos(d.rotulosDosPontos);
  const contagem = `${d.quadrosSemMedida} de ${d.quadrosNaJanela} quadros ficaram sem medida porque faltou ponto confiável de ${pontos}`;
  if (d.regra === 'extremo') {
    return `Em torno do ${d.instante} (${segundosEmTexto(d.extremoT)}), ${contagem}. ` +
      `A medida pede ponto em pelo menos ${PORCENTAGEM_MINIMA}% dos quadros dessa janela (${d.quadrosMinimos} de ${d.quadrosNaJanela}); nada foi preenchido no lugar.`;
  }
  return `Na fase "${d.nomeDaFase}" (de ${segundosEmTexto(d.inicioT)} a ${segundosEmTexto(d.fimT)}), ${contagem}. ` +
    `A medida lê a fase inteira e pede ponto em pelo menos ${PORCENTAGEM_MINIMA}% dos quadros dela; nada foi preenchido no lugar.`;
}
