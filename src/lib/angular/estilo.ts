import type { Ponto } from './medidas';

/**
 * Estilo das marcações (retas, pontos, arco e rótulo). Os tamanhos valem para uma foto de 1000 px de
 * menor lado e são multiplicados por `escalaDoEstilo`: tela, PDF e PNG saem com a mesma proporção.
 */
export interface EstiloMarcacao {
  /** Espessura das retas, de 2 a 14 (para 1000 px de menor lado). */
  espessura: number;
  cor: string;
  corPontoA: string;
  corPontoB: string;
  corVertice: string;
  mostrarArco: boolean;
  mostrarRotulo: boolean;
  raioArco: number;
  tamanhoRotulo: number;
  /** Casas decimais do ângulo no rótulo; sem isso, 1. */
  casasRotulo?: 0 | 1;
  /** Cor do contorno que dá contraste ao texto do rótulo (e às retas, se `contornoLinhas`). */
  contorno?: string;
  contornoLinhas?: boolean;
  /** Fundo da pílula do rótulo; sem isso, o rótulo é só texto com contorno. */
  rotuloFundo?: string;
  /** Borda da pílula; sem isso, a cor das retas. */
  rotuloBorda?: string;
  /** Cor do texto; sem isso, a cor das retas (escurecida se o fundo for claro) ou branco se não houver fundo. */
  rotuloTexto?: string;
}

export const ESTILO_PADRAO: EstiloMarcacao = {
  espessura: 4, cor: '#facc15', corPontoA: '#ef4444', corPontoB: '#3b82f6', corVertice: '#10b981',
  mostrarArco: true, mostrarRotulo: true, raioArco: 70, tamanhoRotulo: 40, casasRotulo: 1, contorno: '#000000', rotuloTexto: '#ffffff',
};

/** Como nas artes de antes e depois: reta verde grossa, pontas vermelha e azul, arco fino e rótulo branco com borda verde. */
export const ESTILO_INSTAGRAM: EstiloMarcacao = {
  espessura: 9, cor: '#4caf50', corPontoA: '#e53935', corPontoB: '#1e88e5', corVertice: '#1e88e5',
  mostrarArco: true, mostrarRotulo: true, raioArco: 90, tamanhoRotulo: 46, casasRotulo: 0, rotuloFundo: '#ffffff',
};

export const ESTILO_CONTRASTE: EstiloMarcacao = {
  espessura: 8, cor: '#ffffff', corPontoA: '#ef4444', corPontoB: '#3b82f6', corVertice: '#22c55e',
  mostrarArco: true, mostrarRotulo: true, raioArco: 70, tamanhoRotulo: 46, casasRotulo: 1, contorno: '#000000', contornoLinhas: true,
  rotuloFundo: '#000000', rotuloBorda: '#ffffff', rotuloTexto: '#ffffff',
};

export const ESTILO_FINO: EstiloMarcacao = {
  espessura: 2, cor: '#ffffff', corPontoA: '#ef4444', corPontoB: '#3b82f6', corVertice: '#22c55e',
  mostrarArco: true, mostrarRotulo: true, raioArco: 60, tamanhoRotulo: 34, casasRotulo: 1, contorno: '#000000', rotuloTexto: '#ffffff',
};

export interface EstiloNomeado { id: string; nome: string; estilo: EstiloMarcacao }

export const ESTILOS: EstiloNomeado[] = [
  { id: 'padrao', nome: 'Padrão', estilo: ESTILO_PADRAO },
  { id: 'instagram', nome: 'Instagram', estilo: ESTILO_INSTAGRAM },
  { id: 'contraste', nome: 'Alto contraste', estilo: ESTILO_CONTRASTE },
  { id: 'fino', nome: 'Fino', estilo: ESTILO_FINO },
];

export const COR_SUGERIDAS = ['#4caf50', '#facc15', '#ffffff', '#ef4444', '#3b82f6', '#f97316', '#a855f7', '#06b6d4'];

export const LIMITES_ESTILO = {
  espessura: { min: 2, max: 14 },
  raioArco: { min: 30, max: 160 },
  tamanhoRotulo: { min: 24, max: 80 },
} as const;

const CHAVE_ESTILO = 'myid:angular:estilo-marcacao';
const limitar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const COR_VALIDA = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const numero = (v: unknown, padrao: number, min: number, max: number) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? limitar(n, min, max) : padrao;
};
const corOu = (v: unknown, padrao: string | undefined) => (typeof v === 'string' && COR_VALIDA.test(v) ? v : padrao);

/** Aceita um estilo vindo do armazenamento (ou de fora) e devolve um estilo completo e dentro dos limites. */
export function normalizarEstilo(bruto: unknown): EstiloMarcacao {
  if (!bruto || typeof bruto !== 'object') return ESTILO_PADRAO;
  const o = bruto as Record<string, unknown>;
  const l = LIMITES_ESTILO;
  const estilo: EstiloMarcacao = {
    espessura: Math.round(numero(o.espessura, ESTILO_PADRAO.espessura, l.espessura.min, l.espessura.max)),
    cor: corOu(o.cor, ESTILO_PADRAO.cor)!,
    corPontoA: corOu(o.corPontoA, ESTILO_PADRAO.corPontoA)!,
    corPontoB: corOu(o.corPontoB, ESTILO_PADRAO.corPontoB)!,
    corVertice: corOu(o.corVertice, ESTILO_PADRAO.corVertice)!,
    mostrarArco: typeof o.mostrarArco === 'boolean' ? o.mostrarArco : ESTILO_PADRAO.mostrarArco,
    mostrarRotulo: typeof o.mostrarRotulo === 'boolean' ? o.mostrarRotulo : ESTILO_PADRAO.mostrarRotulo,
    raioArco: numero(o.raioArco, ESTILO_PADRAO.raioArco, l.raioArco.min, l.raioArco.max),
    tamanhoRotulo: numero(o.tamanhoRotulo, ESTILO_PADRAO.tamanhoRotulo, l.tamanhoRotulo.min, l.tamanhoRotulo.max),
    casasRotulo: o.casasRotulo === 0 ? 0 : 1,
  };
  const contorno = corOu(o.contorno, undefined);
  if (contorno) estilo.contorno = contorno;
  if (o.contornoLinhas === true) estilo.contornoLinhas = true;
  const fundo = corOu(o.rotuloFundo, undefined);
  if (fundo) estilo.rotuloFundo = fundo;
  const borda = corOu(o.rotuloBorda, undefined);
  if (borda) estilo.rotuloBorda = borda;
  const texto = corOu(o.rotuloTexto, undefined);
  if (texto) estilo.rotuloTexto = texto;
  return estilo;
}

export function lerEstilo(): EstiloMarcacao {
  try {
    const bruto = localStorage.getItem(CHAVE_ESTILO);
    return bruto ? normalizarEstilo(JSON.parse(bruto)) : ESTILO_PADRAO;
  } catch {
    // Armazenamento bloqueado (janela privada) ou JSON inválido: segue com o estilo padrão.
    return ESTILO_PADRAO;
  }
}

export function salvarEstilo(estilo: EstiloMarcacao): void {
  try {
    localStorage.setItem(CHAVE_ESTILO, JSON.stringify(estilo));
  } catch {
    // Sem armazenamento: o estilo vale só nesta sessão.
  }
}

export function estilosIguais(a: EstiloMarcacao, b: EstiloMarcacao): boolean {
  const x = normalizarEstilo(a), y = normalizarEstilo(b);
  return (Object.keys({ ...x, ...y }) as (keyof EstiloMarcacao)[]).every((k) => x[k] === y[k]);
}

/**
 * Unidades de desenho por pixel da foto: proporcional ao menor lado, para tela, PDF e PNG saírem
 * iguais. Com `zoom` (só na tela), o desenho cresce menos que a foto para não cobrir a anatomia.
 */
export const escalaDoEstilo = (w: number, h: number, zoom = 1) => Math.min(w, h) / 1000 / Math.sqrt(Math.max(1, zoom));

/**
 * Na tela do celular a foto aparece bem menor que o original; garante que o rótulo tenha pelo menos
 * `rotuloMinimoPx` pixels de tela. `pxPorUnidade` = pixels de tela por pixel da foto.
 */
export function escalaNaTela(escalaBase: number, pxPorUnidade: number, tamanhoRotulo: number, rotuloMinimoPx = 12): number {
  if (!(pxPorUnidade > 0) || !(tamanhoRotulo > 0)) return escalaBase;
  return Math.max(escalaBase, rotuloMinimoPx / (pxPorUnidade * tamanhoRotulo));
}

/** "118°" (0 casas) ou "118,4°" (1 casa), no formato brasileiro. */
export const rotuloGraus = (graus: number, casas: 0 | 1 = 0) =>
  `${graus.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}°`;

export type UnidadeRotulo = 'graus' | 'cm' | '%';

/** Valor com a unidade para o rótulo: graus seguem `casas`; cm e % usam sempre uma casa. */
export function rotuloValor(valor: number, unidade: UnidadeRotulo, casas: 0 | 1 = 1): string {
  const um = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (unidade === 'cm') return `${um(valor)} cm`;
  if (unidade === '%') return `${um(valor)}%`;
  return rotuloGraus(valor, casas);
}

const RAD = Math.PI / 180;
const arred = (n: number) => Math.round(n * 100) / 100;

export interface ArcoDoAngulo {
  path: string;
  /** Menor ângulo entre as semirretas, de 0 a 180. */
  anguloGraus: number;
  /** Centro sugerido do rótulo, na bissetriz, fora do arco. */
  posicaoRotulo: Ponto;
  /** Ângulo (rad) onde o arco começa e quanto ele varre (com sinal), para quem desenha em canvas. */
  inicio: number;
  delta: number;
  raio: number;
  centro: Ponto;
}

/**
 * Arco do menor ângulo entre as semirretas vértice→a e vértice→b. Com `caixaRotulo`, o rótulo fica
 * encostado fora do arco; sem ela, a 1,65 do raio.
 */
export function arcoDoAngulo(vertice: Ponto, a: Ponto, b: Ponto, raio: number, caixaRotulo?: { w: number; h: number }): ArcoDoAngulo {
  const nulo = Math.hypot(a.x - vertice.x, a.y - vertice.y) === 0 || Math.hypot(b.x - vertice.x, b.y - vertice.y) === 0;
  if (nulo) return { path: '', anguloGraus: 0, posicaoRotulo: vertice, inicio: 0, delta: 0, raio, centro: vertice };
  const ta = Math.atan2(a.y - vertice.y, a.x - vertice.x);
  const tb = Math.atan2(b.y - vertice.y, b.x - vertice.x);
  let delta = tb - ta;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta <= -Math.PI) delta += 2 * Math.PI;
  const noRaio = (t: number, r: number) => ({ x: arred(vertice.x + r * Math.cos(t)), y: arred(vertice.y + r * Math.sin(t)) });
  const ini = noRaio(ta, raio), fim = noRaio(ta + delta, raio);
  const tm = ta + delta / 2;
  const distancia = caixaRotulo
    ? raio + caixaRotulo.h * 0.2 + Math.abs(Math.cos(tm)) * caixaRotulo.w / 2 + Math.abs(Math.sin(tm)) * caixaRotulo.h / 2
    : raio * 1.65;
  return {
    path: `M ${ini.x} ${ini.y} A ${arred(raio)} ${arred(raio)} 0 0 ${delta > 0 ? 1 : 0} ${fim.x} ${fim.y}`,
    anguloGraus: Math.abs(delta) / RAD,
    posicaoRotulo: noRaio(tm, distancia),
    inicio: ta,
    delta,
    raio,
    centro: vertice,
  };
}

/** Escurece uma cor #rrggbb (fração 0–1); outras notações voltam como vieram. */
export function escurecerCor(cor: string, fracao = 0.28): string {
  const m = /^#([0-9a-f]{6})$/i.exec(cor);
  if (!m) return cor;
  const n = parseInt(m[1], 16);
  const canal = (v: number) => Math.round(v * (1 - fracao)).toString(16).padStart(2, '0');
  return `#${canal((n >> 16) & 255)}${canal((n >> 8) & 255)}${canal(n & 255)}`;
}

function claro(cor: string): boolean {
  const m = /^#([0-9a-f]{6})$/i.exec(cor) ?? /^#([0-9a-f]{3})$/i.exec(cor);
  if (!m) return false;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  const n = parseInt(h, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.6;
}

export interface CoresDoRotulo { fundo?: string; borda: string; texto: string; contorno?: string }

const TEXTO_ESCURO_ROTULO = '#1f2937';

/** Cores efetivas do rótulo: pílula (com fundo) ou texto solto com contorno. */
export function coresDoRotulo(e: EstiloMarcacao): CoresDoRotulo {
  if (e.rotuloFundo) {
    const fundoClaro = claro(e.rotuloFundo);
    // Retas claras (branco, amarelo) sobre pílula clara: a cor delas, mesmo escurecida, some no fundo; o rótulo usa um tom escuro fixo.
    const semContraste = fundoClaro && claro(e.cor);
    const borda = e.rotuloBorda ?? (semContraste ? TEXTO_ESCURO_ROTULO : e.cor);
    const texto = e.rotuloTexto ?? (semContraste ? TEXTO_ESCURO_ROTULO : fundoClaro ? escurecerCor(e.cor) : e.cor);
    return { fundo: e.rotuloFundo, borda, texto };
  }
  return { borda: e.rotuloBorda ?? e.cor, texto: e.rotuloTexto ?? '#ffffff', contorno: e.contorno ?? '#000000' };
}

// Larguras (em fração do corpo da fonte) da Helvetica/Arial em negrito: a mesma conta na tela e no
// canvas, sem medir fonte, para o rótulo sair do mesmo tamanho nos dois.
const LARGURA_CARACTERE: Record<string, number> = {
  ',': 0.28, '.': 0.28, ' ': 0.28, '°': 0.4, '%': 0.89, c: 0.56, m: 0.89, '-': 0.33, '−': 0.58, '+': 0.58,
  C: 0.72, '7': 0.56, A: 0.72, E: 0.67, O: 0.78, P: 0.67, Q: 0.78, R: 0.72, S: 0.67, T: 0.61, V: 0.67, a: 0.56, b: 0.61, e: 0.56, h: 0.61, i: 0.28, l: 0.28, n: 0.61, o: 0.61, r: 0.39, t: 0.33, u: 0.61, d: 0.61, j: 0.28, q: 0.61, p: 0.61, ê: 0.56, ç: 0.56, ã: 0.56, é: 0.56, í: 0.28, ó: 0.61, ú: 0.61, â: 0.56, '1': 0.56, '2': 0.56, '3': 0.56, '4': 0.56, '5': 0.56, '6': 0.56, '8': 0.56, '9': 0.56, '0': 0.56,
};

/** Largura estimada do texto, em px, para a fonte de corpo `fonte`. */
export const larguraDoTexto = (texto: string, fonte: number) =>
  [...texto].reduce((s, ch) => s + (LARGURA_CARACTERE[ch] ?? 0.6), 0) * fonte;

export const FAMILIA_ROTULO = 'Helvetica, Arial, sans-serif';
