/*
 * Formatos e margens da arte para redes sociais. Tudo em "pixels de arte": a largura é sempre 1080 e
 * as demais medidas (margens, fontes, raios) valem para ela; o compositor escala o canvas inteiro
 * por um fator único, então prévia e arquivo final saem iguais.
 */

export type FormatoSocial = 'story' | 'feed' | 'quadrado';
export type LayoutArte = 'unica' | 'empilhada' | 'lado_a_lado';
export type TituloModo = 'vertical' | 'horizontal' | 'nenhum';

export interface Retangulo { x: number; y: number; w: number; h: number }

export interface InfoFormato {
  id: FormatoSocial;
  nome: string;
  proporcao: string;
  largura: number;
  altura: number;
}

export const LARGURA_SOCIAL = 1080;

export const FORMATOS: Record<FormatoSocial, InfoFormato> = {
  story: { id: 'story', nome: 'Story / Reels', proporcao: '9:16', largura: LARGURA_SOCIAL, altura: 1920 },
  feed: { id: 'feed', nome: 'Feed retrato', proporcao: '4:5', largura: LARGURA_SOCIAL, altura: 1350 },
  quadrado: { id: 'quadrado', nome: 'Quadrado', proporcao: '1:1', largura: LARGURA_SOCIAL, altura: 1080 },
};

export const ORDEM_FORMATOS: FormatoSocial[] = ['story', 'feed', 'quadrado'];

export const NOMES_LAYOUT: Record<LayoutArte, string> = {
  unica: 'Uma foto',
  empilhada: 'Empilhada',
  lado_a_lado: 'Lado a lado',
};

/** Layouts que fazem sentido para a quantidade de fotos recebida. */
export function layoutsDisponiveis(nPaineis: number): LayoutArte[] {
  return nPaineis >= 2 ? ['empilhada', 'lado_a_lado'] : ['unica'];
}

/** Layout de partida: duas fotos empilhadas no story (como nas artes de antes e depois), lado a lado nos demais. */
export function layoutSugerido(formato: FormatoSocial, nPaineis: number): LayoutArte {
  if (nPaineis < 2) return 'unica';
  return formato === 'story' ? 'empilhada' : 'lado_a_lado';
}

/** Layout efetivo: com menos de duas fotos, qualquer layout vira "unica". */
export function layoutEfetivo(layout: LayoutArte, nPaineis: number): LayoutArte {
  return nPaineis >= 2 ? (layout === 'unica' ? 'empilhada' : layout) : 'unica';
}

/** Título vertical combina com a coluna lateral do story; lado a lado pede o título no topo. */
export function tituloModoSugerido(layout: LayoutArte): TituloModo {
  return layout === 'lado_a_lado' ? 'horizontal' : 'vertical';
}

export interface MargensArte {
  /** Limites de texto e selos (título, rótulos, legenda, perfis). */
  texto: { topo: number; base: number; esq: number; dir: number };
  /** Limites das fotos; `base` vale quando não há rodapé. */
  fotos: { topo: number; base: number; esq: number; dir: number };
}

/** Fração da altura do story que a interface do Instagram cobre: barra de progresso e perfil em cima; caixa de resposta e legenda embaixo. */
export const COBERTURA_STORY = { topo: 0.14, base: 0.2 } as const;

/**
 * Faixa vertical (em pixels de arte) onde um texto que não pode ser coberto fica: no story, entre as faixas da interface do
 * Instagram (independe de `margensStories`: um aviso não pode sumir); nos outros formatos, dentro das margens do texto.
 */
export function zonaSeguraDoTexto(formato: FormatoSocial): { topo: number; base: number } {
  const H = FORMATOS[formato].altura;
  if (formato === 'story') return { topo: Math.round(H * COBERTURA_STORY.topo), base: Math.round(H * (1 - COBERTURA_STORY.base)) };
  const m = margensDoFormato(formato, false).texto;
  return { topo: m.topo, base: H - m.base };
}

/**
 * No story e no Reels a interface do Instagram cobre uma faixa no topo (barra de progresso e perfil) e
 * uma maior embaixo (caixa de resposta e legenda). Com `margensStories` o texto fica fora dessas faixas;
 * as fotos podem chegar um pouco mais perto do topo, onde só a borda é coberta.
 */
export function margensDoFormato(formato: FormatoSocial, margensStories: boolean): MargensArte {
  if (formato === 'story' && margensStories) {
    return {
      texto: { topo: 250, base: 340, esq: 54, dir: 54 },
      fotos: { topo: 170, base: 230, esq: 54, dir: 54 },
    };
  }
  const m = formato === 'story' ? 56 : 48;
  return { texto: { topo: m, base: m, esq: m, dir: m }, fotos: { topo: m, base: m, esq: m, dir: m } };
}
