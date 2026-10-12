import { COR_CENTRO, COR_LADO, type MarcacaoAnguloUi, type PontoPx, type PontosDoQuadro, type LigacaoUi } from '@/lib/angular/analiseVideo/tiposUi';
import { itemPonto, itemReta, itensDoAngulo, ordenarCamadas, separarRotulos, type ContextoDesenho, type ItemDesenho } from '@/lib/angular/desenho';
import { calcularAnguloNoQuadro, pontosDaDefinicao, definicaoPrecisaDeDirecao, type DefinicaoAngulo } from '@/lib/angular/video/angulos';
import { NOMES_PONTOS, ladoDe, type Lado, type QuadroPose } from '@/lib/angular/video/tipos';
import { estimarDirecao, pontoDoQuadro } from '@/lib/angular/video/trilha';
import type { TrilhaPose } from '@/lib/angular/video/tipos';

/*
 * Do ângulo da trilha ao desenho do quadro: para cada definição de ângulo, os pontos de que ela depende no quadro
 * (vértice, braços e a referência tracejada) já em pixels do vídeo. O que se mostra no arco é o mesmo valor do gráfico:
 * flexão, dorsiflexão e inclinações aparecem como o ângulo entre o segmento e a sua referência (a continuação do
 * segmento anterior, a posição neutra, a vertical ou a horizontal).
 */

const dist = (a: PontoPx, b: PontoPx) => Math.hypot(a.x - b.x, a.y - b.y);
const soma = (a: PontoPx, b: PontoPx): PontoPx => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: PontoPx, b: PontoPx): PontoPx => ({ x: a.x - b.x, y: a.y - b.y });
const mult = (a: PontoPx, n: number): PontoPx => ({ x: a.x * n, y: a.y * n });
const unit = (a: PontoPx): PontoPx => { const n = Math.hypot(a.x, a.y); return n === 0 ? { x: 0, y: 0 } : { x: a.x / n, y: a.y / n }; };
const dot = (a: PontoPx, b: PontoPx) => a.x * b.x + a.y * b.y;

/** Alternativas separadas por "|": usa a primeira que estiver utilizável (ex.: "quadril_medio|quadril_d"). */
export function pontoPorEspec(q: QuadroPose, spec: string): PontoPx | null {
  for (const nome of spec.split('|')) {
    const p = pontoDoQuadro(q, nome);
    if (p) return p;
  }
  return null;
}

/** Comprimento mínimo de um braço de referência, para o arco aparecer mesmo com segmentos curtos. */
const BRACO_MIN = 8;

/**
 * Marcação do ângulo de `def` no quadro; null se faltar ponto. `graus` é o valor já calculado (o mesmo do gráfico).
 * Os braços de referência (tracejados) ficam sempre no `b`.
 */
export function marcacaoDoAngulo(def: DefinicaoAngulo, quadro: QuadroPose | undefined, graus: number | null): MarcacaoAnguloUi | null {
  if (!quadro || graus === null || !Number.isFinite(graus)) return null;
  const lado = def.lado;

  if (def.tipo === 'tres_pontos') {
    const A = pontoPorEspec(quadro, def.a), V = pontoPorEspec(quadro, def.vertice), C = pontoPorEspec(quadro, def.c);
    if (!A || !V || !C) return null;
    if (def.saida === 'interno') return { id: def.id, vertice: V, a: A, b: C, graus, lado };
    if (def.saida === 'dorsiflexao') {
      // Posição neutra: perna a 90° do pé. O arco mede o desvio do pé em relação a ela.
      const u = unit(sub(A, V));
      const perp = { x: -u.y, y: u.x };
      const n = dot(perp, sub(C, V)) >= 0 ? perp : mult(perp, -1);
      const comp = Math.max(dist(V, C), BRACO_MIN);
      return { id: def.id, vertice: V, a: C, b: soma(V, mult(n, comp)), graus, lado, tracejadoB: true };
    }
    // Flexão: o arco vai da continuação do segmento anterior (tracejada) até o segmento seguinte.
    const prolongado = soma(V, mult(unit(sub(V, A)), Math.max(dist(V, C), BRACO_MIN)));
    return { id: def.id, vertice: V, a: C, b: prolongado, graus, lado, tracejadoB: true };
  }

  if (def.tipo === 'segmento') {
    const D = pontoPorEspec(quadro, def.de), P = pontoPorEspec(quadro, def.para);
    if (!D || !P) return null;
    const comp = Math.max(dist(D, P), BRACO_MIN);
    let ref: PontoPx;
    if (def.referencia === 'horizontal') ref = { x: P.x >= D.x ? 1 : -1, y: 0 };
    else ref = { x: 0, y: def.referencia === 'vertical_cima' ? -1 : 1 };
    return { id: def.id, vertice: D, a: P, b: soma(D, mult(ref, comp)), graus, lado, tracejadoB: true };
  }

  if (def.tipo === 'entre_segmentos') {
    const a0 = pontoPorEspec(quadro, def.a[0]), a1 = pontoPorEspec(quadro, def.a[1]), b0 = pontoPorEspec(quadro, def.b[0]), b1 = pontoPorEspec(quadro, def.b[1]);
    if (!a0 || !a1 || !b0 || !b1) return null;
    const comp = Math.max(dist(a0, a1), BRACO_MIN);
    return { id: def.id, vertice: a0, a: a1, b: soma(a0, mult(unit(sub(b1, b0)), comp)), graus, lado, tracejadoB: true };
  }

  const H = pontoPorEspec(quadro, def.quadril), K = pontoPorEspec(quadro, def.joelho), T = pontoPorEspec(quadro, def.tornozelo);
  if (!H || !K || !T) return null;
  return { id: def.id, vertice: K, a: T, b: soma(K, mult(unit(sub(K, H)), Math.max(dist(K, T), BRACO_MIN))), graus, lado, tracejadoB: true };
}

/** Marcações de um conjunto de definições num quadro (as que não derem para medir ficam de fora). */
export function marcacoesDoQuadro(defs: DefinicaoAngulo[], quadro: QuadroPose | undefined, direcao: 1 | -1): MarcacaoAnguloUi[] {
  if (!quadro) return [];
  return defs.flatMap((d) => {
    const m = marcacaoDoAngulo(d, quadro, calcularAnguloNoQuadro(d, quadro, direcao));
    return m ? [m] : [];
  });
}

/** Pontos de um quadro em pixels do vídeo, no formato da tela (marca os corrigidos à mão ou ajustados). */
export function pontosParaTela(quadro: QuadroPose | undefined): PontosDoQuadro | null {
  if (!quadro) return null;
  const saida: PontosDoQuadro = {};
  for (const nome of NOMES_PONTOS) {
    const p = quadro.pontos[nome];
    if (!p) continue;
    const usavel = pontoDoQuadro(quadro, nome);
    if (usavel) saida[nome] = { x: usavel.x, y: usavel.y, ...(p.manual ? { manual: true } : {}) };
  }
  return Object.keys(saida).length ? saida : null;
}

/**
 * Cópia do quadro com as posições da tela (o ponto que o dedo está arrastando), para o ângulo mudar enquanto se arrasta.
 * Pontos fora de `sobre` ficam como estão.
 */
export function quadroComPontos(quadro: QuadroPose, sobre: PontosDoQuadro): QuadroPose {
  const pontos = { ...quadro.pontos };
  for (const [nome, p] of Object.entries(sobre)) {
    const atual = pontos[nome];
    if (!atual) continue;
    if (atual.x !== p.x || atual.y !== p.y) pontos[nome] = { ...atual, x: p.x, y: p.y, manual: true, conf: 1 };
  }
  return { ...quadro, pontos };
}

export const LIGACOES_CORPO: LigacaoUi[] = (() => {
  const ligs: LigacaoUi[] = [{ a: 'ombro_e', b: 'ombro_d', lado: null }, { a: 'quadril_e', b: 'quadril_d', lado: null }];
  for (const l of ['d', 'e'] as const) {
    const lado: Lado = l === 'd' ? 'D' : 'E';
    for (const [a, b] of [['ombro', 'quadril'], ['quadril', 'joelho'], ['joelho', 'tornozelo'], ['tornozelo', 'calcanhar'], ['calcanhar', 'pe'], ['tornozelo', 'pe'], ['ombro', 'cotovelo'], ['cotovelo', 'punho']]) {
      ligs.push({ a: `${a}_${l}`, b: `${b}_${l}`, lado });
    }
  }
  return ligs;
})();

const PARTES: Record<string, string> = {
  nariz: 'Nariz', olho: 'Olho', orelha: 'Orelha', boca: 'Boca', ombro: 'Ombro', cotovelo: 'Cotovelo', punho: 'Punho', quadril: 'Quadril', joelho: 'Joelho', tornozelo: 'Tornozelo', calcanhar: 'Calcanhar', pe: 'Ponta do pé',
};

/** "joelho_d" → "Joelho direito". */
export function rotuloDoPonto(nome: string): string {
  const parte = PARTES[nome.split('_')[0]] ?? nome;
  const lado = ladoDe(nome);
  return lado ? `${parte} ${lado === 'D' ? 'direito' : 'esquerdo'}` : parte;
}

/** Pontos reais da trilha de que as definições dependem (os virtuais `_medio` viram os dois lados), na ordem de aparição. */
export function pontosDasDefinicoes(defs: DefinicaoAngulo[]): string[] {
  const reais = new Set<string>(NOMES_PONTOS);
  const saida: string[] = [];
  for (const d of defs) for (const n of pontosDaDefinicao(d)) {
    const candidatos = n.endsWith('_medio') ? [`${n.replace(/_medio$/, '')}_d`, `${n.replace(/_medio$/, '')}_e`] : [n];
    for (const c of candidatos) if (reais.has(c) && !saida.includes(c)) saida.push(c);
  }
  return saida;
}

/** Direção do paciente para os ângulos com sinal, calculada uma vez por trilha. */
export const direcaoDaTrilha = (trilha: TrilhaPose, defs: DefinicaoAngulo[]): 1 | -1 => (defs.some(definicaoPrecisaDeDirecao) ? estimarDirecao(trilha) : 1);

// ---------- quadro marcado (PDF, arte do Instagram, vídeo exportado) ----------

export interface OpcoesItensDoQuadro {
  esqueleto?: boolean;
  angulos?: boolean;
  /** Ângulos a desenhar e a direção do paciente (para os que têm sinal). */
  defs: DefinicaoAngulo[];
  direcao: 1 | -1;
}

/**
 * Itens de desenho (no estilo escolhido) de um quadro: esqueleto fino por lado, ângulos com arco e rótulo, e os pontos.
 * Em pixels do vídeo; `c` traz a escala. Sempre os mesmos itens para a tela, o PDF, a arte e o vídeo exportado.
 */
export function itensDoQuadroAnalisado(quadro: QuadroPose | undefined, c: ContextoDesenho, o: OpcoesItensDoQuadro): ItemDesenho[] {
  if (!quadro) return [];
  const itens: ItemDesenho[] = [];
  const tela = pontosParaTela(quadro);
  const finura = Math.max(c.estilo.espessura * c.k * 0.35, 1.6 * c.k);
  if (o.esqueleto !== false && tela) {
    for (const l of LIGACOES_CORPO) {
      const a = tela[l.a], b = tela[l.b];
      if (a && b) itens.push(itemReta(a, b, c, { cor: l.lado ? COR_LADO[l.lado] : COR_CENTRO, largura: finura, opacidade: 0.85 }));
    }
  }
  if (o.angulos !== false) {
    for (const m of marcacoesDoQuadro(o.defs, quadro, o.direcao)) itens.push(...itensDoAngulo(m.vertice, m.a, m.b, c, { graus: m.graus, tracejadoB: m.tracejadoB, semPontas: true }));
  }
  if (o.esqueleto !== false && tela) {
    for (const [nome, p] of Object.entries(tela)) {
      const lado = ladoDe(nome);
      itens.push(itemPonto(p, 'v', c, { cor: p.manual ? '#fbbf24' : lado ? COR_LADO[lado] : COR_CENTRO, reduzir: 0.7 }));
    }
  }
  return separarRotulos(ordenarCamadas(itens), c.w, c.h);
}
