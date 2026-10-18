import { CONF_MINIMA, type Lado, type QuadroPose, type TrilhaPose } from './tipos';
import { estimarDirecao, pontoDoQuadro } from './trilha';

const GRAUS = 180 / Math.PI;

interface DefinicaoBase {
  id: string;
  nome: string;
  lado: Lado | null;
  descricao?: string;
}

/**
 * Ângulo entre três pontos, com o vértice no meio.
 *  - `interno`: ângulo interno no vértice (0–180°);
 *  - `flexao`: 180° − interno, sem sinal (0° = membro estendido);
 *  - `dorsiflexao`: 90° − interno (+ = dorsiflexão, − = flexão plantar), para o tornozelo (joelho–tornozelo–ponta do pé);
 *  - `flexao_assinada`: desvio em relação à linha reta, com sinal: `sinal × direção × desvio`, de modo que a flexão sai
 *    positiva e a hiperextensão negativa, com o paciente virado para qualquer lado. `sinal` é +1 no joelho e −1 no quadril.
 */
export interface AnguloTresPontos extends DefinicaoBase {
  tipo: 'tres_pontos';
  a: string;
  vertice: string;
  c: string;
  saida: 'interno' | 'flexao' | 'dorsiflexao' | 'flexao_assinada';
  sinal?: 1 | -1;
}

/**
 * Inclinação de um segmento (de → para) em relação à vertical ou à horizontal da imagem.
 *  - vertical, sem sinal: 0–180° contados a partir da vertical escolhida;
 *  - vertical, assinado: positivo quando a ponta `para` está do lado para onde o paciente anda/olha (direção estimada, ou
 *    `direcaoFixa` quando o lado não importa, como na vista frontal: aí + é para a direita da imagem);
 *  - horizontal: inclinação da reta (−90 a 90°); positivo quando o lado direito da imagem está mais baixo.
 */
export interface AnguloSegmento extends DefinicaoBase {
  tipo: 'segmento';
  de: string;
  para: string;
  referencia: 'vertical_cima' | 'vertical_baixo' | 'horizontal';
  assinado?: boolean;
  direcaoFixa?: 1 | -1;
}

/**
 * Ângulo (0–180°) entre dois segmentos independentes, cada um dado por seus dois pontos (do primeiro ao segundo).
 * `desloc` e `escala` convertem o ângulo bruto na convenção clínica: valor = desloc + escala × ângulo (padrão: o próprio ângulo).
 */
export interface AnguloEntreSegmentos extends DefinicaoBase {
  tipo: 'entre_segmentos';
  a: [string, string];
  b: [string, string];
  desloc?: number;
  escala?: 1 | -1;
}

/**
 * Desvio do joelho em relação à reta quadril–tornozelo na vista frontal (ângulo de projeção no plano frontal, 2D).
 * Positivo quando o joelho fica para dentro (em direção ao outro quadril: valgo), negativo para fora (varo).
 */
export interface AnguloValgo extends DefinicaoBase {
  tipo: 'valgo';
  quadril: string;
  joelho: string;
  tornozelo: string;
  quadrilContra: string;
}

export type DefinicaoAngulo = AnguloTresPontos | AnguloSegmento | AnguloEntreSegmentos | AnguloValgo;

export interface OpcoesAngulo {
  /** Para onde o paciente está virado (+1 direita da imagem, −1 esquerda). Sem isto é estimado pelos pés. */
  direcao?: 1 | -1;
  confMin?: number;
}

export interface AmostraAngulo { t: number; graus: number | null }

/** Alternativas separadas por "|": usa a primeira que estiver utilizável (ex.: "quadril_medio|quadril_d|quadril_e"). */
const ponto = (q: QuadroPose, spec: string, confMin: number) => {
  for (const nome of spec.split('|')) {
    const p = pontoDoQuadro(q, nome, confMin);
    if (p) return p;
  }
  return null;
};

const norma = (v: { x: number; y: number }) => Math.hypot(v.x, v.y);

function normalizarReta(g: number): number {
  let x = g;
  if (x > 90) x -= 180;
  if (x <= -90) x += 180;
  return x;
}

export const definicaoPrecisaDeDirecao = (def: DefinicaoAngulo): boolean =>
  (def.tipo === 'tres_pontos' && def.saida === 'flexao_assinada') || (def.tipo === 'segmento' && !!def.assinado && def.referencia !== 'horizontal' && def.direcaoFixa === undefined);

/** Pontos da trilha de que a definição depende (incluindo os virtuais `_medio` e as alternativas). */
export function pontosDaDefinicao(def: DefinicaoAngulo): string[] {
  let nomes: string[];
  if (def.tipo === 'tres_pontos') nomes = [def.a, def.vertice, def.c];
  else if (def.tipo === 'segmento') nomes = [def.de, def.para];
  else if (def.tipo === 'entre_segmentos') nomes = [...def.a, ...def.b];
  else nomes = [def.quadril, def.joelho, def.tornozelo, def.quadrilContra];
  const saida: string[] = [];
  for (const spec of nomes) for (const n of spec.split('|')) if (!saida.includes(n)) saida.push(n);
  return saida;
}

/** Ângulo da definição em um quadro, em graus; null se faltar algum ponto utilizável ou se algum segmento tiver comprimento zero. */
export function calcularAnguloNoQuadro(def: DefinicaoAngulo, quadro: QuadroPose | undefined, direcao: 1 | -1 = 1, confMin = CONF_MINIMA): number | null {
  if (!quadro) return null;

  if (def.tipo === 'tres_pontos') {
    const A = ponto(quadro, def.a, confMin), V = ponto(quadro, def.vertice, confMin), C = ponto(quadro, def.c, confMin);
    if (!A || !V || !C) return null;
    if (def.saida === 'flexao_assinada') {
      const u = { x: V.x - A.x, y: V.y - A.y }, w = { x: C.x - V.x, y: C.y - V.y };
      if (norma(u) === 0 || norma(w) === 0) return null;
      const desvio = Math.atan2(u.x * w.y - u.y * w.x, u.x * w.x + u.y * w.y) * GRAUS;
      return (def.sinal ?? 1) * direcao * desvio;
    }
    const u = { x: A.x - V.x, y: A.y - V.y }, w = { x: C.x - V.x, y: C.y - V.y };
    const nu = norma(u), nw = norma(w);
    if (nu === 0 || nw === 0) return null;
    const interno = Math.acos(Math.min(1, Math.max(-1, (u.x * w.x + u.y * w.y) / (nu * nw)))) * GRAUS;
    if (def.saida === 'interno') return interno;
    if (def.saida === 'flexao') return 180 - interno;
    return 90 - interno;
  }

  if (def.tipo === 'segmento') {
    const D = ponto(quadro, def.de, confMin), P = ponto(quadro, def.para, confMin);
    if (!D || !P) return null;
    const vx = P.x - D.x, vy = P.y - D.y;
    if (vx === 0 && vy === 0) return null;
    const d = def.direcaoFixa ?? direcao;
    if (def.referencia === 'horizontal') {
      const g = normalizarReta(Math.atan2(vy, vx) * GRAUS);
      return def.assinado ? g : Math.abs(g);
    }
    const para = def.referencia === 'vertical_baixo' ? vy : -vy;
    return Math.atan2(def.assinado ? d * vx : Math.abs(vx), para) * GRAUS;
  }

  if (def.tipo === 'entre_segmentos') {
    const a1 = ponto(quadro, def.a[0], confMin), a2 = ponto(quadro, def.a[1], confMin), b1 = ponto(quadro, def.b[0], confMin), b2 = ponto(quadro, def.b[1], confMin);
    if (!a1 || !a2 || !b1 || !b2) return null;
    const u = { x: a2.x - a1.x, y: a2.y - a1.y }, w = { x: b2.x - b1.x, y: b2.y - b1.y };
    const nu = norma(u), nw = norma(w);
    if (nu === 0 || nw === 0) return null;
    const bruto = Math.acos(Math.min(1, Math.max(-1, (u.x * w.x + u.y * w.y) / (nu * nw)))) * GRAUS;
    return (def.desloc ?? 0) + (def.escala ?? 1) * bruto;
  }

  const H = ponto(quadro, def.quadril, confMin), K = ponto(quadro, def.joelho, confMin), A = ponto(quadro, def.tornozelo, confMin), Hc = ponto(quadro, def.quadrilContra, confMin);
  if (!H || !K || !A || !Hc || Hc.x === H.x) return null;
  const u = { x: K.x - H.x, y: K.y - H.y }, w = { x: A.x - K.x, y: A.y - K.y };
  if (norma(u) === 0 || norma(w) === 0) return null;
  const desvio = Math.atan2(u.x * w.y - u.y * w.x, u.x * w.x + u.y * w.y) * GRAUS;
  return Math.sign(Hc.x - H.x) * desvio;
}

/** Ângulo da definição em cada quadro da trilha (`graus` null onde não deu para medir). A trilha não é alterada. */
export function angulosPorQuadro(trilha: TrilhaPose, def: DefinicaoAngulo, opcoes: OpcoesAngulo = {}): AmostraAngulo[] {
  const confMin = opcoes.confMin ?? CONF_MINIMA;
  const direcao = opcoes.direcao ?? (definicaoPrecisaDeDirecao(def) ? estimarDirecao(trilha) : 1);
  return trilha.quadros.map((q) => ({ t: q.t, graus: calcularAnguloNoQuadro(def, q, direcao, confMin) }));
}

/** Ângulo da definição em um quadro da trilha (para o rótulo ao vivo durante o arraste). */
export function anguloNoQuadro(trilha: TrilhaPose, indice: number, def: DefinicaoAngulo, opcoes: OpcoesAngulo = {}): number | null {
  const direcao = opcoes.direcao ?? (definicaoPrecisaDeDirecao(def) ? estimarDirecao(trilha) : 1);
  return calcularAnguloNoQuadro(def, trilha.quadros[indice], direcao, opcoes.confMin ?? CONF_MINIMA);
}

export const grausDaSerie = (amostras: AmostraAngulo[]): (number | null)[] => amostras.map((a) => a.graus);

// ---------- definições prontas ----------

const sfx = (lado: Lado) => lado.toLowerCase();
const lateral = (lado: Lado) => (lado === 'D' ? 'direito' : 'esquerdo');

/** Flexão do joelho: quadril–joelho–tornozelo, assinada (0° = estendido). */
export const anguloJoelho = (lado: Lado, assinado = true): AnguloTresPontos => ({
  id: `joelho_${sfx(lado)}`, nome: `Joelho ${lateral(lado)}`, lado, tipo: 'tres_pontos',
  a: `quadril_${sfx(lado)}`, vertice: `joelho_${sfx(lado)}`, c: `tornozelo_${sfx(lado)}`,
  saida: assinado ? 'flexao_assinada' : 'flexao', ...(assinado ? { sinal: 1 as const } : {}),
  descricao: 'Flexão do joelho (0° = estendido).',
});

/** Flexão do quadril: ombro–quadril–joelho, assinada (+ = coxa à frente do tronco, − = extensão). */
export const anguloQuadril = (lado: Lado, assinado = true): AnguloTresPontos => ({
  id: `quadril_${sfx(lado)}`, nome: `Quadril ${lateral(lado)}`, lado, tipo: 'tres_pontos',
  a: `ombro_${sfx(lado)}`, vertice: `quadril_${sfx(lado)}`, c: `joelho_${sfx(lado)}`,
  saida: assinado ? 'flexao_assinada' : 'flexao', ...(assinado ? { sinal: -1 as const } : {}),
  descricao: 'Flexão do quadril entre o tronco e a coxa (0° = em pé; negativo = extensão).',
});

/**
 * Dorsiflexão do tornozelo: ângulo entre a perna (tornozelo → joelho) e o eixo do pé (calcanhar → ponta do pé), contado a partir do
 * neutro de 90° (+ = dorsiflexão, − = flexão plantar, 0° = perna perpendicular ao pé). Usa o eixo do pé, e não a ponta do pé em relação
 * ao tornozelo, porque a ponta fica abaixo do tornozelo e isso soma um erro fixo ao ângulo.
 */
export const anguloTornozelo = (lado: Lado): AnguloEntreSegmentos => ({
  id: `tornozelo_${sfx(lado)}`, nome: `Tornozelo ${lateral(lado)}`, lado, tipo: 'entre_segmentos',
  a: [`tornozelo_${sfx(lado)}`, `joelho_${sfx(lado)}`], b: [`calcanhar_${sfx(lado)}`, `pe_${sfx(lado)}`], desloc: 90, escala: -1,
  descricao: 'Dorsiflexão do tornozelo: 0° = neutro (perna a 90° do eixo do pé), + = dorsiflexão, − = flexão plantar. Na medida manual do tornozelo o neutro é 90° (ângulo perna-pé), por isso os números diferem.',
});

/** Inclinação do tronco (quadril → ombro) em relação à vertical; positivo = inclinado para a frente. */
export const inclinacaoTronco: AnguloSegmento = {
  id: 'tronco', nome: 'Inclinação do tronco', lado: null, tipo: 'segmento',
  de: 'quadril_medio|quadril_d|quadril_e', para: 'ombro_medio|ombro_d|ombro_e', referencia: 'vertical_cima', assinado: true,
  descricao: 'Inclinação do tronco em relação à vertical; positivo = para a frente.',
};

/** Inclinação lateral do tronco na vista frontal/posterior; positivo = para a direita da imagem. */
export const inclinacaoLateralTronco: AnguloSegmento = {
  id: 'tronco_lateral', nome: 'Inclinação lateral do tronco', lado: null, tipo: 'segmento',
  de: 'quadril_medio|quadril_d|quadril_e', para: 'ombro_medio|ombro_d|ombro_e', referencia: 'vertical_cima', assinado: true, direcaoFixa: 1,
  descricao: 'Inclinação do tronco para o lado, em relação à vertical; positivo = para a direita da imagem.',
};

/** Perna (joelho → tornozelo) em relação à vertical; positivo = tornozelo à frente do joelho (tíbia "estendida"). */
export const anguloTibia = (lado: Lado): AnguloSegmento => ({
  id: `tibia_${sfx(lado)}`, nome: `Tíbia ${lateral(lado)}`, lado, tipo: 'segmento',
  de: `joelho_${sfx(lado)}`, para: `tornozelo_${sfx(lado)}`, referencia: 'vertical_baixo', assinado: true,
  descricao: 'Inclinação da perna em relação à vertical; positivo = tornozelo à frente do joelho.',
});

/** Coxa (quadril → joelho) em relação à vertical; positivo = joelho à frente do quadril (coxa fletida). */
export const anguloCoxa = (lado: Lado): AnguloSegmento => ({
  id: `coxa_${sfx(lado)}`, nome: `Coxa ${lateral(lado)}`, lado, tipo: 'segmento',
  de: `quadril_${sfx(lado)}`, para: `joelho_${sfx(lado)}`, referencia: 'vertical_baixo', assinado: true,
  descricao: 'Inclinação da coxa em relação à vertical; positivo = joelho à frente do quadril.',
});

/** Valgo dinâmico do joelho na vista frontal (positivo = joelho para dentro). */
export const anguloValgo = (lado: Lado): AnguloValgo => ({
  id: `valgo_${sfx(lado)}`, nome: `Valgo do joelho ${lateral(lado)}`, lado, tipo: 'valgo',
  quadril: `quadril_${sfx(lado)}`, joelho: `joelho_${sfx(lado)}`, tornozelo: `tornozelo_${sfx(lado)}`, quadrilContra: `quadril_${sfx(lado === 'D' ? 'E' : 'D')}`,
  descricao: 'Desvio do joelho em relação à reta quadril–tornozelo no plano frontal (projeção 2D); positivo = para dentro.',
});

/** Elevação do braço (ombro → cotovelo) em relação à vertical para baixo: 0° = braço ao lado do corpo, 90° = horizontal, 180° = acima da cabeça. */
export const elevacaoBraco = (lado: Lado): AnguloSegmento => ({
  id: `elevacao_${sfx(lado)}`, nome: `Elevação do braço ${lateral(lado)}`, lado, tipo: 'segmento',
  de: `ombro_${sfx(lado)}`, para: `cotovelo_${sfx(lado)}`, referencia: 'vertical_baixo',
  descricao: 'Ângulo do braço com a vertical para baixo (0° = ao lado do corpo; 180° = acima da cabeça).',
});

/** Elevação do braço em relação ao tronco (acompanha a inclinação do tronco). */
export const elevacaoRelativaAoTronco = (lado: Lado): AnguloEntreSegmentos => ({
  id: `elevacao_tronco_${sfx(lado)}`, nome: `Elevação em relação ao tronco ${lateral(lado)}`, lado, tipo: 'entre_segmentos',
  a: [`ombro_${sfx(lado)}`, `cotovelo_${sfx(lado)}`], b: ['ombro_medio|ombro_d|ombro_e', 'quadril_medio|quadril_d|quadril_e'],
  descricao: 'Ângulo entre o braço e o tronco (0° = braço ao lado do corpo).',
});

/** Inclinação da linha dos ombros (ou da pelve) na vista frontal; positivo = lado direito da imagem mais baixo. */
export const linhaDosOmbros: AnguloSegmento = {
  id: 'linha_ombros', nome: 'Linha dos ombros', lado: null, tipo: 'segmento', de: 'ombro_e', para: 'ombro_d', referencia: 'horizontal', assinado: true,
  descricao: 'Inclinação da linha entre os ombros em relação à horizontal.',
};

export const linhaDaPelve: AnguloSegmento = {
  id: 'linha_pelve', nome: 'Linha da pelve', lado: null, tipo: 'segmento', de: 'quadril_e', para: 'quadril_d', referencia: 'horizontal', assinado: true,
  descricao: 'Inclinação da linha entre os quadris em relação à horizontal.',
};

/**
 * Legenda do sentido do sinal dos ângulos de um conjunto de definições (uma frase por descrição diferente). Sem ela, um "−12°" no
 * gráfico não diz se é extensão, hiperextensão ou inclinação para trás.
 */
export function legendaDosAngulos(defs: readonly DefinicaoAngulo[]): string {
  return [...new Set(defs.map((d) => d.descricao).filter((d): d is string => !!d))].join(' ');
}
