import type { Retangulo } from './formatos';

export const limitar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** Como a foto ocupa a caixa: inteira (com fundo desfocado nas sobras) ou preenchendo (corta o excesso). */
export type ModoAjuste = 'inteira' | 'preencher';

/**
 * Parte da foto que aparece na caixa. `zoom` 1 é o encaixe do modo (inteira ou preencher); `cx` e `cy`
 * (0 a 1) dizem qual ponto da foto fica no centro da caixa, então o enquadramento acompanha a anatomia
 * mesmo em fotos de tamanhos diferentes.
 */
export interface Enquadramento { zoom: number; cx: number; cy: number }

export const ENQUADRAMENTO_PADRAO: Enquadramento = { zoom: 1, cx: 0.5, cy: 0.5 };
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;

export interface JanelaImagem {
  /** Pixels da caixa por pixel da foto. */
  escala: number;
  /** Canto superior esquerdo da janela, em pixels da foto (pode sair da foto no modo "inteira"). */
  janelaX: number;
  janelaY: number;
  /** Parte da foto que é desenhada. */
  origem: Retangulo;
  /** Onde ela cai na arte. */
  destino: Retangulo;
}

export function janelaDaImagem(caixa: Retangulo, imgW: number, imgH: number, modo: ModoAjuste, enq: Enquadramento = ENQUADRAMENTO_PADRAO): JanelaImagem {
  if (!(caixa.w > 0) || !(caixa.h > 0) || !(imgW > 0) || !(imgH > 0)) {
    return { escala: 0, janelaX: 0, janelaY: 0, origem: { x: 0, y: 0, w: 0, h: 0 }, destino: { x: caixa.x, y: caixa.y, w: 0, h: 0 } };
  }
  const base = modo === 'preencher' ? Math.max(caixa.w / imgW, caixa.h / imgH) : Math.min(caixa.w / imgW, caixa.h / imgH);
  const escala = base * limitar(Number.isFinite(enq.zoom) ? enq.zoom : 1, ZOOM_MIN, ZOOM_MAX);
  const vw = caixa.w / escala, vh = caixa.h / escala;
  const centro = (c: number, tam: number, janela: number) => (janela >= tam ? tam / 2 : limitar(c * tam, janela / 2, tam - janela / 2));
  const cx = centro(Number.isFinite(enq.cx) ? enq.cx : 0.5, imgW, vw);
  const cy = centro(Number.isFinite(enq.cy) ? enq.cy : 0.5, imgH, vh);
  const janelaX = cx - vw / 2, janelaY = cy - vh / 2;
  const x0 = Math.max(0, janelaX), y0 = Math.max(0, janelaY);
  const x1 = Math.min(imgW, janelaX + vw), y1 = Math.min(imgH, janelaY + vh);
  return {
    escala, janelaX, janelaY,
    origem: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
    destino: { x: caixa.x + (x0 - janelaX) * escala, y: caixa.y + (y0 - janelaY) * escala, w: (x1 - x0) * escala, h: (y1 - y0) * escala },
  };
}

/** Posição na arte de um ponto da foto dado em fração (0–1). */
export function posicaoNaArte(j: JanelaImagem, imgW: number, imgH: number, fx: number, fy: number, caixa: Retangulo): { x: number; y: number } {
  return { x: caixa.x + (fx * imgW - j.janelaX) * j.escala, y: caixa.y + (fy * imgH - j.janelaY) * j.escala };
}

/** Fração da foto (0–1) sob a posição `x`,`y` da arte. */
export function fracaoDaFotoSob(j: JanelaImagem, imgW: number, imgH: number, caixa: Retangulo, x: number, y: number): { x: number; y: number } {
  if (!(j.escala > 0)) return { x: 0.5, y: 0.5 };
  return { x: (j.janelaX + (x - caixa.x) / j.escala) / imgW, y: (j.janelaY + (y - caixa.y) / j.escala) / imgH };
}

/** Arrastar a foto com o dedo: ela acompanha o dedo, então o centro da janela anda no sentido oposto. */
export function arrastarEnquadramento(enq: Enquadramento, dx: number, dy: number, caixa: Retangulo, imgW: number, imgH: number, modo: ModoAjuste): Enquadramento {
  const j = janelaDaImagem(caixa, imgW, imgH, modo, enq);
  if (!(j.escala > 0)) return enq;
  const cx = (j.janelaX + caixa.w / j.escala / 2 - dx / j.escala) / imgW;
  const cy = (j.janelaY + caixa.h / j.escala / 2 - dy / j.escala) / imgH;
  return { zoom: enq.zoom, cx: limitar(cx, 0, 1), cy: limitar(cy, 0, 1) };
}

/** Muda o zoom mantendo parado o ponto da foto que está sob `foco` (na arte). */
export function zoomarEnquadramento(enq: Enquadramento, novoZoom: number, caixa: Retangulo, imgW: number, imgH: number, modo: ModoAjuste, foco?: { x: number; y: number }): Enquadramento {
  const z = limitar(novoZoom, ZOOM_MIN, ZOOM_MAX);
  const antes = janelaDaImagem(caixa, imgW, imgH, modo, enq);
  if (!(antes.escala > 0)) return { ...enq, zoom: z };
  const f = foco ?? { x: caixa.x + caixa.w / 2, y: caixa.y + caixa.h / 2 };
  const sob = fracaoDaFotoSob(antes, imgW, imgH, caixa, f.x, f.y);
  const escalaNova = antes.escala / limitar(enq.zoom, ZOOM_MIN, ZOOM_MAX) * z;
  const cx = sob.x * imgW - (f.x - caixa.x - caixa.w / 2) / escalaNova;
  const cy = sob.y * imgH - (f.y - caixa.y - caixa.h / 2) / escalaNova;
  return { zoom: z, cx: limitar(cx / imgW, 0, 1), cy: limitar(cy / imgH, 0, 1) };
}

/** Maior tamanho que cabe inteiro na caixa, sem distorcer. */
export function caberNaCaixa(caixaW: number, caixaH: number, w: number, h: number): { w: number; h: number } {
  if (!(caixaW > 0) || !(caixaH > 0) || !(w > 0) || !(h > 0)) return { w: 0, h: 0 };
  const e = Math.min(caixaW / w, caixaH / h);
  return { w: w * e, h: h * e };
}

/** Até quanto da foto pode ser cortado no modo "preencher" para ele ser o modo de partida (o resto vai "inteira", sem cortar o paciente). */
export const PERDA_MAXIMA_PREENCHER = 0.35;

/** Modo de partida: preenche a caixa quando o corte é pequeno e mostra a foto inteira quando seria grande. */
export function ajusteSugerido(caixaW: number, caixaH: number, imgW: number, imgH: number): ModoAjuste {
  if (!(caixaW > 0) || !(caixaH > 0) || !(imgW > 0) || !(imgH > 0)) return 'inteira';
  const r = caixaW / caixaH, ri = imgW / imgH;
  return 1 - Math.min(r / ri, ri / r) <= PERDA_MAXIMA_PREENCHER ? 'preencher' : 'inteira';
}

/**
 * Enquadramento de partida no modo "preencher": a foto é cortada, e cortar a cabeça fora de uma foto de
 * corpo inteiro seria o pior começo. Com a posição do rosto, a janela sobe até o rosto ficar a
 * `posicaoDoRosto` (fração) da altura da caixa; sem rosto, fica no centro.
 */
export function enquadramentoPorRosto(caixa: Retangulo, imgW: number, imgH: number, modo: ModoAjuste, zoom: number, rosto: { cx: number; cy: number } | null, posicaoDoRosto = 0.24): Enquadramento {
  const base: Enquadramento = { zoom, cx: 0.5, cy: 0.5 };
  if (!rosto) return base;
  const j = janelaDaImagem(caixa, imgW, imgH, modo, base);
  if (!(j.escala > 0)) return base;
  const visivel = caixa.h / j.escala / imgH;
  return { zoom, cx: 0.5, cy: limitar(rosto.cy + (0.5 - posicaoDoRosto) * visivel, 0, 1) };
}

/** Quanto das marcações (linhas, pontos e rótulos) cai em cada faixa da foto: `colunas` da esquerda para a direita e `linhas` de cima para baixo; cada vetor soma 1. */
export interface PerfilMarcas { colunas: number[]; linhas: number[] }

/** Soma de `v` (faixas iguais de uma foto de `tam` px) entre `de` e `ate`, em px da foto. */
function massaEntre(v: number[], tam: number, de: number, ate: number): number {
  const n = v.length;
  const largura = tam / n;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const sobra = Math.min((i + 1) * largura, ate) - Math.max(i * largura, de);
    if (sobra > 0) s += (v[i] * sobra) / largura;
  }
  return s;
}

/**
 * Fração das marcações que a janela mostra. Como as marcações têm duas dimensões e o perfil só guarda os eixos
 * separados, é o limite inferior seguro: nunca promete ver mais do que se vê.
 */
export function fracaoVisivel(j: JanelaImagem, imgW: number, imgH: number, perfil: PerfilMarcas): number {
  if (!(j.escala > 0)) return 0;
  const x = massaEntre(perfil.colunas, imgW, j.origem.x, j.origem.x + j.origem.w);
  const y = massaEntre(perfil.linhas, imgH, j.origem.y, j.origem.y + j.origem.h);
  return limitar(x + y - 1, 0, 1);
}

/** Média de vários perfis (um por foto), para um único enquadramento servir às duas fotos de uma comparação. */
export function perfilMedio(perfis: (PerfilMarcas | null | undefined)[]): PerfilMarcas | null {
  const validos = perfis.filter((p): p is PerfilMarcas => !!p);
  if (!validos.length) return null;
  const media = (eixo: 'colunas' | 'linhas') => validos[0][eixo].map((_, i) => validos.reduce((s, p) => s + (p[eixo][i] ?? 0), 0) / validos.length);
  return { colunas: media('colunas'), linhas: media('linhas') };
}

/** Margem de perda de marcações que o enquadramento automático aceita para preferir o do rosto ao que mostra mais. */
const TOLERANCIA_ENQUADRAMENTO = 0.015;
/** Fração mínima das marcações que o modo "preencher" precisa mostrar para ser o de partida. */
export const VISIVEL_MINIMO_PREENCHER = 0.97;

export interface EnquadramentoAutomatico { enquadramento: Enquadramento; /** Fração das marcações que ele mostra (1 sem perfil ou na foto inteira). */ visivel: number }

/**
 * Enquadramento de partida: o do rosto no alto (como em `enquadramentoPorRosto`); se ele cortaria marcações, anda
 * o mínimo para o lado ou para cima/baixo até mostrar o máximo delas. No modo "inteira" nada é cortado.
 */
export function enquadramentoAutomatico(caixa: Retangulo, imgW: number, imgH: number, modo: ModoAjuste, rosto: { cx: number; cy: number } | null, perfil: PerfilMarcas | null): EnquadramentoAutomatico {
  if (modo === 'inteira') return { enquadramento: ENQUADRAMENTO_PADRAO, visivel: 1 };
  const base = enquadramentoPorRosto(caixa, imgW, imgH, modo, 1, rosto);
  if (!perfil) return { enquadramento: base, visivel: 1 };
  const j0 = janelaDaImagem(caixa, imgW, imgH, modo, base);
  if (!(j0.escala > 0)) return { enquadramento: base, visivel: 1 };
  const vw = caixa.w / j0.escala, vh = caixa.h / j0.escala;

  const melhorCentro = (v: number[], tam: number, janela: number, atual: number): number => {
    if (janela >= tam - 0.5) return 0.5;
    const na = (centroPx: number) => massaEntre(v, tam, centroPx - janela / 2, centroPx + janela / 2);
    const centroAtual = limitar(atual * tam, janela / 2, tam - janela / 2);
    let melhor = centroAtual, melhorMassa = na(melhor);
    const base0 = melhorMassa;
    for (let k = 0; k <= 40; k++) {
      const c = janela / 2 + (k / 40) * (tam - janela);
      const m = na(c);
      if (m > melhorMassa + 1e-9 || (Math.abs(m - melhorMassa) <= 1e-9 && Math.abs(c - centroAtual) < Math.abs(melhor - centroAtual))) { melhor = c; melhorMassa = m; }
    }
    return melhorMassa - base0 > TOLERANCIA_ENQUADRAMENTO ? melhor / tam : atual;
  };

  const cx = melhorCentro(perfil.colunas, imgW, vw, base.cx);
  const cy = melhorCentro(perfil.linhas, imgH, vh, base.cy);
  const enquadramento: Enquadramento = { zoom: 1, cx: limitar(cx, 0, 1), cy: limitar(cy, 0, 1) };
  return { enquadramento, visivel: fracaoVisivel(janelaDaImagem(caixa, imgW, imgH, modo, enquadramento), imgW, imgH, perfil) };
}
