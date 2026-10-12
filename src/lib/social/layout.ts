import { FORMATOS, layoutEfetivo, margensDoFormato, type FormatoSocial, type LayoutArte, type MargensArte, type Retangulo, type TituloModo } from './formatos';
import { limitar } from './geometria';

/*
 * Layout da arte social: função pura que recebe o que vai na arte e devolve onde cada elemento fica
 * (fotos, título, rótulos, legenda, perfis e selo). O canvas só pinta o que sai daqui. A medida do texto
 * entra por um `Medidor` para a conta ser a mesma no navegador e nos testes.
 */

export type TipoFonte = 'titulo' | 'forte' | 'texto';

/** Largura, em pixels, de `texto` na fonte `tipo` com corpo `fonte`. */
export type Medidor = (texto: string, fonte: number, tipo: TipoFonte) => number;

/** Altura das maiúsculas em fração do corpo da fonte (Bebas Neue e Inter), para alinhar sem depender do baseline do navegador. */
export const ALTURA_CAPITAL: Record<TipoFonte, number> = { titulo: 0.7, forte: 0.727, texto: 0.727 };

const REFERENCIA = 100;
export const larguraDoTexto = (medir: Medidor, texto: string, fonte: number, tipo: TipoFonte) => (medir(texto, REFERENCIA, tipo) * fonte) / REFERENCIA;

export const GAP_FOTOS = 24;
const GAP_COLUNA = 22;
const GAP_RODAPE = 30;
const GAP_RODAPE_SEPARADOR = 24;
export const ALTURA_FAIXA_ROTULO = 64;
export const FONTE_ROTULO = 38;
export const FONTE_DATA = 26;
export const ALTURA_PILULA = 88;
export const DIAMETRO_AVATAR = 64;
export const FONTE_PILULA = 34;
export const FONTE_PERFIL = 30;
export const PASSO_PERFIL = 44;
export const DIAMETRO_SELO = 100;
export const PASSO_TITULO = 0.92;
const FONTE_TITULO_MAX = 150;
const MAX_PERFIS = 3;
const TEM_ACENTO_MAIUSCULO = /[ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜ]/;
const ACENTO_SOBRE_CAPITAL = 0.2;

export interface AjusteTexto { linhas: string[]; fonte: number; passo: number; /** Espessura do bloco (perpendicular às linhas). */ espessura: number; /** Largura da linha mais comprida. */ comprimento: number }

/** Divide as palavras em `n` linhas minimizando a largura da mais comprida. */
function dividirEmLinhas(palavras: string[], n: number, largura: (s: string) => number): string[] {
  const total = palavras.length;
  if (n <= 1 || total <= 1) return [palavras.join(' ')];
  const k = Math.min(n, total);
  const lw = (i: number, j: number) => largura(palavras.slice(i, j).join(' '));
  const melhor: number[][] = Array.from({ length: k + 1 }, () => Array(total + 1).fill(Infinity));
  const corte: number[][] = Array.from({ length: k + 1 }, () => Array(total + 1).fill(0));
  melhor[0][0] = 0;
  for (let l = 1; l <= k; l++) {
    for (let j = l; j <= total; j++) {
      for (let i = l - 1; i < j; i++) {
        const custo = Math.max(melhor[l - 1][i], lw(i, j));
        if (custo < melhor[l][j]) { melhor[l][j] = custo; corte[l][j] = i; }
      }
    }
  }
  const linhas: string[] = [];
  let j = total;
  for (let l = k; l >= 1; l--) {
    const i = corte[l][j];
    linhas.unshift(palavras.slice(i, j).join(' '));
    j = i;
  }
  return linhas;
}

/**
 * Maior corpo de fonte com que o texto cabe em `comprimento` (ao longo das linhas) e `espessuraMax` (do
 * bloco inteiro), testando de 1 a `linhasMax` linhas. Empate (até 3%) fica com menos linhas.
 */
export function ajustarTitulo(texto: string, medir: Medidor, o: { comprimento: number; espessuraMax: number; fonteMax?: number; linhasMax?: number; tipo?: TipoFonte }): AjusteTexto {
  const tipo = o.tipo ?? 'titulo';
  const palavras = texto.trim().split(/\s+/).filter(Boolean).slice(0, 24);
  const vazio: AjusteTexto = { linhas: [], fonte: 0, passo: 0, espessura: 0, comprimento: 0 };
  if (!palavras.length || !(o.comprimento > 0) || !(o.espessuraMax > 0)) return vazio;
  const cap = ALTURA_CAPITAL[tipo];
  const unidade = (s: string) => larguraDoTexto(medir, s, 1, tipo);
  let melhor: AjusteTexto | null = null;
  for (let k = 1; k <= Math.min(o.linhasMax ?? 3, palavras.length); k++) {
    const linhas = dividirEmLinhas(palavras, k, unidade);
    const larguraUnitaria = Math.max(...linhas.map(unidade));
    if (!(larguraUnitaria > 0)) continue;
    const n = linhas.length;
    const fonte = Math.min(o.fonteMax ?? FONTE_TITULO_MAX, o.comprimento / larguraUnitaria, o.espessuraMax / ((n - 1) * PASSO_TITULO + cap));
    if (melhor === null || fonte > melhor.fonte * 1.03) {
      melhor = { linhas, fonte, passo: fonte * PASSO_TITULO, espessura: (n - 1) * fonte * PASSO_TITULO + cap * fonte, comprimento: larguraUnitaria * fonte };
    }
  }
  return melhor ?? vazio;
}

/** Corpo de fonte reduzido até o texto caber em `larguraMax`; se nem no menor corpo couber, devolve o menor corpo. */
export function fonteQueCabe(medir: Medidor, texto: string, tipo: TipoFonte, fonteMax: number, larguraMax: number, fonteMin = 18): number {
  const w = larguraDoTexto(medir, texto, 1, tipo);
  if (!(w > 0)) return fonteMax;
  return limitar(larguraMax / w, fonteMin, fonteMax);
}

/** Corta o texto com reticências até caber em `larguraMax`. */
export function cortarComReticencias(medir: Medidor, texto: string, fonte: number, tipo: TipoFonte, larguraMax: number): string {
  if (larguraDoTexto(medir, texto, fonte, tipo) <= larguraMax) return texto;
  for (let n = texto.length - 1; n > 0; n--) {
    const candidato = `${texto.slice(0, n).trimEnd()}…`;
    if (larguraDoTexto(medir, candidato, fonte, tipo) <= larguraMax) return candidato;
  }
  return '…';
}

export interface ParametrosLayout {
  formato: FormatoSocial;
  layout: LayoutArte;
  nPaineis: number;
  margensStories: boolean;
  titulo?: string;
  tituloModo: TituloModo;
  rotulos?: string[];
  datas?: string[];
  legenda?: string;
  temAvatar?: boolean;
  temSelo?: boolean;
  perfis?: string[];
}

export interface TituloLayout {
  linhas: string[];
  fonte: number;
  passo: number;
  rotacao: 0 | -90;
  caixa: Retangulo;
  /** Início da primeira linha: baseline à esquerda (horizontal) ou canto inferior da base das letras (vertical, lido de baixo para cima). */
  ancora: { x: number; y: number };
}

export interface RotuloLayout {
  indice: number;
  texto: string;
  data: string;
  fonte: number;
  fonteData: number;
  rotacao: 0 | -90;
  centro: { x: number; y: number };
  caixa: Retangulo;
}

export interface PilulaLayout {
  caixa: Retangulo;
  texto: string;
  fonte: number;
  textoX: number;
  baseY: number;
  avatar: { cx: number; cy: number; r: number } | null;
}

export interface PerfisLayout {
  fonte: number;
  linhas: { texto: string; /** Borda direita. */ x: number; baseY: number; largura: number }[];
}

export interface SeloLayout { cx: number; cy: number; r: number; sobreFoto: boolean }

export interface LayoutSocial {
  formato: FormatoSocial;
  layout: LayoutArte;
  largura: number;
  altura: number;
  margens: MargensArte;
  tituloModo: TituloModo;
  /** Rótulos girados numa faixa ao lado das fotos (título vertical). */
  rotulosGirados: boolean;
  regiaoFotos: Retangulo;
  paineis: Retangulo[];
  titulo: TituloLayout | null;
  rotulos: RotuloLayout[];
  pilula: PilulaLayout | null;
  perfis: PerfisLayout | null;
  selo: SeloLayout | null;
  rodape: Retangulo | null;
}

export const normalizarTitulo = (t: string | undefined) => (t ?? '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR');

export function calcularLayoutSocial(p: ParametrosLayout, medir: Medidor): LayoutSocial {
  const info = FORMATOS[p.formato];
  const W = info.largura, H = info.altura;
  const mg = margensDoFormato(p.formato, p.margensStories);
  const L = layoutEfetivo(p.layout, p.nPaineis);
  const n = L === 'unica' ? 1 : 2;

  const textoTitulo = normalizarTitulo(p.titulo);
  const modo: TituloModo = textoTitulo ? p.tituloModo : 'nenhum';
  const girados = modo === 'vertical' && L !== 'lado_a_lado';
  const rotulosBrutos = Array.from({ length: n }, (_, i) => ({ texto: (p.rotulos?.[i] ?? '').trim(), data: (p.datas?.[i] ?? '').trim() }));
  const algumTexto = rotulosBrutos.some((r) => r.texto), algumaData = rotulosBrutos.some((r) => r.data);
  const temRotulo = algumTexto || algumaData;

  // ---- rodapé: legenda à esquerda e perfis à direita, alinhados pela base do texto ----
  const perfis = (p.perfis ?? []).filter(Boolean).slice(0, MAX_PERFIS);
  const legenda = (p.legenda ?? '').trim();
  const rodapeH = Math.max(legenda ? ALTURA_PILULA : 0, perfis.length * PASSO_PERFIL);
  const baseTexto = H - mg.texto.base;
  const rodapeY = baseTexto - rodapeH;
  const baseFotos = rodapeH ? rodapeY - GAP_RODAPE : H - mg.fotos.base;
  const rodape: Retangulo | null = rodapeH ? { x: mg.texto.esq, y: rodapeY, w: W - mg.texto.esq - mg.texto.dir, h: rodapeH } : null;

  // ---- cabeçalho ou coluna lateral do título ----
  const d = p.temSelo ? DIAMETRO_SELO : 0;
  let esqFotos = mg.fotos.esq;
  const dirFotos = W - mg.fotos.dir;
  let topoFotos = mg.fotos.topo;
  let titulo: TituloLayout | null = null;
  let selo: SeloLayout | null = null;
  let colunaTitulo = 0;

  if (modo === 'vertical') {
    const topoTitulo = mg.texto.topo + (d ? d + 26 : 0);
    const aj = ajustarTitulo(textoTitulo, medir, { comprimento: Math.max(80, baseFotos - topoTitulo), espessuraMax: p.formato === 'quadrado' ? 128 : 150, fonteMax: FONTE_TITULO_MAX, linhasMax: 3 });
    const cap = ALTURA_CAPITAL.titulo * aj.fonte;
    // Acento sobre maiúscula (Ó, Ã...) sobe acima das letras e, girado, invade a margem esquerda: abre espaço.
    const acento = TEM_ACENTO_MAIUSCULO.test(aj.linhas.join(' ')) ? aj.fonte * ACENTO_SOBRE_CAPITAL : 0;
    // A coluna nunca é mais fina que o selo; um título fino fica centralizado sob ele.
    colunaTitulo = Math.max(aj.espessura + acento, d);
    const recuo = (colunaTitulo - aj.espessura - acento) / 2;
    titulo = {
      linhas: aj.linhas, fonte: aj.fonte, passo: aj.passo, rotacao: -90,
      caixa: { x: mg.texto.esq + recuo, y: baseFotos - aj.comprimento, w: aj.espessura + acento, h: aj.comprimento },
      ancora: { x: mg.texto.esq + recuo + acento + cap, y: baseFotos },
    };
    esqFotos = mg.texto.esq + colunaTitulo + GAP_COLUNA;
    if (d) selo = { cx: mg.texto.esq + d / 2, cy: mg.texto.topo + d / 2, r: d / 2, sobreFoto: false };
  } else if (modo === 'horizontal') {
    const compr = W - mg.texto.esq - mg.texto.dir - (d ? d + 28 : 0);
    const aj = ajustarTitulo(textoTitulo, medir, { comprimento: compr, espessuraMax: 420, fonteMax: 132, linhasMax: 2 });
    const cap = ALTURA_CAPITAL.titulo * aj.fonte;
    titulo = {
      linhas: aj.linhas, fonte: aj.fonte, passo: aj.passo, rotacao: 0,
      caixa: { x: mg.texto.esq, y: mg.texto.topo, w: aj.comprimento, h: aj.espessura },
      ancora: { x: mg.texto.esq, y: mg.texto.topo + cap },
    };
    topoFotos = Math.max(mg.fotos.topo, mg.texto.topo + Math.max(aj.espessura, d) + 30);
    if (d) selo = { cx: W - mg.texto.dir - d / 2, cy: mg.texto.topo + d / 2, r: d / 2, sobreFoto: false };
  }

  // ---- faixa de rótulos girados ----
  let faixaX = 0, faixaW = 0;
  if (girados && temRotulo) {
    faixaX = mg.texto.esq + colunaTitulo + GAP_COLUNA;
    faixaW = (algumTexto ? FONTE_ROTULO * ALTURA_CAPITAL.forte : 0) + (algumaData ? (algumTexto ? 12 : 0) + FONTE_DATA * ALTURA_CAPITAL.forte : 0) + 10;
    esqFotos = faixaX + faixaW + 8;
  }

  // ---- fotos ----
  const regiao: Retangulo = { x: esqFotos, y: topoFotos, w: Math.max(120, dirFotos - esqFotos), h: Math.max(120, baseFotos - topoFotos) };
  const fila = !girados && temRotulo ? ALTURA_FAIXA_ROTULO : 0;
  const paineis: Retangulo[] = [];
  if (L === 'unica') {
    paineis.push({ x: regiao.x, y: regiao.y + fila, w: regiao.w, h: regiao.h - fila });
  } else if (L === 'lado_a_lado') {
    const w = (regiao.w - GAP_FOTOS) / 2;
    paineis.push({ x: regiao.x, y: regiao.y + fila, w, h: regiao.h - fila }, { x: regiao.x + w + GAP_FOTOS, y: regiao.y + fila, w, h: regiao.h - fila });
  } else {
    const h = (regiao.h - GAP_FOTOS - 2 * fila) / 2;
    paineis.push({ x: regiao.x, y: regiao.y + fila, w: regiao.w, h }, { x: regiao.x, y: regiao.y + fila + h + GAP_FOTOS + fila, w: regiao.w, h });
  }

  // ---- rótulos ----
  const rotulos: RotuloLayout[] = [];
  if (temRotulo) {
    rotulosBrutos.forEach((r, i) => {
      if (!r.texto && !r.data) return;
      const box = paineis[i];
      if (girados) {
        const along = box.h * 0.92;
        const wTexto = r.texto ? larguraDoTexto(medir, r.texto, 1, 'forte') : 0;
        const wData = r.data ? larguraDoTexto(medir, r.data, 1, 'texto') : 0;
        const fonte = r.texto ? Math.min(FONTE_ROTULO, wTexto > 0 ? along / wTexto : FONTE_ROTULO) : FONTE_ROTULO;
        const fonteData = Math.min(FONTE_DATA, wData > 0 ? along / wData : FONTE_DATA);
        rotulos.push({
          indice: i, texto: r.texto, data: r.data, fonte, fonteData, rotacao: -90,
          centro: { x: faixaX + faixaW / 2, y: box.y + box.h / 2 }, caixa: { x: faixaX, y: box.y, w: faixaW, h: box.h },
        });
      } else {
        const wTexto = r.texto ? larguraDoTexto(medir, r.texto, FONTE_ROTULO, 'forte') : 0;
        const wData = r.data ? larguraDoTexto(medir, r.data, FONTE_DATA, 'texto') + (r.texto ? 14 : 0) : 0;
        const ajuste = Math.min(1, (box.w * 0.96) / Math.max(1, wTexto + wData));
        rotulos.push({
          indice: i, texto: r.texto, data: r.data, fonte: FONTE_ROTULO * ajuste, fonteData: FONTE_DATA * ajuste, rotacao: 0,
          centro: { x: box.x + box.w / 2, y: box.y - fila / 2 }, caixa: { x: box.x, y: box.y - fila, w: box.w, h: fila },
        });
      }
    });
  }

  // ---- selo sobre a foto, quando não há título para abrigá-lo ----
  if (d && !selo) {
    const b = paineis[0];
    const r = d / 2, margem = 20;
    selo = { cx: b.x + b.w - margem - r, cy: b.y + margem + r, r, sobreFoto: true };
  }

  // ---- perfis (direita) ----
  let perfisLay: PerfisLayout | null = null;
  let larguraPerfis = 0;
  if (perfis.length) {
    const linhas = perfis.map((nome, i) => {
      const texto = `@${nome}`;
      const largura = larguraDoTexto(medir, texto, FONTE_PERFIL, 'texto');
      larguraPerfis = Math.max(larguraPerfis, largura);
      return { texto, x: W - mg.texto.dir, baseY: baseTexto - 14 - (perfis.length - 1 - i) * PASSO_PERFIL, largura };
    });
    perfisLay = { fonte: FONTE_PERFIL, linhas };
  }

  // ---- pílula da legenda (esquerda) ----
  let pilula: PilulaLayout | null = null;
  if (legenda) {
    const padE = p.temAvatar ? 12 : 32, padD = 30, gapAvatar = 18;
    const reservaAvatar = p.temAvatar ? DIAMETRO_AVATAR + gapAvatar : 0;
    const larguraMax = (rodape?.w ?? W) - (perfis.length ? larguraPerfis + GAP_RODAPE_SEPARADOR : 0);
    const espaco = larguraMax - padE - reservaAvatar - padD;
    const fonte = fonteQueCabe(medir, legenda, 'texto', FONTE_PILULA, espaco, 26);
    const texto = cortarComReticencias(medir, legenda, fonte, 'texto', espaco);
    const w = padE + reservaAvatar + larguraDoTexto(medir, texto, fonte, 'texto') + padD;
    const x = mg.texto.esq, y = baseTexto - ALTURA_PILULA;
    pilula = {
      caixa: { x, y, w, h: ALTURA_PILULA }, texto, fonte,
      textoX: x + padE + reservaAvatar, baseY: y + ALTURA_PILULA / 2 + (ALTURA_CAPITAL.texto * fonte) / 2,
      avatar: p.temAvatar ? { cx: x + padE + DIAMETRO_AVATAR / 2, cy: y + ALTURA_PILULA / 2, r: DIAMETRO_AVATAR / 2 } : null,
    };
  }

  return { formato: p.formato, layout: L, largura: W, altura: H, margens: mg, tituloModo: modo, rotulosGirados: girados, regiaoFotos: regiao, paineis, titulo, rotulos, pilula, perfis: perfisLay, selo, rodape };
}
