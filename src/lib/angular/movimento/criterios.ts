import { protocoloDo } from './protocolos';
import type { CriterioProfissional, IdProtocolo, Protocolo, SituacaoCriterio } from './tipos';

/*
 * Critérios do profissional (gatilho e). Ficam fora de analisarMovimento porque a mesma regra do "no limite" precisa valer na
 * tela (pré-visualização do critério), na análise e no laudo, e um desvio entre elas mudaria o veredito de um mesmo número.
 */

/** Cria um critério SEMPRE desligado. Quem ativa é o profissional, depois de conferir valor e responsável. */
export const novoCriterio = (base: Omit<CriterioProfissional, 'ativo'>): CriterioProfissional => ({ ...base, ativo: false });

/** Só critério ligado, com limite numérico e responsável identificado gera veredito. */
export const criterioAplicavel = (c: CriterioProfissional): boolean =>
  c.ativo && Number.isFinite(c.valor) && c.definidoPor.trim().length > 0;

/**
 * O critério mira uma medida que a chave realmente usa no protocolo? Sem isso o veredito colaria em outro achado, cujas
 * hipóteses falam de outro fenômeno.
 */
export function criterioValidoNoProtocolo(c: CriterioProfissional, protocolo: Protocolo | IdProtocolo): boolean {
  const p = typeof protocolo === 'string' ? protocoloDo(protocolo) : protocolo;
  const achado = p.achados.find((a) => a.chave === c.chave);
  return !!achado && achado.planoExigido === p.planoFilmado && achado.medidas.includes(c.metrica);
}

/**
 * Situação de um valor diante do critério, levando em conta a incerteza do vídeo (u; null conta como 0).
 * O intervalo [valor − u, valor + u] decide: todo ele cumpre o critério = dentro do critério; nenhum ponto cumpre = fora do
 * critério; o limite cai dentro do intervalo = no limite. Sem valor, 'sem_referencia'.
 */
export function avaliarCriterio(valor: number | null, incerteza: number | null, c: Pick<CriterioProfissional, 'operador' | 'valor'>): SituacaoCriterio {
  if (valor === null || !Number.isFinite(valor) || !Number.isFinite(c.valor)) return 'sem_referencia';
  const u = incerteza !== null && Number.isFinite(incerteza) && incerteza > 0 ? incerteza : 0;
  const lo = valor - u, hi = valor + u, limite = c.valor;
  switch (c.operador) {
    case '>=':
      if (lo >= limite) return 'dentro_do_criterio';
      return hi < limite ? 'fora_do_criterio' : 'no_limite';
    case '>':
      if (lo > limite) return 'dentro_do_criterio';
      return hi <= limite ? 'fora_do_criterio' : 'no_limite';
    case '<=':
      if (hi <= limite) return 'dentro_do_criterio';
      return lo > limite ? 'fora_do_criterio' : 'no_limite';
    default:
      if (hi < limite) return 'dentro_do_criterio';
      return lo >= limite ? 'fora_do_criterio' : 'no_limite';
  }
}
