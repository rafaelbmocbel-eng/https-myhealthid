import { cmPorPixel, rotacaoDoNivel, type Ponto, type Vista } from './medidas';
import type { AnaliseFoto, OpcoesAnalise } from './analise';

/** Medidas de nível e escala já viram `giro` e `cmPorPx`; copiar os pontos delas faria o painel recalcular com o tipo errado. */
const REFERENCIAS_RESOLVIDAS = ['nivel', 'escala'] as const;

export function pontosSemReferencias(pontos: Record<string, Ponto[]>): Record<string, Ponto[]> {
  return Object.fromEntries(Object.entries(pontos).filter(([id]) => !(REFERENCIAS_RESOLVIDAS as readonly string[]).includes(id)));
}

/** Pontos sem as medidas que o usuário escondeu (somem do desenho, da tabela e da arte). */
export function pontosSemOcultas(pontos: Record<string, Ponto[]>, ocultas: ReadonlySet<string>): Record<string, Ponto[]> {
  return ocultas.size === 0 ? pontos : Object.fromEntries(Object.entries(pontos).filter(([id]) => !ocultas.has(id)));
}

const lerNumero = (s: string): number | null => {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

export interface EntradaReferencias {
  pontos: Record<string, Ponto[]>;
  nivelTipo: 'horizontal' | 'vertical';
  /** Comprimento do objeto da escala, em cm, como digitado. */
  escalaCm: string;
  /** Giro vindo de fora (sensor do celular ao fotografar ou da análise de origem). */
  giroBase: number | null;
  cmPorPxBase: number | null;
}

/** Giro (nível) e centímetros por pixel de uma foto: a referência marcada nela vale mais que a de origem. */
export function referenciasDaFoto(e: EntradaReferencias): { giro: number | null; cmPorPx: number | null } {
  const nivel = e.pontos.nivel;
  const giroMarcado = nivel && nivel.length >= 2 ? rotacaoDoNivel(nivel[0], nivel[1], e.nivelTipo) : null;
  const escala = e.pontos.escala, cm = lerNumero(e.escalaCm);
  const cmMarcado = escala && escala.length >= 2 && cm ? cmPorPixel(escala[0], escala[1], cm) : null;
  return { giro: giroMarcado ?? e.giroBase, cmPorPx: cmMarcado ?? e.cmPorPxBase };
}

export interface EntradaAnalise extends EntradaReferencias {
  vista: Vista;
  foto: { w: number; h: number; img: HTMLImageElement } | null;
  opcoes: OpcoesAnalise;
  ocultas?: ReadonlySet<string>;
}

/** Análise de uma das duas fotos, no formato que a tela, o PDF e a arte usam. */
export function analiseDoPainel(e: EntradaAnalise): AnaliseFoto {
  const { giro, cmPorPx } = referenciasDaFoto(e);
  return {
    vista: e.vista, largura: e.foto?.w ?? 0, altura: e.foto?.h ?? 0, imagem: e.foto?.img ?? null,
    pontos: e.ocultas ? pontosSemOcultas(e.pontos, e.ocultas) : e.pontos, giro, cmPorPx, opcoes: e.opcoes,
  };
}
