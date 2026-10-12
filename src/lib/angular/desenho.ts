import { girar, segmentosDaMedida, REFS_COMPASSO, type Medida, type OlharPara, type Ponto, type RefCompasso, type TipoDesenho } from './medidas';
import { arcoDoAngulo, coresDoRotulo, escalaDoEstilo, larguraDoTexto, rotuloGraus, type EstiloMarcacao } from './estilo';

/*
 * Núcleo de desenho das marcações: medidas -> itens puros (já com estilo e escala aplicados).
 * O SVG da tela, o canvas do PDF/PNG e a arte social só pintam estes itens, por isso saem iguais.
 * Todas as coordenadas e tamanhos estão em pixels da foto.
 */

export interface ContextoDesenho {
  /** Tamanho da foto, em px. */
  w: number;
  h: number;
  estilo: EstiloMarcacao;
  /** Pixels da foto por unidade do estilo (ver `escalaDoEstilo`). */
  k: number;
  /** Correção de nível, em graus (0 sem correção): as referências horizontal e vertical giram junto. */
  giro: number;
  /** Espessura mínima das retas, em px da foto (só na tela, para a prévia pequena não afinar demais). */
  espMin?: number;
}

export function contextoDesenho(w: number, h: number, estilo: EstiloMarcacao, o: { zoom?: number; giro?: number | null; k?: number; espMin?: number } = {}): ContextoDesenho {
  return { w, h, estilo, k: o.k ?? escalaDoEstilo(w, h, o.zoom ?? 1), giro: o.giro ?? 0, ...(o.espMin ? { espMin: o.espMin } : {}) };
}

export interface Halo { cor: string; largura: number }

export type ItemDesenho =
  | { tipo: 'reta'; a: Ponto; b: Ponto; largura: number; cor: string; tracejado?: [number, number]; opacidade?: number; halo?: Halo; grupo?: string }
  | { tipo: 'arco'; path: string; centro: Ponto; raio: number; inicio: number; delta: number; largura: number; cor: string; halo?: Halo; grupo?: string }
  | { tipo: 'ponto'; x: number; y: number; raio: number; cor: string; anel: string; larguraAnel: number; grupo?: string }
  | {
    tipo: 'rotulo'; texto: string; x: number; y: number; largura: number; altura: number; fonte: number;
    fundo?: string; borda: string; larguraBorda: number; cor: string; contorno?: string; larguraContorno: number; grupo?: string;
  };

export type PapelPonto = 'a' | 'b' | 'v';

const RAD = 180 / Math.PI;
const dist = (a: Ponto, b: Ponto) => Math.hypot(a.x - b.x, a.y - b.y);
const soma = (a: Ponto, b: Ponto): Ponto => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Ponto, b: Ponto): Ponto => ({ x: a.x - b.x, y: a.y - b.y });
const mult = (a: Ponto, n: number): Ponto => ({ x: a.x * n, y: a.y * n });
const unit = (a: Ponto): Ponto => { const n = Math.hypot(a.x, a.y); return n === 0 ? { x: 0, y: 0 } : { x: a.x / n, y: a.y / n }; };
const dot = (a: Ponto, b: Ponto) => a.x * b.x + a.y * b.y;
const cruz = (a: Ponto, b: Ponto) => a.x * b.y - a.y * b.x;
const limitar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** Papel (cor) de cada ponto da medida, na ordem em que são marcados. */
export function papeisDaMedida(tipo?: TipoDesenho): PapelPonto[] {
  switch (tipo) {
    case 'angulo3': case 'angulo-q': return ['a', 'v', 'b'];
    case 'compasso': return ['v', 'a', 'b'];
    case 'compasso-ref': return ['v', 'a'];
    case 'retas': return ['a', 'a', 'b', 'b'];
    case 'prumo': return ['v', 'a', 'a', 'a', 'a'];
    default: return ['a', 'b', 'b', 'b'];
  }
}

// --- medidas de estilo em px da foto -----------------------------------------------------------

const espessuraPx = (c: ContextoDesenho) => Math.max(c.estilo.espessura * c.k, c.espMin ?? 0);
const raioPontoPx = (c: ContextoDesenho) => (c.estilo.espessura * 0.6 + 4.6) * c.k;
const larguraArcoPx = (c: ContextoDesenho) => Math.max(espessuraPx(c) * 0.4, 2 * c.k);

function haloDe(c: ContextoDesenho, largura: number): Halo | undefined {
  const e = c.estilo;
  if (!e.contornoLinhas || !e.contorno) return undefined;
  return { cor: e.contorno, largura: largura + 2 * Math.max(1.5 * c.k, largura * 0.35) };
}

export function itemReta(a: Ponto, b: Ponto, c: ContextoDesenho, o: { cor?: string; largura?: number; tracejada?: boolean; opacidade?: number; grupo?: string } = {}): ItemDesenho {
  const largura = o.largura ?? (o.tracejada ? Math.max(espessuraPx(c) * 0.5, 1.5 * c.k) : espessuraPx(c));
  const passo = Math.max(espessuraPx(c) * 1.8, 6 * c.k);
  const item: ItemDesenho = { tipo: 'reta', a, b, largura, cor: o.cor ?? c.estilo.cor, grupo: o.grupo };
  if (o.tracejada) { item.tracejado = [passo, Math.max(passo * 0.7, 5 * c.k)]; item.opacidade = o.opacidade ?? 0.9; }
  else {
    if (o.opacidade !== undefined) item.opacidade = o.opacidade;
    const halo = haloDe(c, largura);
    if (halo) item.halo = halo;
  }
  return item;
}

export function itemPonto(p: Ponto, papel: PapelPonto, c: ContextoDesenho, o: { cor?: string; reduzir?: number; grupo?: string } = {}): ItemDesenho {
  const e = c.estilo;
  const cor = o.cor ?? (papel === 'a' ? e.corPontoA : papel === 'b' ? e.corPontoB : e.corVertice);
  const raio = raioPontoPx(c) * (o.reduzir ?? 1);
  return { tipo: 'ponto', x: p.x, y: p.y, raio, cor, anel: '#ffffff', larguraAnel: Math.max(raio * 0.28, 1), grupo: o.grupo };
}

export function caixaDoRotulo(texto: string, c: ContextoDesenho): { w: number; h: number; fonte: number } {
  const fonte = c.estilo.tamanhoRotulo * c.k;
  return { w: larguraDoTexto(texto, fonte) + fonte * 0.9, h: fonte * 1.45, fonte };
}

/** Rótulo centrado em (x, y), empurrado para dentro da foto. */
export function itemRotulo(texto: string, x: number, y: number, c: ContextoDesenho, grupo?: string): ItemDesenho {
  const { w, h, fonte } = caixaDoRotulo(texto, c);
  const cores = coresDoRotulo(c.estilo);
  const cx = c.w > w ? limitar(x, w / 2, c.w - w / 2) : c.w / 2;
  const cy = c.h > h ? limitar(y, h / 2, c.h - h / 2) : c.h / 2;
  return {
    tipo: 'rotulo', texto, x: cx, y: cy, largura: w, altura: h, fonte, fundo: cores.fundo, borda: cores.borda,
    larguraBorda: cores.fundo ? Math.max(fonte * 0.07, 1) : 0, cor: cores.texto, contorno: cores.contorno, larguraContorno: cores.contorno ? fonte * 0.2 : 0, grupo,
  };
}

// --- blocos geométricos ------------------------------------------------------------------------

interface OpcoesAngulo {
  texto?: string;
  /** O braço b é só referência: sai tracejado e fino (sem ponta). */
  tracejadoB?: boolean;
  /** O braço a é só prolongamento: tracejado. */
  semBracoA?: boolean;
  grupo?: string;
}

/**
 * Dois braços a partir do vértice, o arco entre eles e o rótulo. Não inclui os pontos (cada medida
 * escolhe onde ficam as bolinhas). Devolve o rótulo à parte para ser posto por cima de tudo.
 */
export function blocoAngular(v: Ponto, a: Ponto, b: Ponto, c: ContextoDesenho, o: OpcoesAngulo = {}): ItemDesenho[] {
  const itens: ItemDesenho[] = [];
  if (!o.semBracoA) itens.push(itemReta(v, a, c, { grupo: o.grupo }));
  itens.push(itemReta(v, b, c, { tracejada: o.tracejadoB, grupo: o.grupo }));
  const braco = Math.min(dist(v, a), dist(v, b));
  const raio = Math.min(c.estilo.raioArco * c.k, braco * 0.6);
  const comArco = raio > espessuraPx(c) * 1.2 && braco > 0;
  const texto = c.estilo.mostrarRotulo ? o.texto : undefined;
  const caixa = texto ? caixaDoRotulo(texto, c) : undefined;
  const arco = comArco ? arcoDoAngulo(v, a, b, raio, caixa) : null;
  if (arco && c.estilo.mostrarArco && arco.path) {
    itens.push({ tipo: 'arco', path: arco.path, centro: v, raio, inicio: arco.inicio, delta: arco.delta, largura: larguraArcoPx(c), cor: c.estilo.cor, halo: haloDe(c, larguraArcoPx(c)), grupo: o.grupo });
  }
  if (texto && caixa) {
    let pos: Ponto;
    if (arco) {
      pos = arco.posicaoRotulo;
      // Ângulo pequeno: o rótulo sobre a bissetriz cairia em cima dos braços; sobe para o lado.
      if (arco.anguloGraus < 15) {
        const tm = arco.inicio + arco.delta / 2;
        const normal = { x: -Math.sin(tm), y: Math.cos(tm) };
        const lado = normal.y <= 0 ? 1 : -1;
        pos = soma(pos, mult(normal, lado * (caixa.h / 2 + espessuraPx(c))));
      }
    } else {
      pos = { x: v.x, y: v.y - caixa.h };
    }
    itens.push(itemRotulo(texto, pos.x, pos.y, c, o.grupo));
  }
  return itens;
}

function intersecao(p1: Ponto, d1: Ponto, p2: Ponto, d2: Ponto): { ponto: Ponto; t1: number; t2: number } | null {
  const den = cruz(d1, d2);
  if (Math.abs(den) < 1e-9) return null;
  const dif = sub(p2, p1);
  const t1 = cruz(dif, d2) / den;
  const t2 = cruz(dif, d1) / den;
  return { ponto: soma(p1, mult(d1, t1)), t1, t2 };
}

/** Direção da referência (vertical ou horizontal da foto) na imagem, considerando a correção de nível. */
const direcaoNaImagem = (v: Ponto, giro: number) => (giro ? girar(v, giro) : v);

interface RotulosDaMedida {
  /** Rótulo único da medida. */
  principal?: string;
  /** Rótulo de cada ponto (fio de prumo), pelo índice do ponto. */
  porPonto?: Record<number, string>;
}

function itensGenericos(m: Medida, p: Ponto[], c: ContextoDesenho, g: string): ItemDesenho[] {
  const papeis = papeisDaMedida(m.desenho);
  const cor = m.corReferencia;
  const itens: ItemDesenho[] = [];
  for (const [i, j] of segmentosDaMedida(m)) {
    if (i < p.length && j < p.length) itens.push(itemReta(p[i], p[j], c, cor ? { cor, largura: Math.max(espessuraPx(c) * 0.6, 2 * c.k), grupo: g } : { grupo: g }));
  }
  p.forEach((q, i) => itens.push(itemPonto(q, papeis[i] ?? 'b', c, { cor, reduzir: cor ? 0.8 : 1, grupo: g })));
  return itens;
}

function rotuloNoMeio(texto: string | undefined, a: Ponto, b: Ponto, c: ContextoDesenho, g: string): ItemDesenho[] {
  if (!texto || !c.estilo.mostrarRotulo) return [];
  const { h } = caixaDoRotulo(texto, c);
  const meio = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const cima = direcaoNaImagem({ x: 0, y: -1 }, c.giro);
  const p = soma(meio, mult(cima, h / 2 + espessuraPx(c)));
  return [itemRotulo(texto, p.x, p.y, c, g)];
}

function horizontalOuVertical(m: Medida, p: Ponto[], c: ContextoDesenho, texto: string | undefined, g: string): ItemDesenho[] {
  const [p0, p1] = p;
  const corrigido = (q: Ponto) => (c.giro ? girar(q, -c.giro) : q);
  const y0 = corrigido(p0).y, y1 = corrigido(p1).y;
  let v: Ponto, o: Ponto, ref: Ponto;
  if (m.desenho === 'horizontal') {
    // Vértice no ponto mais baixo; a referência horizontal segue para o lado do outro ponto.
    const baixoEh1 = y1 > y0;
    v = baixoEh1 ? p1 : p0; o = baixoEh1 ? p0 : p1;
    const dx = corrigido(o).x - corrigido(v).x;
    ref = { x: dx < 0 ? -1 : 1, y: 0 };
  } else {
    // Vértice no ponto mais alto; a referência vertical desce, como um fio de prumo.
    const altoEh1 = y1 < y0;
    v = altoEh1 ? p1 : p0; o = altoEh1 ? p0 : p1;
    ref = { x: 0, y: 1 };
  }
  const comp = dist(v, o);
  const b = soma(v, mult(direcaoNaImagem(ref, c.giro), comp));
  const papeis = papeisDaMedida(m.desenho);
  return [
    ...blocoAngular(v, o, b, c, { texto, tracejadoB: true, grupo: g }),
    itemPonto(p0, papeis[0], c, { grupo: g }),
    itemPonto(p1, papeis[1], c, { grupo: g }),
  ];
}

function retasComAngulo(m: Medida, p: Ponto[], c: ContextoDesenho, texto: string | undefined, g: string): ItemDesenho[] {
  const [a, b, cc, d] = p;
  const papeis = papeisDaMedida(m.desenho);
  const itens: ItemDesenho[] = [itemReta(a, b, c, { grupo: g }), itemReta(cc, d, c, { grupo: g })];
  const d1 = unit(sub(b, a)), d2 = unit(sub(d, cc));
  const x = intersecao(a, d1, cc, d2);
  const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, m2 = { x: (cc.x + d.x) / 2, y: (cc.y + d.y) / 2 };
  const maior = Math.max(dist(a, b), dist(cc, d));
  let desenhado = false;
  // Cruzamento muito longe ou fora da foto: sem prolongamentos nem arco, só o rótulo entre as retas.
  const margem = 0.15;
  const dentro = !!x && x.ponto.x > -margem * c.w && x.ponto.x < (1 + margem) * c.w && x.ponto.y > -margem * c.h && x.ponto.y < (1 + margem) * c.h;
  if (x && dentro && dist(x.ponto, m1) < maior * 4 && dist(x.ponto, m2) < maior * 4) {
    const s1 = dot(sub(m1, x.ponto), d1) >= 0 ? 1 : -1;
    let s2 = dot(sub(m2, x.ponto), d2) >= 0 ? 1 : -1;
    if (dot(mult(d1, s1), mult(d2, s2)) < 0) s2 = -s2;
    const arm1 = Math.max(dist(x.ponto, m1), 1), arm2 = Math.max(dist(x.ponto, m2), 1);
    const ra = soma(x.ponto, mult(d1, s1 * arm1)), rb = soma(x.ponto, mult(d2, s2 * arm2));
    // Prolongamentos tracejados até o cruzamento, quando ele cai fora do segmento.
    const prolonga = (ini: Ponto, fim: Ponto) => {
      const perto = dist(ini, x.ponto) < dist(fim, x.ponto) ? ini : fim;
      if (dist(perto, x.ponto) > espessuraPx(c)) itens.push(itemReta(perto, x.ponto, c, { tracejada: true, grupo: g }));
    };
    prolonga(a, b); prolonga(cc, d);
    const raio = Math.min(c.estilo.raioArco * c.k, Math.min(arm1, arm2) * 0.6);
    const caixa = texto && c.estilo.mostrarRotulo ? caixaDoRotulo(texto, c) : undefined;
    if (raio > espessuraPx(c) * 1.2) {
      const arco = arcoDoAngulo(x.ponto, ra, rb, raio, caixa);
      if (c.estilo.mostrarArco && arco.path) itens.push({ tipo: 'arco', path: arco.path, centro: x.ponto, raio, inicio: arco.inicio, delta: arco.delta, largura: larguraArcoPx(c), cor: c.estilo.cor, halo: haloDe(c, larguraArcoPx(c)), grupo: g });
      if (texto && caixa) itens.push(itemRotulo(texto, arco.posicaoRotulo.x, arco.posicaoRotulo.y, c, g));
      desenhado = true;
    }
  }
  if (!desenhado && texto && c.estilo.mostrarRotulo) {
    const { h } = caixaDoRotulo(texto, c);
    itens.push(itemRotulo(texto, (m1.x + m2.x) / 2, (m1.y + m2.y) / 2 - h, c, g));
  }
  [a, b, cc, d].forEach((q, i) => itens.push(itemPonto(q, papeis[i], c, { grupo: g })));
  return itens;
}

function prumo(m: Medida, p: Ponto[], c: ContextoDesenho, rot: RotulosDaMedida, olhaPara: OlharPara | undefined, g: string): ItemDesenho[] {
  const apoio = p[0];
  const baixo = direcaoNaImagem({ x: 0, y: 1 }, c.giro);
  const tTopo = baixo.y > 1e-6 ? apoio.y / baixo.y : 0;
  const tBase = baixo.y > 1e-6 ? (c.h - apoio.y) / baixo.y : 0;
  const topo = sub(apoio, mult(baixo, Math.max(tTopo, 0)));
  const base = soma(apoio, mult(baixo, Math.max(tBase, 0)));
  const esp = espessuraPx(c);
  const larguraFio = Math.max(esp * 0.7, 2 * c.k);
  const itens: ItemDesenho[] = [itemReta(topo, base, c, { largura: larguraFio, grupo: g })];
  const papeis = papeisDaMedida(m.desenho);
  for (let i = 1; i < p.length; i++) {
    const q = p[i];
    const pe = soma(apoio, mult(baixo, dot(sub(q, apoio), baixo)));
    if (dist(pe, q) > Math.max(1, c.k)) itens.push(itemReta(pe, q, c, { tracejada: true, grupo: g }));
  }
  p.forEach((q, i) => itens.push(itemPonto(q, papeis[i] ?? 'a', c, { grupo: g })));
  if (c.estilo.mostrarRotulo && rot.porPonto) {
    const lateral = direcaoNaImagem({ x: 1, y: 0 }, c.giro);
    for (const [chave, texto] of Object.entries(rot.porPonto)) {
      const q = p[Number(chave)];
      if (!q) continue;
      const pe = soma(apoio, mult(baixo, dot(sub(q, apoio), baixo)));
      const desvio = dot(sub(q, pe), lateral);
      const lado = Math.abs(desvio) > 1 ? Math.sign(desvio) : olhaPara === 'esquerda' ? -1 : 1;
      const { w } = caixaDoRotulo(texto, c);
      const centro = soma(q, mult(lateral, lado * (raioPontoPx(c) + w / 2 + esp)));
      itens.push(itemRotulo(texto, centro.x, centro.y, c, g));
    }
  }
  return itens;
}

export interface OpcoesMedida {
  olhaPara?: OlharPara;
  refCompasso?: RefCompasso;
}

/**
 * Itens de uma medida com os pontos `p` (já na ordem de marcação). Marcada pela metade, mostra só
 * as retas e os pontos já feitos; completa, ganha referências, arco e rótulo.
 */
export function itensDaMedida(m: Medida, p: Ponto[], rot: RotulosDaMedida, c: ContextoDesenho, o: OpcoesMedida = {}): ItemDesenho[] {
  if (!p.length) return [];
  const g = m.id;
  const completa = p.length >= m.pontos.length;
  if (!completa) return m.desenho === 'prumo' ? prumo(m, p, c, {}, o.olhaPara, g) : itensGenericos(m, p, c, g);
  const texto = rot.principal;
  const papeis = papeisDaMedida(m.desenho);
  switch (m.desenho) {
    case 'angulo3':
      return [...blocoAngular(p[1], p[0], p[2], c, { texto, grupo: g }), itemPonto(p[0], papeis[0], c, { grupo: g }), itemPonto(p[1], papeis[1], c, { grupo: g }), itemPonto(p[2], papeis[2], c, { grupo: g })];
    case 'compasso':
      return [...blocoAngular(p[0], p[1], p[2], c, { texto, grupo: g }), itemPonto(p[0], papeis[0], c, { grupo: g }), itemPonto(p[1], papeis[1], c, { grupo: g }), itemPonto(p[2], papeis[2], c, { grupo: g })];
    case 'compasso-ref': {
      const ref = REFS_COMPASSO.find((r) => r.id === (o.refCompasso ?? 'baixo')) ?? REFS_COMPASSO[0];
      const fim = soma(p[0], mult(direcaoNaImagem(ref.vetor, c.giro), dist(p[0], p[1])));
      return [...blocoAngular(p[0], p[1], fim, c, { texto, grupo: g }), itemPonto(p[0], papeis[0], c, { grupo: g }), itemPonto(p[1], papeis[1], c, { grupo: g })];
    }
    case 'angulo-q': {
      const prolongado = soma(p[1], mult(unit(sub(p[1], p[0])), dist(p[1], p[2])));
      return [
        itemReta(p[1], prolongado, c, { tracejada: true, grupo: g }),
        ...blocoAngular(p[1], prolongado, p[2], c, { texto, semBracoA: true, grupo: g }),
        itemReta(p[0], p[1], c, { grupo: g }),
        itemPonto(p[0], papeis[0], c, { grupo: g }), itemPonto(p[1], papeis[1], c, { grupo: g }), itemPonto(p[2], papeis[2], c, { grupo: g }),
      ];
    }
    case 'horizontal': case 'vertical':
      return horizontalOuVertical(m, p, c, texto, g);
    case 'retas':
      return retasComAngulo(m, p, c, texto, g);
    case 'regua':
      return [itemReta(p[0], p[1], c, { grupo: g }), ...rotuloNoMeio(texto, p[0], p[1], c, g), itemPonto(p[0], 'a', c, { grupo: g }), itemPonto(p[1], 'b', c, { grupo: g })];
    case 'prumo':
      return prumo(m, p, c, rot, o.olhaPara, g);
    default:
      return itensGenericos(m, p, c, g);
  }
}

const CAMADA: Record<ItemDesenho['tipo'], number> = { reta: 0, arco: 1, ponto: 2, rotulo: 3 };

/** Põe retas e arcos por baixo, depois os pontos e, por cima de tudo, os rótulos (ordem estável). */
export function ordenarCamadas(itens: ItemDesenho[]): ItemDesenho[] {
  return itens.map((it, i) => ({ it, i })).sort((x, y) => CAMADA[x.it.tipo] - CAMADA[y.it.tipo] || x.i - y.i).map((x) => x.it);
}

// --- primitivas soltas (canvas e SVG reutilizáveis) --------------------------------------------

/** Itens de um ângulo solto: braços, arco, pontas e rótulo. `graus` vira o texto "118°". */
export function itensDoAngulo(vertice: Ponto, a: Ponto, b: Ponto, c: ContextoDesenho, o: { graus?: number; texto?: string; tracejadoB?: boolean; semPontas?: boolean } = {}): ItemDesenho[] {
  const texto = o.texto ?? (o.graus !== undefined ? rotuloGraus(o.graus, c.estilo.casasRotulo ?? 1) : undefined);
  const itens = blocoAngular(vertice, a, b, c, { texto, tracejadoB: o.tracejadoB });
  if (!o.semPontas) {
    itens.push(itemPonto(a, 'a', c), itemPonto(vertice, 'v', c));
    if (!o.tracejadoB) itens.push(itemPonto(b, 'b', c));
  }
  return ordenarCamadas(itens);
}

export function itensDaReta(a: Ponto, b: Ponto, c: ContextoDesenho, o: { cor?: string; tracejada?: boolean; semPontas?: boolean } = {}): ItemDesenho[] {
  const itens: ItemDesenho[] = [itemReta(a, b, c, { cor: o.cor, tracejada: o.tracejada })];
  if (!o.semPontas) itens.push(itemPonto(a, 'a', c), itemPonto(b, 'b', c));
  return ordenarCamadas(itens);
}

/** Fio de prumo avulso: o apoio, a vertical por ele e os pontos com o desvio de cada um. */
export function itensDoPrumo(apoio: Ponto, pontos: { ponto: Ponto; rotulo?: string }[], c: ContextoDesenho, olhaPara?: OlharPara): ItemDesenho[] {
  const m: Medida = { id: 'prumo', nome: 'Fio de prumo', vistas: [], grupo: 'postura', desenho: 'prumo', pontos: ['Apoio', ...pontos.map(() => 'Ponto')], segmentos: [], calcular: () => null };
  const porPonto: Record<number, string> = {};
  pontos.forEach((q, i) => { if (q.rotulo) porPonto[i + 1] = q.rotulo; });
  return ordenarCamadas(prumo(m, [apoio, ...pontos.map((q) => q.ponto)], c, { porPonto }, olhaPara, 'prumo'));
}

export const anguloEntrePontos = (v: Ponto, a: Ponto, b: Ponto): number => {
  const u = sub(a, v), w = sub(b, v);
  const n = Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y);
  return n === 0 ? 0 : Math.acos(limitar(dot(u, w) / n, -1, 1)) * RAD;
};
