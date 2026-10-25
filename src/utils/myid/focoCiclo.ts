// Foco do ciclo: o profissional escolhe de 1 a 3 dimensões do MyID para trabalhar e, no reteste, compara os pontos
// perdidos de cada uma com os do MyID em que o ciclo começou. Tudo aqui é aritmética sobre resultados gravados.
export const DIMENSOES_MYID = ['D', 'EFI', 'P', 'I', 'R', 'C', 'N', 'AF', 'HID', 'NUT', 'ERG'] as const;
export const MAXIMO_DIMENSOES_FOCO = 3;

/** Variação de pelo menos isto (em pontos) numa dimensão FORA do foco é avisada. */
export const LIMIAR_AVISO_FORA_DO_FOCO = 1;
const LIMIAR_IGUAL = 0.05;

export type ResultadoToggle =
  | { ok: true; dimensoes: string[] }
  | { ok: false; motivo: 'limite' | 'dimensao_invalida'; dimensoes: string[] };

/** Liga ou desliga uma dimensão do foco, respeitando o limite de 3 e as 11 dimensões válidas. */
export function alternarDimensaoDoFoco(atuais: readonly string[], chave: string): ResultadoToggle {
  const lista = [...atuais];
  if (!(DIMENSOES_MYID as readonly string[]).includes(chave)) return { ok: false, motivo: 'dimensao_invalida', dimensoes: lista };
  if (lista.includes(chave)) return { ok: true, dimensoes: lista.filter((d) => d !== chave) };
  if (lista.length >= MAXIMO_DIMENSOES_FOCO) return { ok: false, motivo: 'limite', dimensoes: lista };
  return { ok: true, dimensoes: [...lista, chave] };
}

export interface LinhaFoco {
  chave: string;
  /** Pontos perdidos no MyID-base do ciclo. */
  antes: number;
  /** Pontos perdidos no MyID atual. */
  agora: number;
  /** agora − antes: negativo = perdeu menos pontos = melhorou. */
  variacao: number;
  sentido: 'melhorou' | 'piorou' | 'igual';
}

export interface ComparacaoFoco {
  linhas: LinhaFoco[];
  /** Dimensões do foco que não existem num dos dois resultados (registro antigo): ficam de fora das linhas. */
  semDado: string[];
  scoreAntes: number | null;
  scoreAgora: number | null;
  /** Dimensões FORA do foco que perderam pelo menos LIMIAR_AVISO_FORA_DO_FOCO pontos a mais. */
  pioraramForaDoFoco: Array<{ chave: string; variacao: number }>;
}

const arredonda = (n: number) => Math.round(n * 100) / 100;
const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function perdasDe(resultado: unknown): Record<string, number> | null {
  if (!resultado || typeof resultado !== 'object') return null;
  const p = (resultado as Record<string, any>).perdas_calculadas;
  if (!p || typeof p !== 'object') return null;
  const saida: Record<string, number> = {};
  for (const [chave, v] of Object.entries(p as Record<string, any>)) {
    const n = numero(v?.perda_pontos);
    if (n !== null) saida[chave] = n;
  }
  return Object.keys(saida).length > 0 ? saida : null;
}

function scoreDe(resultado: unknown): number | null {
  if (!resultado || typeof resultado !== 'object') return null;
  const r = resultado as Record<string, any>;
  return numero(r.MyID_score) ?? numero(r.myid_100?.pontuacao_final);
}

/**
 * Compara o resultado atual com o do MyID-base do ciclo. Devolve null quando algum dos dois não traz as perdas por
 * dimensão (registros antigos) ou quando o foco está vazio.
 */
export function compararFoco(base: unknown, atual: unknown, foco: readonly string[]): ComparacaoFoco | null {
  const antes = perdasDe(base);
  const agora = perdasDe(atual);
  if (!antes || !agora || foco.length === 0) return null;

  const linhas: LinhaFoco[] = [];
  const semDado: string[] = [];
  for (const chave of foco) {
    if (!(chave in antes) || !(chave in agora)) { semDado.push(chave); continue; }
    const variacao = arredonda(agora[chave] - antes[chave]);
    linhas.push({
      chave,
      antes: arredonda(antes[chave]),
      agora: arredonda(agora[chave]),
      variacao,
      sentido: Math.abs(variacao) < LIMIAR_IGUAL ? 'igual' : variacao < 0 ? 'melhorou' : 'piorou',
    });
  }

  const pioraramForaDoFoco = Object.keys(agora)
    .filter((chave) => chave !== 'MED' && !foco.includes(chave) && chave in antes)
    .map((chave) => ({ chave, variacao: arredonda(agora[chave] - antes[chave]) }))
    .filter((d) => d.variacao >= LIMIAR_AVISO_FORA_DO_FOCO)
    .sort((a, b) => b.variacao - a.variacao);

  return { linhas, semDado, scoreAntes: scoreDe(base), scoreAgora: scoreDe(atual), pioraramForaDoFoco };
}
