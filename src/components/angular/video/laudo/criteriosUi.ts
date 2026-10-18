import { limiteDoCriterio } from '@/lib/angular/movimento/frases';
import { novoCriterio } from '@/lib/angular/movimento/criterios';
import { achadoDoCatalogo, achadosAvaliaveis, medidaDo } from '@/lib/angular/movimento/protocolos';
import type { ChaveAchado, CriterioProfissional, GrandezaDoAchado, Lado, OperadorCriterio, Protocolo } from '@/lib/angular/movimento/tipos';

/*
 * Funções puras do editor de critérios do profissional: quais medidas podem receber um critério no protocolo, o que cada achado
 * compara, o rótulo sugerido e a leitura do valor digitado. O app nunca sugere um limite: o critério nasce sem valor e desligado.
 */

/** O que o critério compara, em texto para o profissional (a grandeza natural do achado). */
export const GRANDEZA_TEXTO: Record<GrandezaDoAchado, string> = {
  diferenca_entre_lados: 'a diferença entre os lados (módulo da diferença entre a média D e a média E)',
  media_por_lado: 'a média entre as repetições, em cada lado',
  media: 'a média entre as repetições',
  modulo_da_media: 'o módulo da média entre as repetições',
  desvio_padrao: 'o desvio-padrão entre as repetições',
  tendencia: 'a mudança da primeira para a última repetição (última − primeira, com sinal)',
};

const GRANDEZA_CURTA: Record<GrandezaDoAchado, string> = {
  diferenca_entre_lados: 'diferença entre os lados',
  media_por_lado: 'média',
  media: 'média',
  modulo_da_media: 'módulo da média',
  desvio_padrao: 'desvio-padrão',
  tendencia: 'mudança da primeira para a última',
};

export const OPERADORES: { valor: OperadorCriterio; rotulo: string }[] = [
  { valor: '<=', rotulo: 'menor ou igual a (≤)' },
  { valor: '<', rotulo: 'menor que (<)' },
  { valor: '>=', rotulo: 'maior ou igual a (≥)' },
  { valor: '>', rotulo: 'maior que (>)' },
];

export interface OpcaoMetrica {
  /** `chave::metrica`: identifica a opção no seletor. */
  valor: string;
  chave: ChaveAchado;
  metrica: string;
  /** Título do achado do catálogo (grupo do seletor). */
  grupo: string;
  nome: string;
  unidade: string;
  grandeza: GrandezaDoAchado;
  porLado: boolean;
}

export const valorDaOpcao = (chave: string, metrica: string): string => `${chave}::${metrica}`;

/** Medidas que podem receber critério no protocolo: as dos achados avaliáveis no plano filmado (as mesmas que `criterioValidoNoProtocolo` aceita). */
export function opcoesDoProtocolo(p: Protocolo): OpcaoMetrica[] {
  const opcoes: OpcaoMetrica[] = [];
  for (const ap of achadosAvaliaveis(p)) {
    const cat = achadoDoCatalogo(ap.chave);
    for (const id of ap.medidas) {
      const def = medidaDo(p, id);
      if (!def) continue;
      opcoes.push({ valor: valorDaOpcao(ap.chave, id), chave: ap.chave, metrica: id, grupo: cat.titulo, nome: def.nome, unidade: def.unidade, grandeza: cat.grandeza, porLado: def.porLado });
    }
  }
  return opcoes;
}

/** O seletor de lado só faz sentido quando o achado é calculado por lado (e a medida tem os dois lados). */
export const aceitaLado = (o: Pick<OpcaoMetrica, 'grandeza' | 'porLado'>): boolean =>
  o.porLado && (o.grandeza === 'media_por_lado' || o.grandeza === 'tendencia');

let contador = 0;
export const novoIdDeCriterio = (): string => `crit-${Date.now().toString(36)}-${(contador++).toString(36)}`;

/** Critério novo: desligado, sem valor (NaN) e sem rótulo. Quem escolhe valor, rótulo e responsável é o profissional. */
export function criterioVazio(o: OpcaoMetrica, definidoPor: string): CriterioProfissional {
  return novoCriterio({ id: novoIdDeCriterio(), chave: o.chave, metrica: o.metrica, operador: '<=', valor: Number.NaN, unidade: o.unidade, rotulo: '', definidoPor });
}

/** Rótulo sugerido, por exemplo "Flexão máxima do joelho: diferença entre os lados ≤ 5,0°". */
export function rotuloAutomatico(c: Pick<CriterioProfissional, 'operador' | 'valor' | 'unidade' | 'lado'>, o: Pick<OpcaoMetrica, 'nome' | 'grandeza'>): string {
  const lado = c.lado ? ` (${c.lado === 'D' ? 'lado direito' : 'lado esquerdo'})` : '';
  return `${o.nome}: ${GRANDEZA_CURTA[o.grandeza]}${lado} ${limiteDoCriterio(c)}`;
}

/** Texto digitado → número. Aceita vírgula ou ponto e sinal; vazio ou lixo volta null (sem valor presumido). */
export function lerValorDigitado(texto: string): number | null {
  const t = texto.trim();
  if (!/^[+-]?\d+([.,]\d*)?$/.test(t)) return null;
  const n = Number.parseFloat(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export const valorParaCampo = (v: number): string => (Number.isFinite(v) ? String(v).replace('.', ',') : '');

export const ladoDoSeletor = (v: string): Lado | undefined => (v === 'D' || v === 'E' ? v : undefined);
