/**
 * Histórico imutável para desfazer/refazer. Cada estado guardado é uma referência: como as correções da
 * trilha reaproveitam os quadros que não mudaram, guardar muitos estados custa pouca memória.
 */
export interface Historico<T> {
  readonly passado: readonly T[];
  readonly presente: T;
  readonly futuro: readonly T[];
  readonly limite: number;
}

export const LIMITE_HISTORICO = 200;

export function criarHistorico<T>(inicial: T, limite = LIMITE_HISTORICO): Historico<T> {
  return { passado: [], presente: inicial, futuro: [], limite: Math.max(1, Math.floor(limite)) };
}

/** Passa a ser o estado atual. Um novo estado apaga o "refazer". Estado igual ao atual (mesma referência) é ignorado. */
export function registrar<T>(h: Historico<T>, novo: T): Historico<T> {
  if (Object.is(novo, h.presente)) return h;
  const passado = [...h.passado, h.presente];
  const aparado = passado.length > h.limite ? passado.slice(passado.length - h.limite) : passado;
  return { passado: aparado, presente: novo, futuro: [], limite: h.limite };
}

/** Troca o estado atual sem criar um passo de desfazer: para pré-visualizar um arraste antes de confirmar com `registrar`. */
export function substituirPresente<T>(h: Historico<T>, novo: T): Historico<T> {
  if (Object.is(novo, h.presente)) return h;
  return { ...h, presente: novo };
}

export function desfazer<T>(h: Historico<T>): Historico<T> {
  if (!h.passado.length) return h;
  const passado = h.passado.slice(0, -1);
  return { passado, presente: h.passado[h.passado.length - 1], futuro: [h.presente, ...h.futuro], limite: h.limite };
}

export function refazer<T>(h: Historico<T>): Historico<T> {
  if (!h.futuro.length) return h;
  const [proximo, ...resto] = h.futuro;
  return { passado: [...h.passado, h.presente], presente: proximo, futuro: resto, limite: h.limite };
}

export const podeDesfazer = <T>(h: Historico<T>) => h.passado.length > 0;
export const podeRefazer = <T>(h: Historico<T>) => h.futuro.length > 0;

/** Mantém só o estado atual (por exemplo, depois de carregar outro vídeo). */
export const limparHistorico = <T>(h: Historico<T>): Historico<T> => criarHistorico(h.presente, h.limite);
